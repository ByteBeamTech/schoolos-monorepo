// modules/student-billing/late-fee/late-fee.service.ts
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { Prisma } from '@prisma/client';
import { AuditService } from '../../../core/compliance/audit.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { overdueWhere } from '../invoice/overdue.util';
import { LedgerService } from '../ledger/services/ledger.service';
import { PaymentAllocationService } from '../allocation/services/payment-allocation.service';
import { resolveLateFeeConfig } from './late-fee-rule-resolver';

export interface LateFeeConfig {
  gracePeriodDays: number;
  penaltyType:     'FLAT' | 'PERCENTAGE';
  penaltyValue:    number;
  maxPenalty?:     number;
  compoundDaily:   boolean;
}

// Exported for src/scripts/seed-late-fee-rules.ts (Late Fee FDD v2 Sprint
// 1): the seed imports this directly rather than retyping its values by
// hand, so a future change to this constant can't silently drift from
// what the seed produces without also being a visible import-path change.
export const DEFAULT_CONFIG: LateFeeConfig = {
  gracePeriodDays: 7,
  penaltyType:     'PERCENTAGE',
  penaltyValue:    2,
  maxPenalty:      500,
  compoundDaily:   false,
};

@Injectable()
export class LateFeeService {
  private readonly logger = new Logger(LateFeeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit:  AuditService,
    private readonly ledger: LedgerService,
    private readonly allocation: PaymentAllocationService,
  ) {}

