// modules/saas-billing/payment/services/saas-payment.service.ts
//
// PR-3: the actual fix for the production blocker identified in the EM
// audit ("SaaS billing charge execution is simulated, not real" --
// dunning.processor.ts's `// In dev: simulate payment retry` comment).
//
// ARCH-006 compliance: this service is the single owning service for every
// payment-related transaction. It NEVER calls LicenseService/LicenseBuilder/
// EntitlementResolver directly (per the rule established during PR-3
// planning) -- on success, it writes an EventOutbox row inside the same DB
// transaction as the SaasInvoice/SaasPayment/TenantSubscription updates.
// OutboxWorker (now registered, see PR-3 step 1-2) picks that up and emits
// SAAS_INVOICE_PAID asynchronously. Whatever eventually listens for that
// event (License Builder, in PR-4) never needs this service to know it
// exists.
//
// Idempotency (ARCH-006 amendment: cross-boundary payment operations need
// idempotent handlers): webhook deliveries can and do repeat. Every write
// path here checks for an existing SaasPayment by gatewayPaymentId first,
// and the EventOutbox write uses a deterministic uniqueKey so a duplicate
// webhook delivery cannot produce a duplicate outbox event even if it
// somehow got past the SaasPayment check.

import {
  Injectable, Logger, NotFoundException,
  BadRequestException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { SaasGatewayFactory } from '../gateway/saas-gateway.factory';
import { EVENTS } from '../../../../core/events/events.constants';
import { RecordOfflinePaymentDto } from '../dto/record-offline-payment.dto';

@Injectable()
export class SaasPaymentService {
  private readonly logger = new Logger(SaasPaymentService.name);

  constructor(
    private readonly prisma:  PrismaService,
    private readonly gateway: SaasGatewayFactory,
  ) {}

  // ─── Create a gateway order for an outstanding invoice ─────────────────────

  async createOrder(invoiceId: string, requestingTenantId: string) {
    const invoice = await this.prisma.saasInvoice.findUnique({
      where:   { id: invoiceId },
      include: { subscription: true },
    });
    if (!invoice) throw new NotFoundException(`Invoice not found: ${invoiceId}`);

    // Tenant-ownership check: without this, any authenticated tenant admin
    // could pay (or merely probe the existence/amount of) another tenant's
    // invoice by guessing IDs. Superadmin-initiated flows should call this
    // with the invoice's own subscription.tenantId, not a hardcoded bypass.
    if (invoice.subscription.tenantId !== requestingTenantId) {
      throw new NotFoundException(`Invoice not found: ${invoiceId}`);
    }

    if (invoice.status === 'PAID') {
      throw new ConflictException('Invoice is already paid.');
    }
    if (invoice.status === 'CANCELLED' ) {
      throw new BadRequestException(`Cannot create a payment order for a ${invoice.status} invoice.`);
    }

    const adapter = await this.gateway.forTenant(invoice.subscription.tenantId);
    const order   = await adapter.createOrder(
      Number(invoice.totalAmount),
      invoice.currency,
      invoice.invoiceNumber,
    );

    // Record the attempt as PENDING up front -- if the process crashes
    // between here and the webhook arriving, there's still a row showing an
    // order was created, instead of the attempt vanishing entirely.
    const payment = await this.prisma.saasPayment.create({
      data: {
        saasInvoiceId:    invoice.id,
        gateway:          invoice.subscription.gateway ?? 'RAZORPAY',
        gatewayPaymentId: order.gatewayOrderId,
        amount:           invoice.totalAmount,
        currency:         invoice.currency,
        status:           'PENDING',
      },
    });

    this.logger.log(`Order created: invoice=${invoice.id} payment=${payment.id} gatewayOrderId=${order.gatewayOrderId}`);

    return {
      paymentId:      payment.id,
      gatewayOrderId: order.gatewayOrderId,
      gatewayKeyId:   order.gatewayKeyId,
      amount:         order.amount,
      currency:       order.currency,
    };
  }

  // ─── Webhook-confirmed payment verification (source of truth) ──────────────
  //
  // Called from the webhook controller AFTER WebhookHmacGuard has already
  // verified the raw request body's signature against RAZORPAY_SAAS_WEBHOOK_SECRET
  // (or the Stripe/PayPal equivalent) -- that is the authoritative proof this
  // request genuinely came from the gateway. There is no separate per-payment
  // signature to re-check here: that's a different Razorpay mechanism (the
  // client-checkout-flow signature, order_id|payment_id signed with the API
  // secret) meant for a frontend-initiated "confirm my payment" call, which
  // this is not. Conflating the two was an earlier mistake in this file --
  // corrected before merge, not after.

  async verifyAndRecordPayment(params: {
    gateway:          string;
    gatewayOrderId:   string;
    gatewayPaymentId: string;
  }) {
    const { gateway, gatewayOrderId, gatewayPaymentId } = params;

    // Idempotency: has this exact gateway payment already been recorded?
    // Webhook deliveries repeat (that's the gateway's retry contract, not a
    // bug) -- this must be a safe no-op on redelivery, not a double-charge
    // or a duplicate SAAS_INVOICE_PAID event.
    const existing = await this.prisma.saasPayment.findFirst({
      where: { gatewayPaymentId, status: 'SUCCESS' },
    });
    if (existing) {
      this.logger.log(`Duplicate webhook delivery ignored: gatewayPaymentId=${gatewayPaymentId} already SUCCESS`);
      return { alreadyProcessed: true, paymentId: existing.id };
    }

    const pendingPayment = await this.prisma.saasPayment.findFirst({
      where:   { gatewayPaymentId: gatewayOrderId, status: 'PENDING' },
      include: { saasInvoice: { include: { subscription: true } } },
    });
    if (!pendingPayment) {
      // Not necessarily an error -- could be a webhook for an order this
      // instance didn't create an order-tracking row for (e.g. a manual
      // gateway-side action). Log loudly rather than silently succeeding OR
      // silently failing; an ops person needs to see this.
      this.logger.warn(`Webhook received for unknown/already-resolved order: ${gatewayOrderId}`);
      throw new NotFoundException(`No pending payment found for gateway order ${gatewayOrderId}`);
    }

    // ARCH-006: this is the one owning transaction for "invoice paid" --
    // SaasPayment, SaasInvoice, TenantSubscription, and the outbox row all
    // move together or not at all.
    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.saasPayment.update({
        where: { id: pendingPayment.id },
        data:  { status: 'SUCCESS', gatewayPaymentId, paidAt: new Date() },
      });

      const invoice = await tx.saasInvoice.update({
        where: { id: pendingPayment.saasInvoiceId },
        data:  { status: 'PAID', paidAt: new Date() },
      });

      // Reactivate the subscription if it had lapsed. Any other status
      // (e.g. an already-ACTIVE subscription paying its next cycle
      // invoice) is left untouched -- this is a payment-driven transition
      // out of a lapsed state, not a generic "set to ACTIVE" hammer.
      if (['PAST_DUE', 'SUSPENDED'].includes(pendingPayment.saasInvoice.subscription.status)) {
        await tx.tenantSubscription.update({
          where: { id: pendingPayment.saasInvoice.subscriptionId },
          data:  { status: 'ACTIVE' },
        });
      }

      await tx.eventOutbox.create({
        data: {
          // Deterministic per-payment key: if this transaction were somehow
          // retried (it won't be, by Prisma, on success -- this is belt and
          // suspenders against any future retry wrapper), the unique
          // constraint prevents a second outbox row rather than a second
          // SAAS_INVOICE_PAID emission downstream.
          uniqueKey: `saas-invoice-paid:${invoice.id}`,
          type:      EVENTS.SAAS_INVOICE_PAID,
          payload: {
            core: { tenantId: pendingPayment.saasInvoice.subscription.tenantId },
            invoiceId:      invoice.id,
            subscriptionId: invoice.subscriptionId,
            paymentId:      payment.id,
            amount:         Number(invoice.totalAmount),
            currency:       invoice.currency,
            gateway,
          },
        },
      });

      return { payment, invoice };
    });

    this.logger.log(`Payment SUCCESS: invoice=${result.invoice.id} payment=${result.payment.id}`);
    return { success: true, paymentId: result.payment.id, invoiceId: result.invoice.id };
  }

  // ─── Explicit payment-failed webhook (gateway-reported, not a signature
  //     mismatch) — e.g. Razorpay's `payment.failed` event type ──────────────

  async recordPaymentFailure(params: { gatewayOrderId: string; reason: string }) {
    const pendingPayment = await this.prisma.saasPayment.findFirst({
      where:   { gatewayPaymentId: params.gatewayOrderId, status: 'PENDING' },
      include: { saasInvoice: { include: { subscription: true } } },
    });
    if (!pendingPayment) {
      this.logger.warn(`payment.failed webhook for unknown/already-resolved order: ${params.gatewayOrderId}`);
      return { handled: false };
    }

    await this.prisma.saasPayment.update({
      where: { id: pendingPayment.id },
      data:  { status: 'FAILED', failureReason: params.reason },
    });

    await this.writeOutboxEvent({
      uniqueKey: `saas-payment-failed:${pendingPayment.id}`,
      type:      EVENTS.SAAS_PAYMENT_FAILED,
      payload: {
        core: { tenantId: pendingPayment.saasInvoice.subscription.tenantId },
        invoiceId: pendingPayment.saasInvoiceId,
        paymentId: pendingPayment.id,
        reason:    params.reason,
      },
    });

    this.logger.warn(`Payment FAILED (gateway-reported): order=${params.gatewayOrderId} reason=${params.reason}`);
    return { handled: true, paymentId: pendingPayment.id };
  }

  // ─── Offline / manual payment (bank transfer, cheque) ───────────────────────
  //
  // Finance-verified before this is ever called (see RecordOfflinePaymentDto
  // -- `reference` is not itself verified against anything here; the human
  // calling this endpoint already checked the bank statement). This is
  // deliberate, per the commercial architecture discussion: never auto-trust
  // a tenant's "I paid" claim, but a Finance-role-gated manual entry is the
  // correct trust boundary for genuinely offline money movement.

  async recordOfflinePayment(invoiceId: string, dto: RecordOfflinePaymentDto, actorId: string) {
    const invoice = await this.prisma.saasInvoice.findUnique({
      where:   { id: invoiceId },
      include: { subscription: true },
    });
    if (!invoice) throw new NotFoundException(`Invoice not found: ${invoiceId}`);
    if (invoice.status === 'PAID') throw new ConflictException('Invoice is already paid.');

    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.saasPayment.create({
        data: {
          saasInvoiceId:    invoice.id,
          gateway:          'CASH',
          gatewayPaymentId: `offline:${dto.reference}`,
          amount:           dto.amount,
          currency:         invoice.currency,
          status:           'SUCCESS',
          paidAt:           new Date(),
        },
      });

      const updatedInvoice = await tx.saasInvoice.update({
        where: { id: invoice.id },
        data:  { status: 'PAID', paidAt: new Date() },
      });

      if (['PAST_DUE', 'SUSPENDED'].includes(invoice.subscription.status)) {
        await tx.tenantSubscription.update({
          where: { id: invoice.subscriptionId },
          data:  { status: 'ACTIVE' },
        });
      }

      await tx.eventOutbox.create({
        data: {
          uniqueKey: `saas-invoice-paid:${updatedInvoice.id}`,
          type:      EVENTS.SAAS_INVOICE_PAID,
          payload: {
            core: { tenantId: invoice.subscription.tenantId },
            invoiceId:      updatedInvoice.id,
            subscriptionId: updatedInvoice.subscriptionId,
            paymentId:      payment.id,
            amount:         dto.amount,
            currency:       invoice.currency,
            gateway:        'CASH',
            recordedBy:     actorId,
            reference:      dto.reference,
          },
        },
      });

      return { payment, invoice: updatedInvoice };
    });

    this.logger.log(`Offline payment recorded: invoice=${result.invoice.id} by=${actorId} ref=${dto.reference}`);
    return { success: true, paymentId: result.payment.id, invoiceId: result.invoice.id };
  }

  // ─── Shared outbox-write helper (for the non-transactional failure path) ───

  private async writeOutboxEvent(event: { uniqueKey: string; type: string; payload: any }) {
    try {
      await this.prisma.eventOutbox.create({ data: event });
    } catch (err: any) {
      // Unique constraint violation = this exact event was already recorded
      // (duplicate webhook delivery) -- that's the idempotency working as
      // intended, not an error.
      if (err?.code === 'P2002') {
        this.logger.log(`Outbox event already recorded (idempotent skip): ${event.uniqueKey}`);
        return;
      }
      // Any other failure here must not be swallowed -- an event that
      // silently fails to queue is exactly the fail-open pattern removed
      // from license enforcement in PR-1. Log loudly; let it propagate.
      this.logger.error(`Failed to write outbox event ${event.uniqueKey}: ${err instanceof Error ? err.message : err}`);
      throw err;
    }
  }
}
