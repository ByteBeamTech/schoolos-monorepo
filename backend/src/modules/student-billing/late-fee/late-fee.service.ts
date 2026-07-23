// modules/student-billing/late-fee/late-fee.service.ts
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '../../../core/compliance/audit.service';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface LateFeeConfig {
  gracePeriodDays: number;
  penaltyType:     'FLAT' | 'PERCENTAGE';
  penaltyValue:    number;
  maxPenalty?:     number;
  compoundDaily:   boolean;
}

const DEFAULT_CONFIG: LateFeeConfig = {
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

    let lateFee = 0;
    if (config.penaltyType === 'FLAT') {
      lateFee = config.compoundDaily ? config.penaltyValue * daysOverdue : config.penaltyValue;
    } else {
      const monthlyRate = config.penaltyValue / 100;
      const dailyRate   = monthlyRate / 30;
      lateFee = config.compoundDaily
        ? dueAmount * (Math.pow(1 + dailyRate, daysOverdue) - 1)
        : dueAmount * monthlyRate * Math.ceil(daysOverdue / 30);
    }

    if (config.maxPenalty !== undefined) lateFee = Math.min(lateFee, config.maxPenalty);
    return { lateFee: Math.round(lateFee * 100) / 100, daysOverdue, gracePeriodDays: config.gracePeriodDays, isInGrace };
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async applyLateFees(): Promise<void> {
    this.logger.log('Running daily late fee calculation...');

    const overdueInvoices = await this.prisma.invoice.findMany({
      where: {
        status:  { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] },
        dueDate: { lt: new Date() },
      },
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
},
      take: 1000,
    });

    let applied = 0;

    for (const invoice of overdueInvoices) {
      try {
        const dueDate   = new Date(invoice.dueDate);
        const dueAmount = Number(invoice.dueAmount);
        const config    = await this.getTenantConfig(invoice.tenantId);
        const { lateFee, daysOverdue } = this.calculateLateFee(dueAmount, dueDate, new Date(), config);
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

        if (lateFee <= 0) continue;

        // Check if late fee already applied today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const lastFee = (invoice as any).lateFees?.[0];
        if (lastFee && new Date(lastFee.appliedAt) >= today) continue;

        // Invoice has no lateFeeAmount field — use LateFee relation model
await this.prisma.lateFee.create({
  data: {
    tenantId: invoice.tenantId,

    branchId: invoice.student.branchId,

    invoiceId: invoice.id,

    studentId: invoice.studentId,

    academicYearId:
      currentSession?.id ?? 'default',

    dueDate: invoice.dueDate,

    baseAmount: dueAmount,

    graceDays: config.gracePeriodDays,

    amount: lateFee,

    daysOverdue,
  },
});
        // Update invoice dueAmount and totalAmount
        await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            dueAmount:   dueAmount + lateFee,
            totalAmount: Number(invoice.totalAmount) + lateFee,
            status:      'OVERDUE',
          },
        });

        applied++;
      } catch (err: any) {
        this.logger.error(`Late fee error for invoice ${invoice.id}: ${err.message}`);
      }
    }

    this.logger.log(`Late fees applied to ${applied}/${overdueInvoices.length} invoices`);
  }

  private async getTenantConfig(_tenantId: string): Promise<LateFeeConfig> {
    return DEFAULT_CONFIG;
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
    amount:    number,
  ): Promise<void> {
    if (amount <= 0) return;

    const activeFees = await tx.lateFee.findMany({
      where:   { tenantId, invoiceId, status: 'ACTIVE' },
      orderBy: { appliedAt: 'asc' },
    });

    let remaining = amount;
    for (const fee of activeFees) {
      if (remaining <= 0) break;

      const outstanding = Number(fee.amount) - Number(fee.paidAmount) - Number(fee.amountWaived);
      if (outstanding <= 0) continue;

      const allocated   = Math.min(remaining, outstanding);
      const newPaid     = Number(fee.paidAmount) + allocated;
      const finalAmount = Math.max(0, Number(fee.amount) - newPaid - Number(fee.amountWaived));
      const isSettled   = finalAmount <= 0;

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

      remaining -= allocated;
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
   * A waiver mutates Invoice.dueAmount/totalAmount, the same fields a
   * concurrent payment settlement mutates. Without this lock, a waiver
   * running concurrently with a payment on the same invoice could read the
   * invoice's totals before the other writes them -- a lost update, same
   * failure class FEE-1 fixed for payments and refunds.
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

      const outstanding = Number(fee.amount) - Number(fee.paidAmount) - Number(fee.amountWaived);
      if (amount > outstanding) {
        throw new BadRequestException(`Waiver amount ${amount} exceeds outstanding ${outstanding}.`);
      }

      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock($1)`, this.lockKeyFor(fee.invoiceId));

      const newWaived    = Number(fee.amountWaived) + amount;
      const finalAmount  = Math.max(0, Number(fee.amount) - Number(fee.paidAmount) - newWaived);
      const isSettled    = finalAmount <= 0;

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

      // Recompute the invoice's totals the same way updateInvoice() does for
      // a payment -- reduce dueAmount/totalAmount, flip to PAID if that
      // clears it, never let dueAmount go negative.
      const invoice = await tx.invoice.findFirst({ where: { id: fee.invoiceId, tenantId } });
      if (invoice) {
        const newDue   = Math.max(0, Number(invoice.dueAmount) - amount);
        const newTotal = Math.max(0, Number(invoice.totalAmount) - amount);
        const status    = newDue <= 0 ? 'PAID' : invoice.status;
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            dueAmount:   newDue,
            totalAmount: newTotal,
            status:      status as any,
            paidAt:      newDue <= 0 ? (invoice.paidAt ?? new Date()) : invoice.paidAt,
          },
        });
      }

      await this.audit.logUpdate(
        {
          tenantId,
          actorId,
          entityType: 'LateFee',
          entityId:   fee.id,
          before:     { amountWaived: Number(fee.amountWaived), status: fee.status },
          after:      { amountWaived: newWaived, status: updatedFee.status, waivedAmount: amount, reason },
        },
        tx,
      );

      return updatedFee;
    });

    this.logger.log(`Late fee ${lateFeeId} waived ${amount} by ${actorId}`);
    return { lateFee: result };
  }
}
