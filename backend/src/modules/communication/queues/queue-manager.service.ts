import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

import { COMMUNICATION_QUEUES } from './queue.constants';

@Injectable()
export class QueueManagerService {
  constructor(
    @InjectQueue(COMMUNICATION_QUEUES.CRITICAL)
    private readonly criticalQueue: Queue,

    @InjectQueue(COMMUNICATION_QUEUES.TRANSACTIONAL)
    private readonly transactionalQueue: Queue,

    @InjectQueue(COMMUNICATION_QUEUES.BULK)
    private readonly bulkQueue: Queue,

    @InjectQueue(COMMUNICATION_QUEUES.OPS)
    private readonly opsQueue: Queue,
  ) {}

  async dispatch(
    queueName: string,
    jobName: string,
    payload: any,
  ) {
    const queueMap = {
      [COMMUNICATION_QUEUES.CRITICAL]: this.criticalQueue,
      [COMMUNICATION_QUEUES.TRANSACTIONAL]: this.transactionalQueue,
      [COMMUNICATION_QUEUES.BULK]: this.bulkQueue,
      [COMMUNICATION_QUEUES.OPS]: this.opsQueue,
    };

    const queue = queueMap[queueName];

    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    return queue.add(jobName, payload, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }
}
