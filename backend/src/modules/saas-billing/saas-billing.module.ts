import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

import { PrismaModule } from '@infra/database/prisma.module';
import { QUEUE_NAMES } from '@infra/queue/queue.module';

import { SaasBillingController } from './saas-billing.controller';
import { BillingCycleProcessor } from './billing-cycle.processor';
import { DunningProcessor } from './dunning.processor';

import { PricingPlansModule } from './catalog/pricing-plans/pricing-plans.module';

@Module({
  imports: [
    PrismaModule,

    PricingPlansModule,

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
    DunningProcessor,
  ],
  exports: [
    PricingPlansModule,
  ],
})
export class SaasBillingModule {}
