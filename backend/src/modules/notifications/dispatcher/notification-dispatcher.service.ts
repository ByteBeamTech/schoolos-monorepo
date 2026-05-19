import { Injectable, Logger } from '@nestjs/common';

import { InjectQueue } from '@nestjs/bull';

import { Queue } from 'bull';

import {
  NotificationEvent,
} from '../events/notification-events.constants';

import { NotificationEventService }
  from '../events/notification-event.service';

import {
  QUEUE_NAMES,
} from '../../../infra/queue/queue.module';

@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(
    NotificationDispatcherService.name,
  );

  constructor(
    @InjectQueue(
      QUEUE_NAMES.NOTIFICATIONS,
    )
    private readonly notificationQueue: Queue,

    private readonly eventService:
      NotificationEventService,
  ) {}

  async dispatch(
    event: NotificationEvent,

    payload: {
      to: string;

      subject?: string;

      templateData?: Record<
        string,
        any
      >;
    },
  ) {
    const channels =
      this.eventService.resolveChannels(
        event,
      );

    const template =
      this.eventService.resolveTemplate(
        event,
      );

    this.logger.log(
      `Dispatching event ${event}`,
    );

    for (const channel of channels) {
      await this.notificationQueue.add(
        'send',
        {
          channel,

          to: payload.to,

          subject:
            payload.subject ||
            event,

          event,

          template,

          templateData:
            payload.templateData || {},
        },

        {
          attempts: 3,

          backoff: {
            type: 'exponential',

            delay: 5000,
          },

          removeOnComplete: true,
        },
      );
    }
  }
}
