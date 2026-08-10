// backend/src/modules/student-billing/billing-run/services/billing-run.service.ts
//
// Phase 4 (frozen). [BUILD NEW] -- no existing service does this.

import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '../../../../core/compliance/audit.service';
import { InvoiceBuilderService } from './invoice-builder.service';
import { BILLABLE_STUDENT_STATUSES, isStudentEligibleForPeriod } from '../../plans/utils/student-resolution.util';
import { formatPeriodLabel } from '../../plans/utils/billing-period.util';
import { BillingRunTrigger, AttemptStatus, Prisma } from '@prisma/client';

@Injectable()
export class BillingRunService {
  private readonly logger = new Logger(BillingRunService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly invoiceBuilder: InvoiceBuilderService,
  ) {}

  // Same advisory-lock pattern already established in invoice.service.ts/
  // refund.service.ts/late-fee.service.ts -- reused by shape, not by
  // shared code (matching this design's own deliberate choice not to
  // extract that pre-existing duplication as part of this phase). Keyed
  // on billingRunId+studentId, the actual per-attempt contention point.
  private lockKeyFor(billingRunId: string, studentId: string): number {
    return `${billingRunId}:${studentId}`
      .split('')
      .reduce((acc, ch) => ((acc * 31 + ch.charCodeAt(0)) & 0x7FFFFFFF), 0);
  }

  /**
   * Creates the BillingRun row and one PENDING BillingRunAttempt per
   * eligible student in the WHOLE BRANCH -- not filtered by plan. Each
   * student's applicable FeePlan is resolved later, per-attempt, inside
   * InvoiceBuilderService -- never here.
   *
   * Cross-run idempotency (frozen §6/§8, layer 3): before creating a
   * PENDING attempt for a student, checks whether a PRIOR run already
   * produced a real invoice for this exact student+branch+period. If so,
   * the attempt is created directly as SUCCEEDED, pointing at that
   * existing invoice -- never re-processed. Invoice itself has no
   * periodLabel column, so this is checked via BillingRunAttempt's own
   * history (billingRun.periodLabel + a prior SUCCEEDED attempt with a
   * real invoiceId), not a direct Invoice query.
   */
  async trigger(
    tenantId: string, branchId: string, periodMonth: number, periodYear: number,
    triggeredBy: BillingRunTrigger, actorId: string,
  ) {
    const periodLabel = formatPeriodLabel(periodMonth, periodYear);

    // Run-level idempotency (layer 1) is also enforced by a partial
    // unique index at the database level -- this pre-check exists to
    // return a clear, specific error rather than a raw constraint
    // violation, not as the only guard.
    const activeRun = await this.prisma.billingRun.findFirst({
      where: { tenantId, branchId, periodLabel, status: { notIn: ['COMPLETED', 'FAILED'] } },
    });
    if (activeRun) {
      throw new ConflictException(`An active billing run already exists for ${periodLabel} in this branch.`);
    }

    const run = await this.prisma.billingRun.create({
      data: { tenantId, branchId, periodLabel, triggeredBy, status: 'PENDING', createdById: actorId },
    });

    const eligibleStudents = await this.prisma.student.findMany({
      where: { tenantId, branchId, status: { in: BILLABLE_STUDENT_STATUSES } },
    });

    const periodEnd = new Date(periodYear, periodMonth, 0, 23, 59, 59, 999);
    const periodStart = new Date(periodYear, periodMonth - 1, 1);

    for (const student of eligibleStudents) {
      if (!isStudentEligibleForPeriod(student, { periodStart, periodEnd })) continue;

      // Cross-run idempotency check -- has a PRIOR run already invoiced
      // this student for this exact branch+period?
      const priorSuccess = await this.prisma.billingRunAttempt.findFirst({
        where: {
          tenantId, studentId: student.id, status: 'SUCCEEDED', invoiceId: { not: null },
          billingRun: { branchId, periodLabel },
        },
      });

      await this.prisma.billingRunAttempt.create({
        data: {
          tenantId, billingRunId: run.id, studentId: student.id,
          status: priorSuccess ? 'SUCCEEDED' : 'PENDING',
          invoiceId: priorSuccess?.invoiceId ?? null,
          feePlanId: priorSuccess?.feePlanId ?? null,
          completedAt: priorSuccess ? new Date() : null,
        },
      });
    }

    await this.audit.logCreate({
      tenantId, actorId, entityType: 'BillingRun', entityId: run.id,
      after: { branchId, periodLabel, studentCount: eligibleStudents.length },
    });
    return run;
  }

