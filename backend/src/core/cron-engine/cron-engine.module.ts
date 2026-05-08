import { Module } from '@nestjs/common';

import { CronEngine } from './cron-engine.service';

import { ComplianceModule } from '../compliance/compliance.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

import { QueueModule } from '../../infra/queue/queue.module';

@Module({
  imports: [
    ComplianceModule,
    FeatureFlagsModule,
    QueueModule,
  ],
  providers: [CronEngine],
  exports: [CronEngine],
})
export class CronEngineModule {}
