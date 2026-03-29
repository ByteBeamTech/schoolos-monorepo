import { Global, Module }           from '@nestjs/common';
import { BullModule }               from '@nestjs/bull';
import { FeatureFlagService }       from './feature-flags.service';
import { FeatureFlagsController }   from './feature-flags.controller';
import { QUEUE_NAMES }              from '../../infra/queue/queue.module';

@Global()   // ← This is the missing decorator. Makes FeatureFlagService
            //   available application-wide without re-importing the module.
@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_NAMES.NOTIFICATIONS }, // required by FeatureFlagService
    ),
  ],
  controllers: [FeatureFlagsController],
  providers:   [FeatureFlagService],
  exports:     [FeatureFlagService],       // must be exported for DI in CronEngine
})
export class FeatureFlagsModule {}
