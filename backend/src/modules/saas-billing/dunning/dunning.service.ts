// ⚠️ DEPRECATED (PR-3A) — never registered as a provider anywhere, zero
// consumers. Kept, not deleted, per review feedback (see dunning.processor.ts
// for the full rationale). Also has a real correctness problem beyond being
// unused: it references DunningAttempt fields (invoiceId, stage,
// gatewayError, resolvedAt) that don't exist on the actual schema (real
// fields: subscriptionId, attemptNumber, status, action, scheduledAt,
// executedAt, result) -- every call below is protected from surfacing that
// as a type error only by the `as any` casts, which is exactly the masking
// pattern PR-1 was about removing elsewhere. Do not start calling this from
// new code; it would not compile without the as-any casts, and even with
// them, it would silently fail (see the .catch(() => ...) on every call).
//
// Verified zero consumers as of PR-3A (re-run before deleting):
//   grep -R "DunningService" backend/src
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue }        from '@nestjs/bull';
import { Queue }              from 'bull';
import { PrismaService } from '@infra/database/prisma.service';

const DUNNING_SCHEDULE = [
  { stage: 'OVERDUE',   dayOffset: 0,  action: 'RETRY_CHARGE' },
  { stage: 'WARNED',    dayOffset: 3,  action: 'SEND_WARNING_EMAIL' },
  { stage: 'SUSPENDED', dayOffset: 7,  action: 'SUSPEND_TENANT' },
  { stage: 'CANCELLED', dayOffset: 14, action: 'CANCEL_SUBSCRIPTION' },
] as const;

@Injectable()
export class DunningService {
  private readonly logger = new Logger(DunningService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('dunning') private readonly dunningQueue: Queue,
  ) {}

  async initiate(tenantId: string, invoiceId: string) {
    return (this.prisma as any).dunningAttempt?.create({
      data: { tenantId, invoiceId, stage: 'OVERDUE', attemptNumber: 1 },
    }).catch(() => ({ id: 'no-table', tenantId, invoiceId, stage: 'OVERDUE' }));
  }

  async advance(attemptId: string, gatewayError?: string): Promise<void> {
    const attempt = await (this.prisma as any).dunningAttempt?.findUnique({
      where: { id: attemptId },
    }).catch(() => null);
    if (!attempt) return;

    const currentIdx = DUNNING_SCHEDULE.findIndex(s => s.stage === attempt.stage);
    const next = DUNNING_SCHEDULE[currentIdx + 1];
    if (!next) return;

    await (this.prisma as any).dunningAttempt?.update({
      where: { id: attemptId },
      data: {
        stage: next.stage,
        attemptNumber: attempt.attemptNumber + 1,
        gatewayError: gatewayError ?? null,
        executedAt: new Date(),
      },
    }).catch(() => null);

    if (next.stage === 'SUSPENDED' || next.stage === 'CANCELLED') {
      await this.dunningQueue.add(next.action, {
        tenantId: attempt.tenantId,
        invoiceId: attempt.invoiceId,
        stage: next.stage,
      }).catch(() => null);
    }
  }

  async resolve(tenantId: string, invoiceId: string): Promise<void> {
    await (this.prisma as any).dunningAttempt?.updateMany({
      where: { tenantId, invoiceId },
      data: { stage: 'ACTIVE', resolvedAt: new Date() },
    }).catch(() => null);

    await this.dunningQueue.add('REACTIVATE_TENANT', { tenantId }).catch(() => null);
  }

  async listInDunning(stage?: string) {
    return (this.prisma as any).dunningAttempt?.findMany({
      where: stage ? { stage } : undefined,
      orderBy: { executedAt: 'desc' },
    }).catch(() => []) ?? [];
  }
}
