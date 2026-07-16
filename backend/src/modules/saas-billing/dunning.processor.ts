// ⚠️ DEPRECATED (PR-3A) — not registered in saas-billing.module.ts.
// DunningWorker (infra/queue/workers/dunning.worker.ts) is the canonical,
// live implementation as of PR-3A. This file is kept, not deleted, per
// review feedback: destructive cleanup should follow a separate,
// specifically-verified PR (PR-3B), not ride along with infra registration
// changes -- if a hidden consumer turns up, rollback should be a revert of
// one focused PR, not an unpick from a larger one.
//
// Verified zero consumers as of PR-3A (re-run these before deleting):
//   grep -R "DunningProcessor" backend/src
//   grep -R "retry-payment" backend/src
// Both confirmed: only this file's own class/decorator definitions, no
// producer anywhere calls `.add('retry-payment', ...)`. This processor has
// never received a real job even while it was registered.
import { Process, Processor } from '@nestjs/bull';
import { Logger }             from '@nestjs/common';
import { Job }                from 'bull';
import { PrismaService } from '@infra/database/prisma.service';
import { QUEUE_NAMES }        from '../../infra/queue/queue.module';

@Processor(QUEUE_NAMES.DUNNING)
export class DunningProcessor {
  private readonly logger = new Logger(DunningProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process('retry-payment')
  async handleRetryPayment(job: Job<{ subscriptionId: string; dunningAttemptId: string; attemptNumber: number }>) {
    const { subscriptionId, dunningAttemptId, attemptNumber } = job.data;
    this.logger.log(`Dunning attempt ${attemptNumber} for subscription ${subscriptionId}`);

    const subscription = await this.prisma.tenantSubscription.findUnique({
      where: { id: subscriptionId },
      include: { saasInvoices: { where: { status: { in: ['SENT', 'OVERDUE'] as any[] } }, orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    if (!subscription || !subscription.saasInvoices.length) {
      await this.prisma.dunningAttempt.update({
        where: { id: dunningAttemptId },
        data:  { status: 'FAILED', executedAt: new Date(), result: 'No outstanding invoice found' },
      });
      return;
    }

    // In dev: simulate payment retry (in prod: call Razorpay/Stripe API)
    const invoice        = subscription.saasInvoices[0];
    const gatewayId      = subscription.gatewayCustomerId;
    const isDevMode      = !gatewayId || gatewayId.startsWith('cus_dev');
    const paymentSuccess = isDevMode ? Math.random() > 0.7 : false; // 30% success in dev

    await this.prisma.dunningAttempt.update({
      where: { id: dunningAttemptId },
      data:  {
        status:      paymentSuccess ? 'SUCCESS' : 'FAILED',
        executedAt:  new Date(),
        result:      paymentSuccess ? 'Payment recovered' : `Attempt ${attemptNumber} failed`,
      },
    });

    if (paymentSuccess) {
      await this.prisma.tenantSubscription.update({
        where: { id: subscriptionId },
        data:  { status: 'ACTIVE' },
      });
      await this.prisma.saasInvoice.update({
        where: { id: invoice.id },
        data:  { status: 'PAID' as any, paidAt: new Date() },
      });
      this.logger.log(`Dunning success: subscription ${subscriptionId} recovered`);
    } else {
      this.logger.warn(`Dunning attempt ${attemptNumber} failed for subscription ${subscriptionId}`);
    }
  }
}