  /**
   * Processes every PENDING/FAILED attempt for the run. Per-attempt
   * atomic (one transaction per student), per-run continue-on-failure --
   * this outer loop is deliberately NOT one transaction across every
   * student, which is what makes continue-on-failure possible at all.
   */
  async execute(billingRunId: string) {
    const run = await this.prisma.billingRun.findUnique({ where: { id: billingRunId } });
    if (!run) throw new NotFoundException(`Billing run not found: ${billingRunId}`);

    await this.prisma.billingRun.update({ where: { id: billingRunId }, data: { status: 'IN_PROGRESS', startedAt: run.startedAt ?? new Date() } });

    const [periodMonth, periodYear] = this.parsePeriodLabel(run.periodLabel);

    const attempts = await this.prisma.billingRunAttempt.findMany({
      where: { billingRunId, status: { in: ['PENDING', 'FAILED'] } },
    });

    for (const attempt of attempts) {
      const lockKey = this.lockKeyFor(billingRunId, attempt.studentId);
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock($1)`, lockKey);

          // Re-read inside the lock -- a concurrent execute() call may
          // have already claimed this attempt between the outer findMany
          // and this transaction starting.
          const current = await tx.billingRunAttempt.findUnique({ where: { id: attempt.id } });
          if (!current || current.status === 'SUCCEEDED') return;

          await tx.billingRunAttempt.update({ where: { id: attempt.id }, data: { status: 'PROCESSING' } });

          const result = await this.invoiceBuilder.buildForStudent(
            run.tenantId, run.branchId, attempt.studentId, periodMonth, periodYear, tx,
          );

          await tx.billingRunAttempt.update({
            where: { id: attempt.id },
            data: {
              status: 'SUCCEEDED', feePlanId: result.feePlanId, invoiceId: result.invoiceId,
              completedAt: new Date(), errorMessage: null,
            },
          });
        });
      } catch (err: any) {
        // Deliberately outside the transaction above -- the failed
        // transaction has already rolled back, so this write starts
        // clean and is the only thing that survives a failed attempt.
        await this.prisma.billingRunAttempt.update({
          where: { id: attempt.id },
          data: { status: 'FAILED', errorMessage: String(err?.message ?? err), retryCount: { increment: attempt.status === 'FAILED' ? 1 : 0 } },
        });
        this.logger.warn(`BillingRunAttempt ${attempt.id} failed: ${err?.message ?? err}`);
      }
    }

    return this.finalizeRunStatus(billingRunId);
  }

  /** Re-runs only FAILED attempts, incrementing retryCount -- no separate
   *  retry code path, calls the identical execute() logic. */
  async retryFailed(billingRunId: string) {
    const failedCount = await this.prisma.billingRunAttempt.count({ where: { billingRunId, status: 'FAILED' } });
    if (!failedCount) throw new ConflictException('No failed attempts to retry for this run.');
    return this.execute(billingRunId);
  }

  async findById(tenantId: string, id: string) {
    const run = await this.prisma.billingRun.findFirst({ where: { id, tenantId } });
    if (!run) throw new NotFoundException(`Billing run not found: ${id}`);
    const counts = await this.prisma.billingRunAttempt.groupBy({
      by: ['status'], where: { billingRunId: id }, _count: true,
    });
    return { ...run, attemptCounts: Object.fromEntries(counts.map((c) => [c.status, c._count])) };
  }

  async findAttempts(tenantId: string, billingRunId: string, status?: AttemptStatus) {
    return this.prisma.billingRunAttempt.findMany({
      where: { tenantId, billingRunId, ...(status && { status }) },
    });
  }

  private async finalizeRunStatus(billingRunId: string) {
    const attempts = await this.prisma.billingRunAttempt.findMany({ where: { billingRunId } });
    const allTerminal = attempts.every((a) => a.status === 'SUCCEEDED' || a.status === 'FAILED');
    if (!allTerminal) {
      return this.prisma.billingRun.update({ where: { id: billingRunId }, data: { status: 'IN_PROGRESS' } });
    }
    const allSucceeded = attempts.every((a) => a.status === 'SUCCEEDED');
    const allFailed     = attempts.length > 0 && attempts.every((a) => a.status === 'FAILED');
    const status = allSucceeded ? 'COMPLETED' : allFailed ? 'FAILED' : 'PARTIALLY_COMPLETED';
    return this.prisma.billingRun.update({ where: { id: billingRunId }, data: { status, completedAt: new Date() } });
  }

  private parsePeriodLabel(periodLabel: string): [number, number] {
    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const [monthName, yearStr] = periodLabel.split(' ');
    const month = MONTHS.indexOf(monthName) + 1;
    if (month === 0) throw new Error(`Cannot parse periodLabel: ${periodLabel}`);
    return [month, parseInt(yearStr, 10)];
  }
}
