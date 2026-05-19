import { Injectable, Logger } from '@nestjs/common';

import {
  EVENT_TEMPLATE_REGISTRY,
} from './event-template.registry';

import {
  EVENT_CHANNEL_REGISTRY,
} from './event-channel.registry';

import {
  NotificationEvent,
} from './notification-events.constants';

@Injectable()
export class NotificationEventService {
  private readonly logger = new Logger(
    NotificationEventService.name,
  );

  resolveTemplate(
    event: NotificationEvent,
  ): string {
    const template =
      EVENT_TEMPLATE_REGISTRY[event];

    if (!template) {
      throw new Error(
        `No template mapped for event: ${event}`,
      );
    }

    return template;
  }

  resolveChannels(
    event: NotificationEvent,
  ): string[] {
    return (
      EVENT_CHANNEL_REGISTRY[event] ||
      []
    );
  }
}
