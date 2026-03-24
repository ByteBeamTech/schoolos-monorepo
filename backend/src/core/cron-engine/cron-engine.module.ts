import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QUEUE_NAMES } from '../../infra/queue/queue.module';
import { CronEngine } from './cron-engine.service';
import { ComplianceModule } from '../compliance/compliance.module';

@Module({
  imports: [
    ComplianceModule,
    BullModule.registerQueue(
      { name: QUEUE_NAMES.BILLING_CYCLE },
      { name: QUEUE_NAMES.DUNNING },
      { name: QUEUE_NAMES.NOTIFICATIONS },
      { name: QUEUE_NAMES.REPORTS },
      { name: QUEUE_NAMES.BULK_OPERATIONS },
    ),
  ],
  providers: [CronEngine],
  exports: [CronEngine],
})
export class CronEngineModule {}