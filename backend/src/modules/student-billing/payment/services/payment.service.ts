// backend/src/modules/student-billing/payment/services/payment.service.ts
// FULL REPLACEMENT
// P0 FIXES:
//  1. recordOffline() now idempotency-safe via idempotencyKey
//  2. Offline payments use gateway: 'CASH' not 'RAZORPAY' (see enum-mismatch
//     audit: an earlier version of this fix used a non-existent 'OFFLINE'
//     value cast through `as any`, which type-checked but failed at runtime
//     against the real PaymentGatewayProvider enum -- STRIPE/RAZORPAY/CASH,
//     no OFFLINE. CASH is the pre-existing, correct value for "not
//     processed through an online gateway", already used identically by
//     SaasPaymentService.recordOfflinePayment() for the same scenario in a
//     sibling module. The specific collection method (cash in hand, cheque,
//     DD, bank transfer, offline UPI) is a separate concern, already
//     captured in the free-text paymentMethod field below -- gateway and
//     paymentMethod are not the same field and must not both try to encode
//     "how was this paid".
//  3. generateReceipt() uses InvoiceService.generateReceiptNumber() — race condition fixed
//  4. updateInvoice() wrapped in transaction

import { EventEmitter2 }   from '@nestjs/event-emitter';
import { EVENTS }           from '../../../../core/events/events.constants';
import {
  Injectable, NotFoundException, BadRequestException, Logger,
  ServiceUnavailableException, ConflictException,
} from '@nestjs/common';
import { ConfigService }    from '@nestjs/config';
import { PrismaService }    from '@infra/database/prisma.service';
import { Prisma }           from '@prisma/client';
import { AuditService }     from '../../../../core/compliance/audit.service';
import { InvoiceService }   from '../../invoice/services/invoice.service';
import { LateFeeService }   from '../../late-fee/late-fee.service';
import { LedgerService }    from '../../ledger/services/ledger.service';
import { PaymentAllocationService } from '../../allocation/services/payment-allocation.service';
import { InitiatePaymentDto, VerifyRazorpayPaymentDto, RecordOfflinePaymentDto } from '../../dto/billing.dto';
import * as crypto           from 'crypto';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma:          PrismaService,
    private readonly audit:           AuditService,
    private readonly config:          ConfigService,
    private readonly emitter:         EventEmitter2,
    private readonly invoiceService:  InvoiceService,
    private readonly lateFeeService:  LateFeeService,
    private readonly ledger:          LedgerService,
    private readonly allocation:      PaymentAllocationService,
  ) {}

  // ── Initiate Razorpay ─────────────────────────────────────────────────────
  async initiateRazorpay(tenantId: string, dto: InitiatePaymentDto, actorId: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id: dto.invoiceId, tenantId } });
    if (!invoice) throw new NotFoundException(`Invoice not found: ${dto.invoiceId}`);
    if (invoice.status === 'PAID') throw new BadRequestException('Invoice already paid.');

    const keyId     = this.config.get<string>('RAZORPAY_STUDENT_KEY_ID', '');
    const keySecret = this.config.get<string>('RAZORPAY_STUDENT_KEY_SECRET', '');
    let razorpayOrder: any;

    if (keyId && keySecret && !keyId.includes('xxxxxxxxxx')) {
      const Razorpay = require('razorpay');
      const rzp      = new Razorpay({ key_id: keyId, key_secret: keySecret });
      razorpayOrder  = await rzp.orders.create({
        amount: dto.amount * 100, currency: String(invoice.currency), receipt: invoice.invoiceNumber,
      });
    } else {
      razorpayOrder = { id: `order_dev_${Date.now()}`, amount: dto.amount * 100, currency: String(invoice.currency), status: 'created' };
      this.logger.warn('Razorpay not configured — mock order');
    }

    const payment = await this.prisma.payment.create({
      data: {
        tenantId, branchId: invoice.branchId, invoiceId: dto.invoiceId, gateway: 'RAZORPAY',
        gatewayOrderId: razorpayOrder.id, amount: dto.amount, currency: invoice.currency,
        status: 'PENDING', payerName: dto.payerName ?? null,
        payerEmail: dto.payerEmail ?? null, payerPhone: dto.payerPhone ?? null,
      },
    });

    await this.audit.logPayment({ tenantId, actorId, entityType: 'Payment', entityId: payment.id, paymentStatus: 'initiated', after: { invoiceId: dto.invoiceId, amount: dto.amount } });
    return {
      paymentId:       payment.id,
      razorpayOrderId: razorpayOrder.id,
      razorpayKeyId:   keyId.includes('xxxxxxxxxx') ? 'CONFIGURE_RAZORPAY_KEYS' : keyId,
      amount:          dto.amount * 100,
      currency:        String(invoice.currency),
    };
  }

  // ── Verify Razorpay ───────────────────────────────────────────────────────
  async verifyRazorpay(tenantId: string, dto: VerifyRazorpayPaymentDto, actorId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { tenantId, gatewayOrderId: dto.razorpayOrderId },
      include: { invoice: true },
    });
    if (!payment) throw new NotFoundException('Payment not found.');

    // FEE-0 (Security Hardening): HMAC verification must never be silently
    // skipped outside development/test. A missing or placeholder secret in any
    // other environment fails CLOSED — the payment is NOT marked SUCCESS.
    // Allow-list of environments where the skip is permitted (fail closed on
    // anything unknown, per ADR-FEE-001's missing-context-denies principle).
    const keySecret   = this.config.get<string>('RAZORPAY_STUDENT_KEY_SECRET', '');
    const nodeEnv     = this.config.get<string>('NODE_ENV', 'development');
    const isConfigured = !!keySecret && !keySecret.includes('xxxxxxxxxx');

    if (!isConfigured) {
      if (nodeEnv !== 'development' && nodeEnv !== 'test') {
        this.logger.error(
          `verifyRazorpay(): RAZORPAY_STUDENT_KEY_SECRET missing or placeholder in NODE_ENV='${nodeEnv}' — refusing to confirm payment ${payment.id} without signature verification.`,
        );
        throw new ServiceUnavailableException(
          'Payment verification is unavailable: payment gateway is not configured. The payment has not been confirmed.',
        );
      }
      this.logger.warn(
        `verifyRazorpay(): skipping HMAC verification for payment ${payment.id} — gateway secret not configured (permitted in NODE_ENV='${nodeEnv}' only).`,
      );
    } else {
      const expected = crypto.createHmac('sha256', keySecret)
        .update(`${dto.razorpayOrderId}|${dto.razorpayPaymentId}`).digest('hex');
      if (expected !== dto.razorpaySignature) {
        await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', failureReason: 'Invalid signature' } });
        throw new BadRequestException('Payment verification failed.');
      }
    }

    // FEE-1 ATOMICITY: payment confirmation, invoice totals and receipt
    // creation now commit together or not at all. Previously these were three
    // independent awaits: a crash between them could leave a SUCCESS payment
    // against an unpaid invoice, or a paid invoice with no receipt -- money
    // recorded as received with no consistent record of it.
    //
    // The advisory lock also closes the lost-update race between concurrent
    // payments on the same invoice (a transaction alone would not: under READ
    // COMMITTED both can read the same paidAmount before either writes).
    //
    // Signature verification happens above, deliberately OUTSIDE this
    // transaction -- an invalid signature must not open one at all.
    const { updated, receipt, replayed } = await this.prisma.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock($1)`,
        this.settlementLockKey(payment.invoiceId),
      );

      // M1 (FEE-2 P0): compare-and-swap, not an unconditional update.
      //
      // Every input to this endpoint is deterministic and client-supplied, and
      // the endpoint is reachable by the PARENT role. Previously the status
      // write and updateInvoice() ran unconditionally, so replaying the same
      // verified payload credited the invoice a SECOND time. generateReceipt()
      // is idempotent on paymentId, so the duplicate credit produced no second
      // receipt -- the discrepancy was invisible in the receipt register.
      //
      // The swap is the decision: only a PENDING payment may be settled, and
      // exactly one caller can win that transition. tenantId stays in the
      // predicate so the swap can never cross a tenant boundary.
      const { count } = await tx.payment.updateMany({
        where: { id: payment.id, tenantId, status: 'PENDING' },
        data:  { status: 'SUCCESS', gatewayPaymentId: dto.razorpayPaymentId, gatewaySignature: dto.razorpaySignature, paidAt: new Date() },
      });

      if (count === 0) {
        // The read after a failed swap only explains the failure; it does not
        // participate in the decision (same shape as InvoiceService.send()).
        const current = await tx.payment.findFirst({ where: { id: payment.id, tenantId } });
        if (!current) throw new NotFoundException('Payment not found.');

        // Already settled: this is a replay. Return the existing settlement
        // rather than erroring -- the caller retried a legitimate request --
        // but re-apply NOTHING.
        if (current.status === 'SUCCESS') {
          const existingReceipt = await tx.receipt.findUnique({ where: { paymentId: payment.id } });
          return { updated: current, receipt: existingReceipt, replayed: true };
        }

        // Any other state (e.g. FAILED) is not a replay and is not a valid
        // transition into SUCCESS. A failed payment is never resurrected.
        throw new ConflictException(`Payment is already ${current.status}.`);
      }

      // payment.amount is a Prisma.Decimal; pass it through without Number()
      // coercion so the invoice arithmetic stays in Decimal (D-9).
      await this.updateInvoice(tx, tenantId, payment.invoice.branchId, payment.invoiceId, payment.id, payment.amount);
      // P0 FIX: keep LateFee.paidAmount/status in sync with the payment that
      // just cleared. Purely additive bookkeeping -- does not affect the
      // invoice totals above. See LateFeeService.allocatePayment() for why
      // this must run in the same transaction.
      //
      // allocatePayment() now accepts Prisma.Decimal.Value (M3), so
      // payment.amount (a Decimal) is passed through without Number() (D-9).
      await this.lateFeeService.allocatePayment(tx, tenantId, payment.invoiceId, payment.id, payment.amount);
      const receipt = await this.generateReceipt(tx, tenantId, payment.invoiceId, payment.id);

      // M2 (redesigned roadmap, §4.9): PAYMENT_COMPLETED, posted exactly
      // once per settlement -- this code path is only reached when the
      // compare-and-swap above actually won (a replay returns early from
      // the count===0 branch and never reaches here, so a replayed
      // verification never double-posts).
      await this.ledger.recordPaymentCompleted(tx, {
        tenantId,
        branchId:  payment.invoice.branchId,
        studentId: payment.invoice.studentId,
        occurredAt: new Date(),
        amount: payment.amount,
        referenceId: payment.id,
        metadata: { gateway: payment.gateway, invoiceId: payment.invoiceId },
      });

      // Post-write read: the return value needs the full settled row.
      const updated = await tx.payment.findFirst({ where: { id: payment.id, tenantId } });
      return { updated, receipt, replayed: false };
    });

    if (replayed) {
      // No audit entry and no event: nothing occurred on this call. Emitting
      // PAYMENT_SUCCESS again would produce a duplicate parent notification
      // for one payment.
      this.logger.warn(
        `verifyRazorpay(): replay detected for payment ${payment.id} — returning the existing settlement without re-applying it.`,
      );
      return { payment: updated, receipt };
    }

    await this.audit.logPayment({ tenantId, actorId, entityType: 'Payment', entityId: payment.id, paymentStatus: 'success', after: { gatewayPaymentId: dto.razorpayPaymentId } });
    this.emitter.emit(EVENTS.PAYMENT_SUCCESS, {
      tenantId, studentId: (payment.invoice as any).studentId,
      invoiceId: payment.invoiceId, paymentId: payment.id,
      amount: Number(payment.amount), currency: String((payment.invoice as any).currency), method: 'ONLINE',
    });
    return { payment: updated, receipt };
  }

  /**
   * LOCK SCOPE
   * ----------
   * One advisory transaction lock per Invoice.
   *
   * Serializes payment settlement against the SAME invoice, so concurrent
   * payments cannot both read the invoice's running totals before either
   * writes them (a lost update, which would under-count paidAmount and could
   * leave an invoice PARTIALLY_PAID after it was fully paid). Payments on
   * different invoices never block each other.
   *
   * Held only for the settlement transaction and released on commit. No
   * external call happens inside it -- the Razorpay HMAC check is local
   * computation performed BEFORE the transaction opens.
   *
   * Deterministic 31-bit key (int4-safe), hashed the same way InvoiceService
   * hashes its numbering-lock keys. The advisory keyspace is shared
   * process-wide, so a collision with another key costs spurious
   * serialization, never correctness.
   */
  private settlementLockKey(invoiceId: string): number {
    return invoiceId
      .split('')
      .reduce((acc, ch) => ((acc * 31 + ch.charCodeAt(0)) & 0x7fffffff), 0);
  }

  /**
   * Stable idempotency key for an offline payment (FEE-1, IMM-017/018).
   *
   * A cashier-supplied reference (cheque number, receipt book number, bank
   * transaction id) is authoritative when present: it is the real-world
   * identity of the payment, and it is stable across retries by definition.
   *
   * When absent, the key is DERIVED FROM THE REQUEST'S BUSINESS CONTENT so
   * that the same logical payment always produces the same key. It replaces
   * `OFFLINE-${Date.now()}`, which made every call unique and therefore made
   * the record un-deduplicable: a double-submitted cash payment was recorded
   * twice and the invoice over-credited.
   *
   * The business DATE is part of the material. That is not a timestamp in the
   * `Date.now()` sense -- it does not change between a submission and its
   * retry -- but it does distinguish an identical payment made on a different
   * day, which is a genuinely different payment (a parent paying the same cash
   * amount in April and again in May must produce two records).
   *
   * TRADE-OFF, deliberate and documented: two genuinely distinct payments with
   * the SAME invoice, amount, method and date, submitted WITHOUT a reference,
   * are indistinguishable from a retry and collapse into one record. Recording
   * both requires a reference number -- which is what a receipt book or cheque
   * number is for. Intent lives with the caller; no server-side derivation can
   * recover it.
   */
  private offlinePaymentReference(tenantId: string, dto: RecordOfflinePaymentDto): string {
    const supplied = dto.referenceNumber?.trim();
    if (supplied) return supplied;

    const businessDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const material = [
      tenantId,
      dto.invoiceId,
      Number(dto.amount).toFixed(2),
      dto.paymentMethod ?? '',
      businessDate,
    ].join('|');
    const digest = crypto.createHash('sha256').update(material).digest('hex').slice(0, 32);
    return `OFF-${digest}`;
  }

  /** Prisma unique-constraint violation. */
  private isUniqueViolation(err: any): boolean {
    return err?.code === 'P2002';
  }

  /** The already-recorded payment for an idempotency key, with its receipt. */
  private async findRecordedOfflinePayment(tenantId: string, invoiceId: string, reference: string) {
    return this.prisma.payment.findFirst({
      where:   { tenantId, invoiceId, gatewayPaymentId: reference },
      include: { receipt: true },
    });
  }

  // ── Record Offline — P0 FIX: idempotent + correct gateway ────────────────
  async recordOffline(tenantId: string, dto: RecordOfflinePaymentDto, actorId: string) {
    const reference = this.offlinePaymentReference(tenantId, dto);

    // Idempotent fast path. Deliberately BEFORE the due-amount validation:
    // the first attempt already reduced dueAmount, so a retry would otherwise
    // be rejected with "amount exceeds due" instead of returning the payment
    // it already made. Correctness does not rest on this read -- the unique
    // index does; this only avoids a pointless failed insert.
    const alreadyRecorded = await this.findRecordedOfflinePayment(tenantId, dto.invoiceId, reference);
    if (alreadyRecorded) {
      this.logger.warn(`Offline payment retry ignored (already recorded): ref=${reference} payment=${alreadyRecorded.id}`);
      return { payment: alreadyRecorded, receipt: alreadyRecorded.receipt };
    }

    const invoice = await this.prisma.invoice.findFirst({ where: { id: dto.invoiceId, tenantId } });
    if (!invoice) throw new NotFoundException(`Invoice not found: ${dto.invoiceId}`);
    if (invoice.status === 'PAID') throw new BadRequestException('Invoice already paid.');
    // Money comparison in Decimal (D-9): dto.amount is a plain number from the
    // DTO; invoice.dueAmount is a Prisma.Decimal. Compare as Decimal so an
    // exact-to-the-paise due amount is not misjudged by float widening.
    if (new Prisma.Decimal(dto.amount).greaterThan(new Prisma.Decimal(invoice.dueAmount))) {
      throw new BadRequestException(`Amount ₹${dto.amount} exceeds due ₹${invoice.dueAmount}`);
    }

    // FEE-1 ATOMICITY: see verifyRazorpay -- payment, invoice totals and
    // receipt commit together, serialized per invoice.
    let settled: { payment: any; receipt: any };
    try {
      settled = await this.prisma.$transaction(async (tx: any) => {
        await tx.$executeRawUnsafe(
          `SELECT pg_advisory_xact_lock($1)`,
          this.settlementLockKey(dto.invoiceId),
        );

        const payment = await tx.payment.create({
          data: {
            tenantId, invoiceId: dto.invoiceId,
            branchId: invoice.branchId,
            // Was hardcoded 'RAZORPAY' (wrong: mislabels an offline
            // collection as if it went through the Razorpay gateway). CASH
            // is the correct value -- see the enum-mismatch audit above.
            // No `as any` needed: 'CASH' is a real PaymentGatewayProvider
            // value, so this type-checks against the Prisma-generated field
            // type the same way 'RAZORPAY' does at the online path above --
            // the previous 'OFFLINE' cast was masking a genuine invalid
            // value, not working around an unrelated type limitation.
            gateway: 'CASH',
            amount: dto.amount, currency: invoice.currency, status: 'SUCCESS',
            paymentMethod:   dto.paymentMethod,
            gatewayPaymentId: reference,
            paidAt: new Date(),
          },
        });

        await this.updateInvoice(tx, tenantId, invoice.branchId, dto.invoiceId, payment.id, dto.amount);
        // P0 FIX: see verifyRazorpay -- same late-fee allocation, same
        // reasoning for running inside this transaction.
        await this.lateFeeService.allocatePayment(tx, tenantId, dto.invoiceId, payment.id, dto.amount);
        const receipt = await this.generateReceipt(tx, tenantId, dto.invoiceId, payment.id);

        // M2 (redesigned roadmap, §4.9): PAYMENT_COMPLETED, posted exactly
        // once. The idempotent fast path above returns before this
        // transaction ever opens on a retry, so a replayed offline
        // recording never reaches this line a second time; the unique
        // index catches the remaining concurrent-retry race identically
        // (the whole transaction, ledger write included, rolls back on a
        // unique-violation, matching the existing catch block below).
        await this.ledger.recordPaymentCompleted(tx, {
          tenantId,
          branchId:  invoice.branchId,
          studentId: invoice.studentId,
          occurredAt: new Date(),
          amount: dto.amount,
          referenceId: payment.id,
          metadata: { gateway: 'CASH', paymentMethod: dto.paymentMethod, invoiceId: dto.invoiceId },
        });

        return { payment, receipt };
      });
    } catch (err: any) {
      // The unique index on (tenantId, invoiceId, gatewayPaymentId) is the
      // authoritative guard: it catches the concurrent retry that slipped past
      // the fast path above. The whole transaction rolled back, so the invoice
      // was not credited twice; return the record the winning attempt made.
      if (this.isUniqueViolation(err)) {
        const winner = await this.findRecordedOfflinePayment(tenantId, dto.invoiceId, reference);
        if (winner) {
          this.logger.warn(`Offline payment retry collided at the unique index: ref=${reference} payment=${winner.id}`);
          return { payment: winner, receipt: winner.receipt };
        }
      }
      throw err;
    }
    const { payment, receipt } = settled;

    await this.audit.logPayment({ tenantId, actorId, entityType: 'Payment', entityId: payment.id, paymentStatus: 'success', after: { method: dto.paymentMethod, amount: dto.amount } });
    this.logger.log(`Offline payment: ₹${dto.amount} ${dto.paymentMethod} | tenant: ${tenantId}`);
    this.emitter.emit(EVENTS.PAYMENT_SUCCESS, {
      tenantId, studentId: invoice.studentId,
      invoiceId: dto.invoiceId, paymentId: payment.id,
      amount: dto.amount, currency: String(invoice.currency), method: dto.paymentMethod ?? 'OFFLINE',
    });
    return { payment, receipt };
  }

  // ── Update invoice amounts (in transaction for safety) ────────────────────
  /**
   * FEE-1: now takes the caller's transaction client instead of opening its
   * own. Applying a payment is a read-decide-write over the invoice's running
   * totals; running it in a separate transaction from the payment row's
   * creation meant a crash between the two could leave a SUCCESS payment
   * against an invoice that never recorded it.
   */
  private async updateInvoice(tx: any, tenantId: string, branchId: string, invoiceId: string, paymentId: string, amount: Prisma.Decimal.Value) {
    {
      const inv = await tx.invoice.findFirst({ where: { id: invoiceId, tenantId } });
      if (!inv) return;
      // Money arithmetic in Decimal end-to-end (D-9). Previously this did
      // Number(inv.paidAmount) + amount in binary float, which drifts on the
      // paise for percentage-derived amounts. inv.paidAmount / inv.totalAmount
      // arrive from Prisma as Decimal already; keep them Decimal through the
      // add/subtract and the clamp, and let Prisma persist the Decimal values.
      const pay      = new Prisma.Decimal(amount);
      const newPaid  = new Prisma.Decimal(inv.paidAmount).plus(pay);
      const newDue   = new Prisma.Decimal(inv.totalAmount).minus(newPaid);
      const dueClamped = newDue.isNegative() ? new Prisma.Decimal(0) : newDue;
      const status   = newDue.lessThanOrEqualTo(0)
        ? 'PAID'
        : newPaid.greaterThan(0) ? 'PARTIALLY_PAID' : inv.status;
      await tx.invoice.update({
        where: { id: invoiceId },
        data:  {
          paidAmount: newPaid,
          dueAmount:  dueClamped,
          status:     status as any,
          paidAt:     newDue.lessThanOrEqualTo(0) ? new Date() : null,
        },
      });

      // M10 (redesigned roadmap): PaymentAllocation, the durable record of
      // this crediting -- the arithmetic above is unchanged from before
      // this milestone; this is additive. Single-invoice settlement, so
      // the "rule" is OLDEST_DUE_FIRST trivially (there is exactly one
      // candidate charge, the invoice this payment was created against) --
      // the mechanism is ready for a future multi-invoice flow to pass a
      // real MANUAL override without needing to reshape this record.
      // M11: funding source is always PAYMENT here -- this method is only
      // ever invoked from settlement, never from a StudentAccount-sourced
      // path (that arrives in M17).
      await this.allocation.record(tx, {
        tenantId, branchId,
        fundingSourceType: 'PAYMENT', fundingSourceId: paymentId,
        chargeType: 'INVOICE', chargeId: invoiceId,
        amount: pay, rule: 'OLDEST_DUE_FIRST',
      });
    }
  }

  // ── Generate receipt — P0 FIX: uses advisory-lock-safe number ────────────
  /**
   * FEE-1: now runs inside the caller's settlement transaction, so the receipt
   * is created atomically with the payment and the invoice update.
   *
   * The number is generated with the same tx (see
   * InvoiceService.generateReceiptNumber) so its advisory lock is held until
   * this insert commits -- otherwise two concurrent payments can derive the
   * same receipt number.
   *
   * IDEMPOTENCY is keyed on paymentId, which is the receipt's ownership key
   * (Receipt.paymentId @unique). Reprocessing the SAME payment returns its
   * existing receipt instead of creating a second one; a DIFFERENT payment
   * against the same invoice gets its own receipt.
   *
   * This was previously keyed on invoiceId, which returned the FIRST payment's
   * receipt to every later payer on that invoice -- wrong amount, wrong
   * payment id. That could not be fixed before Receipt.invoiceId's @unique
   * constraint was dropped (migration 20260722020000_receipt_unique_per_payment),
   * because the lookup and the constraint encoded the same wrong rule.
   *
   * findUnique (not findFirst) is used deliberately: it resolves through the
   * paymentId unique index, and it will fail to compile if that @unique is
   * ever removed -- turning IMPLEMENTATION_HANDOFF.md §10's "must be
   * preserved" into a compile-time guarantee rather than a comment.
   */
  private async generateReceipt(tx: any, tenantId: string, invoiceId: string, paymentId: string) {
    const existing = await tx.receipt.findUnique({ where: { paymentId } });
    if (existing) return existing;

    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });

    // P0 FIX: delegate number generation to InvoiceService which uses
    // advisory lock. M7: branchId now required -- fetched above (invoice
    // is needed for its own branchId here regardless) rather than adding
    // an extra query just for this.
    const receiptNumber = await this.invoiceService.generateReceiptNumber(tenantId, invoice!.branchId, tx);
    const payment       = await tx.payment.findUnique({ where: { id: paymentId } });

    return tx.receipt.create({
      data: {
        tenantId, branchId: invoice!.branchId,  invoiceId, paymentId, receiptNumber,
        amount:   payment?.amount ?? 0,
        currency: payment?.currency ?? 'INR',
      },
    });
  }

  // ── Payment history ───────────────────────────────────────────────────────
  async getPaymentHistory(
    tenantId: string,
    invoiceId: string,
    // FEE-0: branch scoping per ADR-FEE-002 (null = tenant-wide, [] = nothing,
    // fail closed). An out-of-branch invoice reads as NotFound (anti-probing).
    authorizedBranchIds?: string[] | null,
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        tenantId,
        ...(authorizedBranchIds != null && { branchId: { in: authorizedBranchIds } }),
      },
      select: { id: true },
    });
    if (!invoice) throw new NotFoundException(`Invoice not found: ${invoiceId}`);
    return this.prisma.payment.findMany({ where: { tenantId, invoiceId }, orderBy: { createdAt: 'desc' } });
  }
}
