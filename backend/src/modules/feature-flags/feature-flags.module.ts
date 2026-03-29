import { Global, Module }           from '@nestjs/common';
import { BullModule }               from '@nestjs/bull';
// 🚀 FIX 1: Service is in 'core', not here
import { FeatureFlagService }       from '../../core/feature-flags/feature-flags.service'; 
import { FeatureFlagsController }   from './feature-flags.controller';
// 🚀 FIX 2: Compliance is also in 'core'
import { ComplianceModule }         from '../../core/compliance/compliance.module'; 
import { QUEUE_NAMES }              from '../../infra/queue/queue.module';

@Global()
@Module({
  imports: [
    ComplianceModule,
    BullModule.registerQueue(
      { name: QUEUE_NAMES.NOTIFICATIONS },
    ),
  ],
  controllers: [FeatureFlagsController],
  providers:   [FeatureFlagService],
  exports:     [FeatureFlagService],
})
export class FeatureFlagsModule {}
