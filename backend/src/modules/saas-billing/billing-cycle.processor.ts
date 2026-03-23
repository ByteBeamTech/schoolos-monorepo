import { Process, Processor } from '@nestjs/bull';
import { Logger }             from '@nestjs/common';
import { Job }                from 'bull';
import { PrismaService }      from '../../infra/database/prisma.service';
import { QUEUE_NAMES }        from '../../infra/queue/queue.module';

@Processor(QUEUE_NAMES.BILLING_CYCLE)
export class BillingCycleProcessor {
  private readonly logger = new Logger(BillingCycleProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process('generate-invoice')
  async handleGenerateInvoice(job: Job<{ subscriptionId: string; tenantId: string; planId: string; billedAt: string }>) {
    const { subscriptionId, tenantId, billedAt } = job.data;
    this.logger.log(`Generating SaaS invoice for subscription ${subscriptionId}`);

    const subscription = await this.prisma.tenantSubscription.findUnique({
      where:   { id: subscriptionId },
      include: { plan: true, tenant: true },
    });

    if (!subscription) { this.logger.warn(`Subscription ${subscriptionId} not found`); return; }

    // Calculate amount based on pricing model
    let subtotal = 0;
    if (subscription.model === 'SUBSCRIPTION') {
      subtotal = Number(subscription.customBaseFee ?? subscription.plan.baseFee ?? 0);
    } else if (subscription.model === 'PER_STUDENT') {
      const rate  = Number(subscription.customPerStudentRate ?? subscription.plan.perStudentRate ?? 0);
      const count = subscription.studentCountAtBilling ?? 0;
      subtotal    = rate * count;
    } else if (subscription.model === 'HYBRID') {
      const base  = Number(subscription.customBaseFee ?? subscription.plan.baseFee ?? 0);
      const rate  = Number(subscription.customPerStudentRate ?? subscription.plan.perStudentRate ?? 0);
      const count = subscription.studentCountAtBilling ?? 0;
      subtotal    = base + (rate * count);
    }

    const year     = new Date().getFullYear();
    const count    = await this.prisma.saasInvoice.count({ where: { subscription: { tenantId } } });
    const invoiceNumber = `SINV-${year}-${String(count + 1).padStart(5, '0')}`;

    const dueDate = new Date(billedAt);
    dueDate.setDate(dueDate.getDate() + 15); // 15 days to pay

    await this.prisma.saasInvoice.create({
      data: {
        subscriptionId,
        invoiceNumber,
        status:        'SENT' as any,
        currency:      subscription.currency,
        subtotal,
        discountAmount: 0,
        taxAmount:      Math.round(subtotal * 0.18 * 100) / 100, // 18% GST
        totalAmount:    subtotal + Math.round(subtotal * 0.18 * 100) / 100,
        periodStart:    subscription.currentPeriodStart,
        periodEnd:      subscription.currentPeriodEnd,
        studentCount:   subscription.studentCountAtBilling,
        dueDate,
        lineItems:      JSON.stringify([{ description: subscription.plan.name, amount: subtotal }]),
      },
    });

    this.logger.log(`SaaS invoice ${invoiceNumber} created for tenant ${tenantId}: ₹${subtotal}`);
  }
}
