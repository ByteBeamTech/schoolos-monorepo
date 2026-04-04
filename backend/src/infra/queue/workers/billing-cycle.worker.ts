// infra/queue/workers/billing-cycle.worker.ts
import { Process, Processor } from '@nestjs/bull';
import { Logger }             from '@nestjs/common';
import { Job }                from 'bull';
import { QUEUE_NAMES }        from '../queue.module';
import { PrismaService } from '@infra/database/prisma.service';

export interface BillingCycleJob {
  tenantId:       string;
  subscriptionId: string;
  periodEnd:      string;
}

@Processor(QUEUE_NAMES.BILLING_CYCLE)
export class BillingCycleWorker {
  private readonly logger = new Logger(BillingCycleWorker.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process('renew')
  async handleRenew(job: Job<BillingCycleJob>) {
    const { tenantId, subscriptionId, periodEnd } = job.data;
    this.logger.log(`[BillingCycleWorker] Renewing subscription ${subscriptionId} for tenant ${tenantId}`);

    const subscription = await this.prisma.tenantSubscription.findUnique({
      where:   { id: subscriptionId },
      include: { plan: true },
    });

    if (!subscription) {
      this.logger.warn(`Subscription ${subscriptionId} not found — skipping`);
      return;
    }

    if (subscription.status === 'CANCELLED' || subscription.status === 'SUSPENDED') {
      this.logger.warn(`Subscription ${subscriptionId} is ${subscription.status} — skipping renewal`);
      return;
    }

    const newStart = new Date(periodEnd);
    const newEnd   = new Date(newStart);
    newEnd.setMonth(newEnd.getMonth() + subscription.plan.billingCycleMonths);

    // Generate new invoice
    const invoiceNumber = `INV-SAAS-${Date.now()}`;
    await this.prisma.saasInvoice.create({
      data: {
        subscriptionId,
        invoiceNumber,
        status:        'DRAFT',
        currency:      subscription.currency,
        subtotal:      subscription.plan.baseFee ?? 0,
        discountAmount: 0,
        taxAmount:     0,
        totalAmount:   subscription.plan.baseFee ?? 0,
        periodStart:   newStart,
        periodEnd:     newEnd,
        studentCount:  subscription.studentCountAtBilling,
        dueDate:       newStart,
      },
    });

    // Advance period
    await this.prisma.tenantSubscription.update({
      where: { id: subscriptionId },
      data: {
        currentPeriodStart: newStart,
        currentPeriodEnd:   newEnd,
        status:             'ACTIVE',
      },
    });

    this.logger.log(`Subscription ${subscriptionId} renewed → ${newEnd.toISOString()}`);
  }

  @Process('snapshot-student-count')
  async handleStudentSnapshot(job: Job<{ tenantId: string; subscriptionId: string }>) {
    const { tenantId, subscriptionId } = job.data;
    const count = await this.prisma.student.count({
      where: { tenantId, isActive: true },
    });
    await this.prisma.tenantSubscription.update({
      where: { id: subscriptionId },
      data: {
        studentCountAtBilling: count,
        lastStudentCountDate:  new Date(),
      },
    });
    this.logger.log(`[BillingCycleWorker] Student snapshot: tenant=${tenantId} count=${count}`);
  }
}
