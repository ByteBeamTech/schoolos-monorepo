// backend/src/modules/behavior/behavior.module.ts
import { Module }              from '@nestjs/common';
import { BehaviorService }     from './services/behavior.service';
import { BehaviorController }  from './controllers/behavior.controller';

@Module({
  providers:   [BehaviorService],
  controllers: [BehaviorController],
  exports:     [BehaviorService],
})
export class BehaviorModule {}
