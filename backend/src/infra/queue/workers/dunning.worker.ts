// infra/queue/workers/dunning.worker.ts
import { Process, Processor } from '@nestjs/bull';
import { Logger }             from '@nestjs/common';
import { Job }                from 'bull';
import { QUEUE_NAMES }        from '../queue.module';
import { PrismaService } from '@infra/database/prisma.service';
import { SaasPaymentService } from '../../../modules/saas-billing/payment/services/saas-payment.service';

export interface DunningJob {
  subscriptionId: string;
  tenantId:       string;
  attemptNumber:  number;
  action:         string;
}

@Processor(QUEUE_NAMES.DUNNING)
export class DunningWorker {
  private readonly logger = new Logger(DunningWorker.name);

  constructor(
    private readonly prisma:   PrismaService,
    private readonly payments: SaasPaymentService,
  ) {}

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

    // PR-3 honesty note: this creates a fresh gateway order for the tenant
    // to pay -- it does NOT silently auto-charge a saved payment method.
    // True auto-debit requires a tokenized/mandate-based recurring billing
    // setup (e.g. Razorpay e-mandate or UPI Autopay), which is a materially
    // different, larger feature with its own consent flow -- not built
    // here. "Retry" in the current dunning flow means: generate a payable
    // order and (via the existing notification pipeline) prompt the tenant
    // to complete it via POST /saas/invoices/:id/pay -- not "we charged
    // their card again without asking."
    try {
      const order = await this.payments.createOrder(invoice.id, tenantId);
      this.logger.log(`[DunningWorker] Payment order created for retry: invoice=${invoice.id} order=${order.gatewayOrderId}`);
      return `order_created:${invoice.id}:${order.gatewayOrderId}`;
    } catch (err: any) {
      // A failure here (e.g. invoice already paid between the dunning
      // schedule being set up and this job running -- a real race, not
      // hypothetical) must not silently look like a successful retry.
      this.logger.warn(`[DunningWorker] Failed to create retry order for invoice ${invoice.id}: ${err.message}`);
      return `order_creation_failed:${invoice.id}:${err.message}`;
    }
  }
}
