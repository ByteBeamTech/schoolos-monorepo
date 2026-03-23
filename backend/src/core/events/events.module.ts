import { Module }                from '@nestjs/common';
import { EventListenerService }  from './event-listener.service';
import { PrismaModule }          from '../../infra/database/prisma.module';
import { BullModule }            from '@nestjs/bull';
import { QUEUE_NAMES }           from '../../infra/queue/queue.module';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.NOTIFICATIONS }),
  ],
  providers: [EventListenerService],
  exports:   [EventListenerService],
})
export class EventsModule {}
