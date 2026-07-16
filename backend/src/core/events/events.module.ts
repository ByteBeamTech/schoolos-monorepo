import { Module }                from '@nestjs/common';
import { EventListenerService }  from './event-listener.service';
import { PrismaModule }          from '../../infra/database/prisma.module';
import { BullModule }            from '@nestjs/bull';
import { QUEUE_NAMES }           from '../../infra/queue/queue.module';
import { NotificationsModule } from '../../modules/notifications/notifications.module';
// PR-3: OutboxWorker was fully built (atomic claim, tenant throttling,
// exponential backoff) but never registered anywhere -- dead code. Lives
// here, not in saas-billing, because it processes the app-wide EventOutbox
// table generically (any domain can write a row; this is what turns it into
// a real event), not just billing events.
import { OutboxWorker } from '../../infra/queue/workers/outbox.worker';
@Module({
  imports: [
    PrismaModule, NotificationsModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.NOTIFICATIONS }),
  ],
  providers: [EventListenerService, OutboxWorker],
  exports:   [EventListenerService],
})
export class EventsModule {}
