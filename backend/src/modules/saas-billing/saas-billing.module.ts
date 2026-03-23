import { Module }                from '@nestjs/common';
import { BullModule }            from '@nestjs/bull';
import { QUEUE_NAMES }           from '../../infra/queue/queue.module';
import { BillingCycleProcessor } from './billing-cycle.processor';
import { DunningProcessor }      from './dunning.processor';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_NAMES.BILLING_CYCLE },
      { name: QUEUE_NAMES.DUNNING },
    ),
  ],
  providers: [BillingCycleProcessor, DunningProcessor],
})
export class SaasBillingModule {}
