// backend/src/modules/saas-billing/saas-billing.module.ts
// FULL REPLACEMENT — registers the new SaasBillingController
// and imports PrismaModule so the controller can query invoices

import { Module }               from '@nestjs/common';
import { BullModule }           from '@nestjs/bull';
import { SaasBillingController }  from './saas-billing.controller';  // ← NEW
import { BillingCycleProcessor }  from './billing-cycle.processor';
import { DunningProcessor }       from './dunning.processor';
import { PrismaModule }           from '../../infra/database/prisma.module'; // ← NEW
import { QUEUE_NAMES }            from '../../infra/queue/queue.module';

@Module({
  imports: [
    PrismaModule,                                               // ← NEW
    BullModule.registerQueue({ name: QUEUE_NAMES.BILLING }),
    BullModule.registerQueue({ name: QUEUE_NAMES.NOTIFICATIONS }),
  ],
  controllers: [SaasBillingController],                         // ← NEW
  providers:   [BillingCycleProcessor, DunningProcessor],
  exports:     [],
})
export class SaasBillingModule {}
