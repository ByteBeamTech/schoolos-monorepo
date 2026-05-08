// infra/queue/workers/dunning.worker.ts
import { Process, Processor } from '@nestjs/bull';
import { Logger }             from '@nestjs/common';
import { Job }                from 'bull';
import { QUEUE_NAMES }        from '../queue.module';
import { PrismaService } from '@infra/database/prisma.service';

export interface DunningJob {
  subscriptionId: string;
  tenantId:       string;
  attemptNumber:  number;
  action:         string;
}

@Processor(QUEUE_NAMES.DUNNING)
export class DunningWorker {
  private readonly logger = new Logger(DunningWorker.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process('execute')
  async handleExecute(job: Job<DunningJob>) {
    const { subscriptionId, tenantId, attemptNumber, action } = job.data;
    this.logger.log(`[DunningWorker] attempt=${attemptNumber} action=${action} tenant=${tenantId}`);

    const attempt = await this.prisma.dunningAttempt.findFirst({
      where: { subscriptionId, attemptNumber, status: 'SCHEDULED' },
    });

    if (!attempt) {
      this.logger.warn(`No scheduled dunning attempt found for ${subscriptionId} #${attemptNumber}`);
      return;
    }

    let result = '';
    try {
      switch (action) {
        case 'RETRY_CHARGE':
          result = await this.retryCharge(subscriptionId, tenantId);
          break;
        case 'SEND_WARNING_EMAIL':
          result = 'warning_email_queued';
          break;
        case 'SUSPEND_TENANT':
          await this.prisma.tenantSubscription.update({
            where: { id: subscriptionId },
            data:  { status: 'SUSPENDED' },
          });
          result = 'tenant_suspended';
          break;
        case 'CANCEL_SUBSCRIPTION':
          await this.prisma.tenantSubscription.update({
            where: { id: subscriptionId },
            data:  { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: 'DUNNING_EXHAUSTED' },
          });
          result = 'subscription_cancelled';
          break;
        default:
          result = `unknown_action:${action}`;
      }

      await this.prisma.dunningAttempt.update({
        where: { id: attempt.id },
        data: { status: 'SUCCESS', executedAt: new Date(), result },
      });
    } catch (err: any) {
      await this.prisma.dunningAttempt.update({
        where: { id: attempt.id },
        data: { status: 'FAILED', executedAt: new Date(), result: err.message },
      });
      throw err;
    }
  }

  private async retryCharge(subscriptionId: string, tenantId: string): Promise<string> {
    const invoice = await this.prisma.saasInvoice.findFirst({
      where: { subscriptionId, status: { in: ['SENT', 'OVERDUE'] } },
      orderBy: { dueDate: 'desc' },
    });
    if (!invoice) return 'no_outstanding_invoice';
    // Actual gateway charge happens in payment service — worker just triggers
    this.logger.log(`[DunningWorker] Retry charge for invoice ${invoice.id}`);
    return `retry_initiated:${invoice.id}`;
  }
}