  calculateLateFee(
    dueAmount: number,
    dueDate:   Date,
    asOfDate:  Date = new Date(),
    config:    LateFeeConfig = DEFAULT_CONFIG,
  ): { lateFee: number; daysOverdue: number; gracePeriodDays: number; isInGrace: boolean } {
    const msPerDay    = 24 * 60 * 60 * 1000;
    const daysLate    = Math.floor((asOfDate.getTime() - dueDate.getTime()) / msPerDay);
    const daysOverdue = Math.max(0, daysLate - config.gracePeriodDays);
    const isInGrace   = daysLate > 0 && daysOverdue === 0;

    if (daysOverdue === 0) {
      return { lateFee: 0, daysOverdue, gracePeriodDays: config.gracePeriodDays, isInGrace };
    }

    // Penalty is a percentage of (or a flat charge against) the due amount --
    // percentage math is the float-drift case. Compute in Decimal, round to
    // 2dp (paise) at the end. The public contract stays `number` since callers
    // (and the invoice update) use it as such; only the internal arithmetic
    // moves to Decimal (D-9).
    const due = new Prisma.Decimal(dueAmount);
    let lateFee = new Prisma.Decimal(0);
    if (config.penaltyType === 'FLAT') {
      lateFee = config.compoundDaily
        ? new Prisma.Decimal(config.penaltyValue).times(daysOverdue)
        : new Prisma.Decimal(config.penaltyValue);
    } else {
      const monthlyRate = new Prisma.Decimal(config.penaltyValue).dividedBy(100);
      if (config.compoundDaily) {
        // Daily compounding: due * ((1 + monthlyRate/30)^daysOverdue - 1).
        // Decimal.pow takes an integer exponent, which daysOverdue is.
        const dailyRate = monthlyRate.dividedBy(30);
        const growth    = new Prisma.Decimal(1).plus(dailyRate).pow(daysOverdue).minus(1);
        lateFee = due.times(growth);
      } else {
        const months = Math.ceil(daysOverdue / 30);
        lateFee = due.times(monthlyRate).times(months);
      }
    }

    if (config.maxPenalty !== undefined) {
      const cap = new Prisma.Decimal(config.maxPenalty);
      if (lateFee.greaterThan(cap)) lateFee = cap;
    }
    return {
      lateFee: lateFee.toDecimalPlaces(2).toNumber(),
      daysOverdue,
      gracePeriodDays: config.gracePeriodDays,
      isInGrace,
    };
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async applyLateFees(): Promise<void> {
    this.logger.log('Running daily late fee calculation...');

    const overdueInvoices = await this.prisma.invoice.findMany({
      where: overdueWhere(),
      include: {
  lateFees: {
    orderBy: { appliedAt: 'desc' },
    take: 1,
  },
  student: {
    select: {
      branchId: true,
    },
  },
  // Late Fee FDD v2 Section 2.2 / Roadmap Sprint 2: Fee-Plan-scoped
  // resolution needs this invoice's fee plan, and Invoice has no
  // direct feePlanId column (verified against the real schema before
  // writing this) -- the only path is items[].feeItemId -> FeeItem.
  // feePlanId. Batch-fetched here, once per invoice, alongside
  // everything else this scan already needs -- not a per-invoice
  // query inside the loop below.
  items: {
    select: {
      feeItem: { select: { feePlanId: true } },
    },
  },
},
      take: 1000,
    });

    let applied = 0;

    for (const invoice of overdueInvoices) {
      try {
        const dueDate = new Date(invoice.dueDate);
        // FDD Section 2.2: the first item carrying a resolvable feePlanId
        // decides Fee-Plan-scope for this invoice. In practice every item
        // on one invoice traces to the same plan (invoices are generated
        // from a single feePlanId at creation time) -- this does not
        // reconcile a hypothetical mismatch across items, it takes the
        // first real one found, which is the only case that occurs today.
        const feePlanId =
          (invoice as any).items?.find((i: any) => i.feeItem?.feePlanId)?.feeItem?.feePlanId ?? null;
        const { config, ruleId, usedFallbackConfig } = await this.getTenantConfig(
          invoice.tenantId,
          invoice.student.branchId,
          feePlanId,
        );
	const currentSession =
  await this.prisma.academicSession.findFirst({
    where: {
      tenantId: invoice.tenantId,
      isCurrent: true,
    },
    select: {
      id: true,
    },
  });

        // Check if late fee already applied today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const lastFee = (invoice as any).lateFees?.[0];
        if (lastFee && new Date(lastFee.appliedAt) >= today) continue;

        // M4 FIX: fold the LateFee insert and the Invoice update into ONE
        // transaction, guarded by the SAME per-invoice advisory lock
        // settlement holds (PaymentService.settlementLockKey /
        // RefundService.lockKeyFor -- this.lockKeyFor below is this file's
        // own copy of the identical key derivation, already used by
        // waiveLateFee; reused here rather than copied a second time in
        // this file). Without this, a concurrent payment settlement and
        // this cron can each read the invoice's dueAmount/totalAmount
        // before the other writes -- a lost update.
        //
        // Holding the lock is not sufficient on its own: the invoice MUST
        // also be re-read INSIDE the lock. If this used the `invoice`
        // object captured by the findMany scan above, a settlement that
        // committed between the scan and lock acquisition would have its
        // write silently overwritten by this one, computed from stale
        // data -- the exact lost update the lock exists to prevent.
        await this.prisma.$transaction(async (tx: any) => {
          await tx.$executeRawUnsafe(
            `SELECT pg_advisory_xact_lock($1)`,
            this.lockKeyFor(invoice.id),
          );

          const fresh = await tx.invoice.findFirst({
            where: { id: invoice.id, tenantId: invoice.tenantId },
          });
          if (!fresh) return; // invoice vanished between scan and lock; nothing to do

          const freshDue = new Prisma.Decimal(fresh.dueAmount).toNumber();
          const { lateFee, daysOverdue } = this.calculateLateFee(freshDue, dueDate, new Date(), config);
          // Recomputed off the FRESH due amount: a payment that landed
          // between the scan and the lock (partial or full) is reflected
          // here, so a now-cleared invoice correctly attracts no late fee.
          if (lateFee <= 0) return;

          const createdLateFee = await tx.lateFee.create({
            data: {
              tenantId: invoice.tenantId,
              branchId: invoice.student.branchId,
              invoiceId: invoice.id,
              studentId: invoice.studentId,
              academicYearId: currentSession?.id ?? 'default',
              dueDate: invoice.dueDate,
              baseAmount: freshDue,
              graceDays: config.gracePeriodDays,
              amount: lateFee,
              daysOverdue,
              // FDD Section 2.3 / Roadmap Sprint 2: which rule produced
              // this fee (null when the fallback fired), and whether the
              // fallback fired at all -- the two are deliberately
              // distinguishable from a pre-Sprint-2 row (ruleId=NULL,
              // usedFallbackConfig=false, resolution never attempted).
              ruleId,
              usedFallbackConfig,
            },
          });

          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              dueAmount:   new Prisma.Decimal(fresh.dueAmount).plus(lateFee),
              totalAmount: new Prisma.Decimal(fresh.totalAmount).plus(lateFee),
              // M5: status is intentionally NOT set to 'OVERDUE' here. The
              // invoice remains whatever it already is (SENT or
              // PARTIALLY_PAID); overdue-ness is derived by every reader
              // (invoice/overdue.util.ts), never persisted. This was the
              // only write site for InvoiceStatus.OVERDUE in the codebase.
            },
          });

          // M4 (redesigned roadmap, §4.9): LATE_FEE_ASSESSED, posted
          // exactly once per assessment, inside this same lock+transaction.
          // The "already applied today" continue-guard above runs BEFORE
          // this transaction ever opens, so a second cron run on the same
          // day for the same invoice never reaches this line at all --
          // there is no separate replay path here to double-post from.
          await this.ledger.recordLateFeeAssessed(tx, {
            tenantId: invoice.tenantId,
            branchId: invoice.student.branchId,
            studentId: invoice.studentId,
            occurredAt: new Date(),
            amount: lateFee,
            referenceId: createdLateFee.id,
            metadata: { invoiceId: invoice.id, daysOverdue, baseAmount: freshDue },
          });

          applied++;
        });
      } catch (err: any) {
        this.logger.error(`Late fee error for invoice ${invoice.id}: ${err.message}`);
      }
    }

    this.logger.log(`Late fees applied to ${applied}/${overdueInvoices.length} invoices`);
  }

  /**
   * Late Fee FDD v2 Section 2.2 (resolution chain) / Section 2.3
   * (resolution-failure fallback). Was a stub returning DEFAULT_CONFIG
   * unconditionally regardless of its own tenantId argument -- now a real
   * resolution, delegating to late-fee-rule-resolver.ts so the chain
   * logic itself stays independently unit-testable. calculateLateFee()
   * itself is unchanged by this -- only what supplies its config
   * argument changed, per the FDD's explicit instruction.
   */
  private async getTenantConfig(
    tenantId: string,
    branchId: string,
    feePlanId: string | null,
  ): Promise<{ config: LateFeeConfig; ruleId: string | null; usedFallbackConfig: boolean }> {
    return resolveLateFeeConfig(this.prisma, tenantId, branchId, feePlanId, DEFAULT_CONFIG);
  }

  /**
   * Allocate a cleared payment against this invoice's outstanding late fees.
   *
   * Fixes a P0 correctness gap: applyLateFees() folds each late fee into the
   * invoice's own dueAmount/totalAmount, but nothing ever wrote back to
   * LateFee.paidAmount/status when a payment came in -- so a late fee stayed
   * ACTIVE forever, even after the invoice that contained it was fully paid.
   * The schema already models this (paidAmount, amountWaived, finalAmount,
   * paymentId, status incl. PAID) -- it was simply never wired up.
   *
   * Deliberately narrow: this ONLY updates LateFee rows. It does not touch
   * Invoice.paidAmount/dueAmount -- those are already correctly maintained by
   * PaymentService.updateInvoice() in the same settlement transaction. This
   * method must be called from inside that same transaction (a `tx` client
   * is required) so late-fee allocation commits atomically with the payment
   * and the invoice update, per the FEE-1 "commit together or not at all"
   * principle -- not because the split itself is money-critical (the
   * invoice's own totals never depend on it), but because a late fee stuck
   * showing ACTIVE after its invoice is PAID is a real reporting bug we do
   * not want to reintroduce via a partial write.
   *
   * Allocation order: oldest-charged late fee first (appliedAt asc), i.e. the
   * fee accrued longest ago is paid down first. Matches no other explicit
   * business rule in the codebase -- FIFO is the least surprising default and
   * is documented here so a future change to the ordering is deliberate, not
   * accidental.
   *
   * NOTE (known limitation, not fixed here): a full refund
   * (RefundService.initiate(), reopens the invoice and zeroes
   * paidAmount/dueAmount) does not reverse what this method writes to
   * LateFee.paidAmount/status. Reconciling refunds against late-fee
   * allocation is refund-side work (RefundService is P3, out of scope here)
   * and is left as a follow-up once that controller exists.
   */
  async allocatePayment(
    tx:        any,
    tenantId:  string,
    invoiceId: string,
    paymentId: string,
    amount:    Prisma.Decimal.Value,
  ): Promise<void> {
    // amount is now Decimal-typed so PaymentService can pass payment.amount
    // straight in without Number() coercion (D-9). All splitting below is
    // Decimal.
    let remaining = new Prisma.Decimal(amount);
    if (remaining.lessThanOrEqualTo(0)) return;

    const activeFees = await tx.lateFee.findMany({
      where:   { tenantId, invoiceId, status: 'ACTIVE' },
      orderBy: { appliedAt: 'asc' },
    });

    for (const fee of activeFees) {
      if (remaining.lessThanOrEqualTo(0)) break;

      const outstanding = new Prisma.Decimal(fee.amount)
        .minus(fee.paidAmount)
        .minus(fee.amountWaived);
      if (outstanding.lessThanOrEqualTo(0)) continue;

      const allocated   = Prisma.Decimal.min(remaining, outstanding);
      const newPaid     = new Prisma.Decimal(fee.paidAmount).plus(allocated);
      const finalRaw    = new Prisma.Decimal(fee.amount).minus(newPaid).minus(fee.amountWaived);
      const finalAmount = finalRaw.isNegative() ? new Prisma.Decimal(0) : finalRaw;
      const isSettled   = finalAmount.lessThanOrEqualTo(0);

      await tx.lateFee.update({
        where: { id: fee.id },
        data: {
          paidAmount:  newPaid,
          finalAmount,
          status:      isSettled ? 'PAID' : fee.status,
          // Snapshot of the payment that settled this fee. Only meaningful
          // once the fee reaches PAID; a partial allocation leaves the
          // previous trace (or none) in place rather than overwriting it
          // with a payment that didn't finish the job.
          ...(isSettled ? { paymentId } : {}),
        },
      });

      // M10 (redesigned roadmap): PaymentAllocation, the durable record of
      // this crediting -- one row per late fee this payment actually
      // touches (a single payment can partially cover several fees in
      // this same loop, oldest-appliedAt-first, so this can run more than
      // once per call). The arithmetic above is unchanged from before this
      // milestone; this is additive. M11: funding source is always
      // PAYMENT here, same reasoning as PaymentService.
      await this.allocation.record(tx, {
        tenantId, branchId: fee.branchId,
        fundingSourceType: 'PAYMENT', fundingSourceId: paymentId,
        chargeType: 'LATE_FEE', chargeId: fee.id,
        amount: allocated, rule: 'OLDEST_DUE_FIRST',
      });

      remaining = remaining.minus(allocated);
    }
  }

  /**
   * LOCK SCOPE
   * ----------
   * One advisory transaction lock per Invoice, same key derivation as
   * RefundService.lockKeyFor() / PaymentService.settlementLockKey() (this
   * codebase's established per-aggregate concurrency primitive -- no shared
   * abstraction was introduced for it, per the FEE-1 decision record, so each
   * caller that needs it keeps its own small copy).
   *
   * Two callers in this file: waiveLateFee() and, as of M4, applyLateFees().
   * Both mutate Invoice.dueAmount/totalAmount, the same fields a concurrent
   * payment settlement mutates. Without this lock, any two of {settlement,
   * waiver, assessment} running concurrently on the same invoice could each
   * read its totals before the other writes them -- a lost update, same
   * failure class FEE-1 fixed for payments and refunds.
   *
   * TODO (do not action piecemeal): v1.2 Section 3.8 specifies the
   * two-argument pg_advisory_xact_lock(classId, objId) form, namespaced by
   * lock class, as the standard going forward. This file, RefundService and
   * PaymentService currently all use the single-bigint-argument form instead.
   * These are NOT interchangeable -- Postgres treats the single-argument and
   * two-argument advisory lock functions as separate lock spaces that never
   * conflict with each other, even for numerically identical keys. If this
   * codebase ever migrates to the two-argument form, every call site
   * (PaymentService x2, RefundService, this file x2) MUST move together in
   * one atomic change; migrating any subset first would silently decouple
   * that subset's lock from the others' and reintroduce the exact lost-update
   * race these locks exist to prevent, while looking fixed.
   */
  private lockKeyFor(invoiceId: string): number {
    return invoiceId
      .split('')
      .reduce((acc, ch) => ((acc * 31 + ch.charCodeAt(0)) & 0x7fffffff), 0);
  }

  /**
   * Waive some or all of the outstanding (uncollected, unwaived) balance of
   * one late fee, and reduce the parent invoice's dueAmount/totalAmount by
   * the same amount -- mirroring how applyLateFees() ADDED the fee to both
   * fields when it was charged. Without this second half, waiving a fee on
   * paper would not actually reduce what the student owes.
   *
   * A late fee can be partially waived more than once (e.g. two separate
   * staff decisions), as long as cumulative paidAmount + amountWaived never
   * exceeds amount -- enforced below, the same "cannot exceed the
   * collectible total" shape as RefundService's over-refund guard.
   *
   * Only ACTIVE fees are waivable. A fee already PAID has nothing left to
   * waive; WAIVED/REVERSED are terminal. This is a business-rule choice, not
   * a technical constraint -- revisit if partial-fee correction after full
   * payment becomes a real workflow.
   */
  async waiveLateFee(
    tenantId:  string,
    lateFeeId: string,
    amount:    number,
    actorId:   string,
    reason:    string,
  ): Promise<{ lateFee: any }> {
    if (amount <= 0) {
      throw new BadRequestException('Waiver amount must be positive.');
    }

    const result = await this.prisma.$transaction(async (tx: any) => {
      const fee = await tx.lateFee.findFirst({ where: { id: lateFeeId, tenantId } });
      if (!fee) throw new NotFoundException(`Late fee not found: ${lateFeeId}`);
      if (fee.status !== 'ACTIVE') {
        throw new BadRequestException(`Only an ACTIVE late fee can be waived (current status: ${fee.status}).`);
      }

      // Money arithmetic in Decimal (D-9). amount stays a number at this HTTP
      // boundary (validated DTO field); everything computed from it is Decimal.
      const amt         = new Prisma.Decimal(amount);
      const outstanding = new Prisma.Decimal(fee.amount)
        .minus(fee.paidAmount)
        .minus(fee.amountWaived);
      if (amt.greaterThan(outstanding)) {
        throw new BadRequestException(`Waiver amount ${amount} exceeds outstanding ${outstanding.toString()}.`);
      }

      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock($1)`, this.lockKeyFor(fee.invoiceId));

      const newWaived   = new Prisma.Decimal(fee.amountWaived).plus(amt);
      const finalRaw    = new Prisma.Decimal(fee.amount).minus(fee.paidAmount).minus(newWaived);
      const finalAmount = finalRaw.isNegative() ? new Prisma.Decimal(0) : finalRaw;
      const isSettled   = finalAmount.lessThanOrEqualTo(0);

      const updatedFee = await tx.lateFee.update({
        where: { id: fee.id },
        data: {
          amountWaived: newWaived,
          finalAmount,
          status:       isSettled ? 'WAIVED' : fee.status,
          waivedAt:     new Date(),
          waivedById:   actorId,
          reason:       reason ?? fee.reason,
        },
      });

      // Late Fee FDD v2 Section 1.4 / Implementation Roadmap Sprint 1:
      // one LateFeeWaiver row per waiver event, additive to the scalar
      // fields on LateFee above (which stay as a fast-read summary of the
      // MOST RECENT waiver only -- this is the append-only history
      // underneath them). Closes the gap where a second partial waiver on
      // the same fee previously overwrote the first waiver's audit trail
      // entirely: waivedAt/waivedById/reason on LateFee were single
      // scalar fields, so the earlier waiver's actor and timestamp were
      // silently lost. Same transaction, same advisory lock already held
      // above -- this insert either commits with the LateFee update, or
      // neither happens.
      await (tx.lateFeeWaiver as any).create({
        data: {
          lateFeeId:  fee.id,
          amount:     amt,
          waivedById: actorId,
          reason:     reason ?? fee.reason,
        },
      });

      // Recompute the invoice's totals the same way updateInvoice() does for
      // a payment -- reduce dueAmount/totalAmount, flip to PAID if that
      // clears it, never let dueAmount go negative.
      const invoice = await tx.invoice.findFirst({ where: { id: fee.invoiceId, tenantId } });
      if (invoice) {
        const dueRaw    = new Prisma.Decimal(invoice.dueAmount).minus(amt);
        const totalRaw  = new Prisma.Decimal(invoice.totalAmount).minus(amt);
        const newDue    = dueRaw.isNegative() ? new Prisma.Decimal(0) : dueRaw;
        const newTotal  = totalRaw.isNegative() ? new Prisma.Decimal(0) : totalRaw;
        const status    = newDue.lessThanOrEqualTo(0) ? 'PAID' : invoice.status;
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            dueAmount:   newDue,
            totalAmount: newTotal,
            status:      status as any,
            paidAt:      newDue.lessThanOrEqualTo(0) ? (invoice.paidAt ?? new Date()) : invoice.paidAt,
          },
        });
      }

      await this.audit.logUpdate(
        {
          tenantId,
          actorId,
          entityType: 'LateFee',
          entityId:   fee.id,
          before:     { amountWaived: new Prisma.Decimal(fee.amountWaived).toNumber(), status: fee.status },
          after:      { amountWaived: newWaived.toNumber(), status: updatedFee.status, waivedAmount: amount, reason },
        },
        tx,
      );

      return updatedFee;
    });

    this.logger.log(`Late fee ${lateFeeId} waived ${amount} by ${actorId}`);
    return { lateFee: result };
  }

  /**
   * FDD Section 1.4 / Implementation Roadmap Sprint 1: the append-only
   * waiver history for one late fee, newest first. Scoped by tenantId
   * through the LateFee it belongs to, not a bare lateFeeId lookup --
   * this must not leak another tenant's waiver history for a guessed id.
   */
  async getWaivers(tenantId: string, lateFeeId: string) {
    const fee = await this.prisma.lateFee.findFirst({ where: { id: lateFeeId, tenantId } });
    if (!fee) throw new NotFoundException(`Late fee not found: ${lateFeeId}`);

    return (this.prisma.lateFeeWaiver as any).findMany({
      where: { lateFeeId },
      orderBy: { waivedAt: 'desc' },
    });
  }
}
