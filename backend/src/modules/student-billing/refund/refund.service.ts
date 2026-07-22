// modules/student-billing/refund/refund.service.ts
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService }  from '../../../core/compliance/audit.service';
import { ConfigService } from '@nestjs/config';

export interface InitiateRefundDto {
  paymentId: string;
  amount:    number;
  reason:    string;
}

/**
 * Refund statuses that have already committed money and therefore consume the
 * refundable balance. RefundStatus is PENDING | COMPLETED | FAILED; FAILED is
 * excluded because no money moved.
 */
const CONSUMING_REFUND_STATUSES = ['PENDING', 'COMPLETED'];

@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  constructor(
    private readonly prisma:  PrismaService,
    private readonly audit:   AuditService,
    private readonly config:  ConfigService,
  ) {}

  /**
   * LOCK SCOPE
   * ----------
   * One advisory transaction lock per Payment.
   *
   * Guarantees that only one refund reservation for the SAME payment can
   * execute concurrently. Refunds against different payments never block each
   * other, and no other operation in the system takes this lock -- the
   * protected aggregate is the Payment's refundable balance (the payment row
   * plus its Refund children), nothing wider.
   *
   * The lock is held only for validation + reservation (Phase 1) and is
   * released when that transaction commits -- deliberately NOT across the
   * gateway call.
   *
   * Deterministic 31-bit key (int4-safe for pg_advisory_xact_lock), hashed the
   * same way InvoiceService hashes its numbering-lock keys: reusing the
   * codebase's established concurrency primitive rather than introducing a
   * second one. Note the keyspace is shared process-wide, so a collision with
   * another advisory lock key would only cost spurious serialization, never
   * correctness.
   */
  private lockKeyFor(paymentId: string): number {
    return paymentId
      .split('')
      .reduce((acc, ch) => ((acc * 31 + ch.charCodeAt(0)) & 0x7fffffff), 0);
  }

  async initiate(tenantId: string, dto: InitiateRefundDto, actorId: string) {
    // ── Phase 1 (transactional): serialize, validate, reserve ──────────────
    //
    // FEE-1 CONCURRENCY FIX: read-decide-write previously spanned separate
    // statements with no transaction and no lock, so two concurrent requests
    // could both read the same refund history, both pass the over-refund
    // guard, and both create a refund -- refunding more than was paid.
    //
    // A transaction alone does NOT fix this: under Postgres' default READ
    // COMMITTED isolation both transactions can read before either commits.
    // pg_advisory_xact_lock keyed on the payment serializes refund attempts
    // for THAT payment (and only that payment -- refunds against other
    // payments are unaffected). The lock is transaction-scoped and released
    // on commit. Same primitive InvoiceService already uses for numbering.
    //
    // The PENDING refund row created here is the reservation: because PENDING
    // counts toward alreadyRefunded, a second request entering this block
    // sees it and is rejected.
    const { refund, payment } = await this.prisma.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock($1)`,
        this.lockKeyFor(dto.paymentId),
      );

      const payment = await tx.payment.findFirst({
        where:   { id: dto.paymentId, tenantId },
        include: { invoice: true, refunds: true },
      });

      if (!payment) throw new NotFoundException('Payment not found');
      if (payment.status !== 'SUCCESS' && payment.status !== 'PARTIALLY_REFUNDED') {
        throw new BadRequestException('Only successful payments can be refunded');
      }

      // Calculate already-refunded amount from Refund records (Payment has no
      // refundedAmount field).
      //
      // PENDING is counted deliberately, not just COMPLETED: an in-flight
      // refund has already committed that money. Excluding it would let a
      // second request pass the guard while the first is still at the
      // gateway. Trade-off accepted: a refund stuck in PENDING (process died
      // mid-gateway-call) holds its amount until an operator resolves it --
      // the correct failure direction for money movement.
      // FAILED is excluded: no money moved.
      const alreadyRefunded = payment.refunds
        .filter((r: any) => CONSUMING_REFUND_STATUSES.includes(r.status))
        .reduce((sum: number, r: any) => sum + Number(r.amount), 0);

      const maxRefund = Number(payment.amount) - alreadyRefunded;
      if (dto.amount > maxRefund) {
        throw new BadRequestException(`Refund amount ${dto.amount} exceeds available ${maxRefund}`);
      }

      const refund = await tx.refund.create({
        data: {
          tenantId,
          branchId:    payment.branchId,
          paymentId:   dto.paymentId,
          amount:      dto.amount,
          reason:      dto.reason,
          status:      'PENDING',
          gateway:     payment.gateway,  // required field — copy from payment
          initiatedBy: actorId,
        },
      });

      return { refund, payment };
    });

    // ── Phase 2: gateway call, deliberately OUTSIDE any transaction ────────
    //
    // Never hold a database transaction (and its advisory lock) open across a
    // network call to a payment provider: it pins a connection and blocks
    // every other refund on this payment for the duration of an external
    // round trip, which may hang until timeout.
    let gatewayRefundId = '';
    try {
      gatewayRefundId = await this.processGatewayRefund(payment, dto.amount);
    } catch (err: any) {
      // No failureReason field on Refund — record the cause in reason.
      // Releases the reservation: FAILED does not count toward alreadyRefunded.
      await this.prisma.refund.update({
        where: { id: refund.id },
        data:  { status: 'FAILED', reason: `${dto.reason} | FAILED: ${err.message}` },
      });
      throw new BadRequestException(`Gateway refund failed: ${err.message}`);
    }

    // ── Phase 3 (transactional): settle ────────────────────────────────────
    //
    // Refund completion, payment status and invoice reopening move together
    // or not at all. Previously these were three independent writes: a crash
    // between them could leave a COMPLETED refund against a payment still
    // marked SUCCESS, or a fully-refunded payment against a PAID invoice.
    //
    // Totals are recomputed from the database inside this transaction rather
    // than carried over from Phase 1, so the payment's status reflects
    // committed state at settlement time.
    const settled = await this.prisma.$transaction(async (tx: any) => {
      const completedRefund = await tx.refund.update({
        where: { id: refund.id },
        data:  { status: 'COMPLETED', gatewayRefundId, processedAt: new Date() },
      });

      const completed = await tx.refund.findMany({
        where:  { paymentId: dto.paymentId, status: 'COMPLETED' },
        select: { amount: true },
      });
      const totalRefunded = completed.reduce(
        (sum: number, r: any) => sum + Number(r.amount),
        0,
      );
      const isFullRefund = totalRefunded >= Number(payment.amount);

      await tx.payment.update({
        where: { id: dto.paymentId },
        data:  { status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
      });

      // Reopen invoice if fully refunded
      if (isFullRefund) {
        await tx.invoice.update({
          where: { id: payment.invoiceId },
          data: {
            status:     'SENT',
            paidAmount: 0,
            dueAmount:  payment.invoice.totalAmount,
            paidAt:     null,
          },
        });
      }

      return { completedRefund, isFullRefund };
    });

    // NOTE (IMM-022/023): this audit write is still outside the settlement
    // transaction, because AuditService.log() writes through its own injected
    // PrismaService and cannot join a caller's transaction. Making financial
    // audit entries transactional requires AuditService to accept a
    // transaction client -- a cross-cutting change to a core service used by
    // every module, deliberately not bundled into this refund fix.
    await this.audit.log({
      tenantId,
      actorId,
      actorRole:  'ACCOUNTANT' as any,
      // FEE-1 CORRECTNESS FIX: 'REFUND_INITIATED' is not a member of the
      // AuditAction enum -- Prisma rejected it with
      // PrismaClientValidationError, which AuditService.log() swallows in its
      // own try/catch, so every refund silently produced NO audit trail.
      // REFUND_PROCESSED is the only valid refund action in the enum.
      //
      // NOTE: AuditLogParams.action is typed 'any', so neither the old value
      // nor this one is compile-checked. That untyped interface is the root
      // cause of this recurring bug class. Retyping it to AuditAction touches
      // every audit call site across every module -- out of scope for FEE-1,
      // but worth its own task.
      action:     'REFUND_PROCESSED' as any,
      entityType: 'Payment',
      entityId:   dto.paymentId,
      after:      { refundId: refund.id, amount: dto.amount, reason: dto.reason },
    });

    this.logger.log(`Refund processed: ${refund.id} amount=${dto.amount} gateway=${gatewayRefundId}`);
    return { refund: { ...settled.completedRefund, gatewayRefundId } };
  }

  private async processGatewayRefund(payment: any, amount: number): Promise<string> {
    switch (String(payment.gateway)) {
      case 'RAZORPAY': return this.razorpayRefund(payment.gatewayPaymentId, amount);
      case 'STRIPE':   return this.stripeRefund(payment.gatewayPaymentId, amount, String(payment.currency));
      case 'PAYPAL':   return this.paypalRefund(payment.gatewayPaymentId, amount, String(payment.currency));
      default:
        this.logger.warn(`Offline refund recorded for payment ${payment.id}`);
        return `MANUAL-REFUND-${Date.now()}`;
    }
  }

  private async razorpayRefund(paymentId: string, amount: number): Promise<string> {
    const keyId     = this.config.get<string>('RAZORPAY_STUDENT_KEY_ID', '');
    const keySecret = this.config.get<string>('RAZORPAY_STUDENT_KEY_SECRET', '');
    if (!keyId || keyId.includes('xxx')) return `rfnd_mock_${Date.now()}`;
    const Razorpay = require('razorpay');
    const rzp      = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const refund   = await rzp.payments.refund(paymentId, { amount: Math.round(amount * 100) });
    return refund.id;
  }

  private async stripeRefund(chargeId: string, amount: number, currency: string): Promise<string> {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY', '');
    if (!secretKey || secretKey.includes('xxx')) return `re_mock_${Date.now()}`;
    const Stripe = require('stripe');
    const stripe = new Stripe(secretKey);
    const refund = await stripe.refunds.create({ charge: chargeId, amount: Math.round(amount * 100), currency: currency.toLowerCase() });
    return refund.id;
  }

  private async paypalRefund(captureId: string, amount: number, currency: string): Promise<string> {
    const clientId     = this.config.get<string>('PAYPAL_CLIENT_ID', '');
    const clientSecret = this.config.get<string>('PAYPAL_CLIENT_SECRET', '');
    if (!clientId || clientId.includes('xxx')) return `PAYPAL-REFUND-mock-${Date.now()}`;
    const tokenRes = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    const { access_token } = await tokenRes.json() as any;
    const refundRes = await fetch(`https://api-m.paypal.com/v2/payments/captures/${captureId}/refund`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: { value: amount.toFixed(2), currency_code: currency } }),
    });
    const refund = await refundRes.json() as any;
    return refund.id;
  }

  async listRefunds(tenantId: string, paymentId?: string) {
    return this.prisma.refund.findMany({
      where:   { tenantId, ...(paymentId ? { paymentId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }
}
