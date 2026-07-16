import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

import { PrismaModule } from '@infra/database/prisma.module';
import { QUEUE_NAMES } from '@infra/queue/queue.module';

import { SaasBillingController } from './saas-billing.controller';
import { BillingCycleProcessor } from './billing-cycle.processor';
// PR-3A: DunningProcessor ('retry-payment') is NOT registered here --
// confirmed nothing in the codebase ever produced a 'retry-payment' job, so
// it was dead even when it was registered. DunningWorker ('execute') is
// what messaging.producer.ts's scheduleDunningAttempt() actually sends jobs
// to, and is schema-correct (its sibling, dunning.service.ts, referenced
// fields that don't exist on DunningAttempt -- also unregistered, zero
// consumers). Both old files are kept in the repo with deprecation headers
// rather than deleted here -- see dunning.processor.ts and
// dunning/dunning.service.ts for the full rationale and the exact
// re-verification commands to run before a future, separately-reviewed
// deletion PR.
import { DunningWorker } from '@infra/queue/workers/dunning.worker';

import { PricingPlansModule } from './catalog/pricing-plans/pricing-plans.module';
import { SaasPaymentModule }  from './payment/saas-payment.module';

@Module({
  imports: [
    PrismaModule,

    PricingPlansModule,
    SaasPaymentModule,

    BullModule.registerQueue({
      name: QUEUE_NAMES.BILLING_CYCLE,
    }),

    BullModule.registerQueue({
      name: QUEUE_NAMES.NOTIFICATIONS,
    }),
  ],
  controllers: [SaasBillingController],
  providers: [
    BillingCycleProcessor,
    DunningWorker,
  ],
  exports: [
    PricingPlansModule,
    SaasPaymentModule,
  ],
})
export class SaasBillingModule {}
