import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { QueueManagerService } from '../queues/queue-manager.service';
import { COMMUNICATION_QUEUES } from '../queues/queue.constants';

@Injectable()
export class CommunicationsOrchestrator {
  constructor(private readonly queueManager: QueueManagerService) {}

  async handleEvent(event: {
    tenantId: string;
    eventType: string;
    payload: any;
    channels?: string[];
  }) {
    const traceId = randomUUID();
    const channels = event.channels || ['EMAIL'];

    for (const channel of channels) {
      await this.queueManager.dispatch(
        COMMUNICATION_QUEUES.TRANSACTIONAL,
        'send-communication',
        {
          traceId,
          channel,
          ...event,
        },
      );
    }

    return { success: true, traceId };
  }
}
