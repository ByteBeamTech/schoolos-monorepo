import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@infra/database/prisma.service';
import { BillingRunService } from './billing-run.service';

/**
 * Runs after a billing rule's cutoff day and creates the branch's billing run
 * for the current month. The completed-run check makes the hourly schedule
 * safe to retry after a restart without creating duplicate invoices.
 */
@Injectable()
export class BillingCutoffScheduler {
  private readonly logger = new Logger(BillingCutoffScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billingRuns: BillingRunService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async processDueCutoffs() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const day = now.getDate();
    const periodLabel = `${now.toLocaleString('en-US', { month: 'long' })} ${year}`;

    const rules = await this.prisma.billingRule.findMany({
      where: {
        billingMonths: { has: month },
        dueDayOfMonth: { lte: day },
      },
      select: { tenantId: true, branchId: true },
    });

    const tenantBranchPairs = new Set<string>();
    for (const rule of rules) {
      if (rule.branchId) {
        tenantBranchPairs.add(`${rule.tenantId}:${rule.branchId}`);
        continue;
      }
      const branches = await this.prisma.branch.findMany({
        where: { tenantId: rule.tenantId },
        select: { id: true },
      });
      for (const branch of branches) tenantBranchPairs.add(`${rule.tenantId}:${branch.id}`);
    }

    for (const pair of tenantBranchPairs) {
      const [tenantId, branchId] = pair.split(':');
      const completed = await this.prisma.billingRun.findFirst({
        where: { tenantId, branchId, periodLabel, status: 'COMPLETED' },
        select: { id: true },
      });
      if (completed) continue;

      try {
        const run = await this.billingRuns.trigger(tenantId, branchId, month, year, 'SCHEDULED', 'system');
        await this.billingRuns.execute(run.id);
        this.logger.log(`Processed fee cutoff for ${periodLabel} in branch ${branchId}`);
      } catch (error: any) {
        this.logger.warn(`Fee cutoff skipped for ${periodLabel} in branch ${branchId}: ${error?.message ?? error}`);
      }
    }
  }
}
