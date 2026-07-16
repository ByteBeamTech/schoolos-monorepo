import { Process, Processor } from '@nestjs/bull';
import { Logger }             from '@nestjs/common';
import { Job }                from 'bull';
import { PrismaService } from '@infra/database/prisma.service';
import { QUEUE_NAMES }        from '../../infra/queue/queue.module';

// PR-2 (COMM-004 gap fill): shape of the immutable pricing payload captured
// at subscription time (see onboarding.service.ts). Decimal fields are
// stringified in storage (Prisma Decimal is not directly JSON-serializable).
interface PlanSnapshot {
  name?:           string;
  baseFee?:        string | null;
  perStudentRate?: string | null;
}

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

    // ARCH INVARIANT (ADR COMM-004): invoice calculations MUST use the
    // immutable subscription snapshot, never the mutable pricing catalog.
    // A later PricingPlan edit must not retroactively change what an
    // already-subscribed tenant is billed. Legacy fallback exists only for
    // subscriptions created before PR-2 (planSnapshot is nullable / null on
    // those rows) -- do not widen this fallback for new code paths.
    const snapshot = subscription.planSnapshot as PlanSnapshot | null;
    const usingSnapshot = snapshot != null;

    if (!usingSnapshot) {
      this.logger.warn(
        `Subscription ${subscriptionId} has no planSnapshot (pre-PR-2 record) — ` +
        `falling back to live PricingPlan. This subscription should be backfilled.`,
      );
    }

    const planName        = snapshot?.name ?? subscription.plan.name;
    const snapshotBaseFee = snapshot?.baseFee != null ? Number(snapshot.baseFee) : null;
    const snapshotPerStudentRate = snapshot?.perStudentRate != null ? Number(snapshot.perStudentRate) : null;

    const baseFee = usingSnapshot
      ? (snapshotBaseFee ?? 0)
      : Number(subscription.plan.baseFee ?? 0);
    const perStudentRate = usingSnapshot
      ? (snapshotPerStudentRate ?? 0)
      : Number(subscription.plan.perStudentRate ?? 0);

    // Calculate amount based on pricing model
    let subtotal = 0;
    if (subscription.model === 'FLAT_FEE') {
      subtotal = Number(subscription.customBaseFee ?? baseFee);
    } else if (subscription.model === 'PER_STUDENT') {
      const rate  = Number(subscription.customPerStudentRate ?? perStudentRate);
      const count = subscription.studentCountAtBilling ?? 0;
      subtotal    = rate * count;
    } else {
      const base  = Number(subscription.customBaseFee ?? baseFee);
      const rate  = Number(subscription.customPerStudentRate ?? perStudentRate);
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
        lineItems:      JSON.stringify([{ description: planName, amount: subtotal }]),
      },
    });

    this.logger.log(
      `SaaS invoice ${invoiceNumber} created for tenant ${tenantId}: ₹${subtotal} ` +
      `(pricing source: ${usingSnapshot ? 'snapshot' : 'live plan (legacy fallback)'})`,
    );
  }
}
