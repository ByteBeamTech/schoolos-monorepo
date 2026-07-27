// modules/student-billing/refund/refund.service.ts
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { Prisma } from '@prisma/client';
import { AuditService }  from '../../../core/compliance/audit.service';
import { ConfigService } from '@nestjs/config';
import { LedgerService } from '../ledger/services/ledger.service';

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
    private readonly ledger:  LedgerService,
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

  async initiate(
    tenantId: string,
    dto: InitiateRefundDto,
    actorId: string,
    actorRole: string,
  ) {
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
        .reduce((sum: Prisma.Decimal, r: any) => sum.plus(new Prisma.Decimal(r.amount)), new Prisma.Decimal(0));

      // Money comparison in Decimal (D-9). dto.amount is a validated number
      // from the DTO; the payment amount and prior refunds are Decimals.
      const maxRefund = new Prisma.Decimal(payment.amount).minus(alreadyRefunded);
      if (new Prisma.Decimal(dto.amount).greaterThan(maxRefund)) {
        throw new BadRequestException(`Refund amount ${dto.amount} exceeds available ${maxRefund.toString()}`);
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
        (sum: Prisma.Decimal, r: any) => sum.plus(new Prisma.Decimal(r.amount)),
        new Prisma.Decimal(0),
      );
      const isFullRefund = totalRefunded.greaterThanOrEqualTo(new Prisma.Decimal(payment.amount));

      await tx.payment.update({
        where: { id: dto.paymentId },
        data:  { status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
      });

      // Recompute the invoice from its OWN current state, inside this
      // transaction -- never from the Phase-1 snapshot, which predates the
      // gateway round trip and may be stale (e.g. a late fee assessed in
      // between).
      //
      // BUG FIXED HERE: the previous code set paidAmount: 0 /
      // dueAmount: totalAmount on a full refund of THIS payment. When the
      // invoice had more than one successful payment (partial payments /
      // instalments -- the case FEE-1 exists to support), that erased every
      // OTHER payment's contribution and re-billed the parent for money the
      // school still holds. isFullRefund is a property of the payment, not of
      // the invoice, and must never be applied as if it cleared the invoice.
      //
      // Correct model: an invoice's paid amount is the sum of the amounts its
      // successful payments have actually retained after refunds. Recompute
      // that from the remaining payments and derive due/status from it.
      const invoice = await tx.invoice.findFirst({
        where:  { id: payment.invoiceId, tenantId },
        select: { id: true, totalAmount: true, studentId: true },
      });

      if (invoice) {
        // Sum, per successful payment on this invoice, the amount NOT yet
        // refunded (COMPLETED refunds only -- PENDING has not moved money out
        // of the invoice's retained total, FAILED never will).
        const invoicePayments = await tx.payment.findMany({
          where:   { invoiceId: invoice.id, tenantId, status: { in: ['SUCCESS', 'PARTIALLY_REFUNDED', 'REFUNDED'] } },
          select:  { amount: true, refunds: { where: { status: 'COMPLETED' }, select: { amount: true } } },
        });

        const retained = invoicePayments.reduce((sum: Prisma.Decimal, p: any) => {
          const refunded = p.refunds.reduce(
            (s: Prisma.Decimal, r: any) => s.plus(new Prisma.Decimal(r.amount)),
            new Prisma.Decimal(0),
          );
          const net = new Prisma.Decimal(p.amount).minus(refunded);
          return sum.plus(net.isNegative() ? new Prisma.Decimal(0) : net);
        }, new Prisma.Decimal(0));

        const total       = new Prisma.Decimal(invoice.totalAmount);
        const paidAmount  = Prisma.Decimal.min(retained, total);
        const dueRaw      = total.minus(paidAmount);
        const dueAmount   = dueRaw.isNegative() ? new Prisma.Decimal(0) : dueRaw;
        const fullyPaid   = dueAmount.lessThanOrEqualTo(0) && total.greaterThan(0);

        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            paidAmount,
            dueAmount,
            // Only a fully-drained invoice returns to SENT. A partially-paid
            // invoice stays PARTIALLY_PAID; a still-fully-covered one stays
            // PAID. Never assume the refund emptied it.
            status: fullyPaid ? 'PAID' : (paidAmount.greaterThan(0) ? 'PARTIALLY_PAID' : 'SENT'),
            paidAt: fullyPaid ? undefined : null,
          },
        });
      }

      // M2 (redesigned roadmap, §4.9): REFUND_COMPLETED, posted exactly
      // once per settlement -- this is Phase 3, reached only once the
      // gateway refund has actually completed; a retry of a failed Phase 3
      // write rolls back the whole transaction (ledger entry included)
      // via Prisma's own transaction semantics, so no partial post is
      // possible. completedRefund.amount is THIS refund's amount, not the
      // cumulative totalRefunded figure computed above.
      await this.ledger.recordRefundCompleted(tx, {
        tenantId,
        branchId:  payment.branchId,
        studentId: invoice?.studentId ?? null,
        occurredAt: new Date(),
        amount: completedRefund.amount,
        referenceId: completedRefund.id,
        metadata: { paymentId: dto.paymentId, invoiceId: payment.invoiceId },
      });

      // IMM-022/023: the audit row now joins THIS transaction, so it commits
      // or rolls back with the settlement it describes. AuditService.log()
      // accepts a transaction client as of the audit-hardening change; pass
      // the settlement tx.
      await this.audit.log(
        {
          tenantId,
          actorId,
          // The authenticated caller's role, threaded from the controller,
          // replaces the previously hardcoded 'ACCOUNTANT' -- which lied
          // whenever anyone else (admin, principal) issued a refund, exactly
          // the attribution an auditor needs in a dispute.
          actorRole:  actorRole as any,
          // REFUND_PROCESSED is the valid AuditAction enum member (a prior
          // value, REFUND_INITIATED, was not in the enum and silently
          // produced no audit row).
          action:     'REFUND_PROCESSED' as any,
          entityType: 'Payment',
          entityId:   dto.paymentId,
          after:      { refundId: refund.id, amount: dto.amount, reason: dto.reason },
        },
        tx,
      );

      return { completedRefund, isFullRefund };
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
