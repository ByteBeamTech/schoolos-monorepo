// core/messaging/producers/messaging.producer.ts
// Wraps BullMQ queue.add() calls with typed event payloads.
// Inject this service wherever you need to fire domain events.

import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue }        from '@nestjs/bull';
import { Queue }              from 'bull';
import { QUEUE_NAMES }        from '../../../infra/queue/queue.module';
import { validateEvent, EventType } from '../events/index';

@Injectable()
export class MessagingProducer {
  private readonly logger = new Logger(MessagingProducer.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS)   private readonly notifQueue:   Queue,
    @InjectQueue(QUEUE_NAMES.BILLING_CYCLE)   private readonly billingQueue:  Queue,
    @InjectQueue(QUEUE_NAMES.DUNNING)         private readonly dunningQueue:  Queue,
    @InjectQueue(QUEUE_NAMES.ATTENDANCE)      private readonly attendanceQueue: Queue,
  ) {}

  // ─── Generic typed emit ─────────────────────────────────────────────────────

  async emit<T extends EventType>(type: T, payload: unknown): Promise<void> {
    const validated = validateEvent(type, payload);
    this.logger.debug(`[MessagingProducer] emit ${type}`);

    // Route to correct queue based on event type
    switch (type) {
      case 'TenantBillPaid':
      case 'TenantBillFailed':
        await this.billingQueue.add('billing-event', validated);
        break;
      case 'TenantSuspended':
      case 'TenantReactivated':
        await this.dunningQueue.add('tenant-status', validated);
        break;
      case 'LicenseExpiryWarning':
        await this.notifQueue.add('license-expiry-warning', validated);
        break;
      default:
        await this.notifQueue.add('domain-event', validated);
    }
  }

  // ─── Notification dispatch ──────────────────────────────────────────────────

  async sendNotification(payload: {
    notificationId: string;
    tenantId:       string;
    channel:        'EMAIL' | 'SMS' | 'PUSH' | 'WHATSAPP';
    to:             string;
    subject?:       string;
    body:           string;
  }): Promise<void> {
    await this.notifQueue.add('send', payload, {
      attempts:    3,
      backoff:     { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
    });
  }

  // ─── Billing cycle ──────────────────────────────────────────────────────────

  async scheduleBillingRenewal(payload: {
    tenantId:       string;
    subscriptionId: string;
    periodEnd:      string;
  }): Promise<void> {
    const delay = new Date(payload.periodEnd).getTime() - Date.now();
    await this.billingQueue.add('renew', payload, {
      delay:   Math.max(0, delay),
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }

  async snapshotStudentCount(payload: {
    tenantId:       string;
    subscriptionId: string;
  }): Promise<void> {
    await this.billingQueue.add('snapshot-student-count', payload);
  }

  // ─── Dunning ────────────────────────────────────────────────────────────────

  async scheduleDunningAttempt(payload: {
    subscriptionId: string;
    tenantId:       string;
    attemptNumber:  number;
    action:         string;
    delayMs:        number;
  }): Promise<void> {
    await this.dunningQueue.add('execute', payload, {
      delay:    payload.delayMs,
      attempts: 2,
      backoff:  { type: 'fixed', delay: 10000 },
    });
  }

  // ─── Attendance report ──────────────────────────────────────────────────────

  async queueAttendanceReport(payload: {
    tenantId:   string;
    branchId?:  string;
    classId?:   string;
    date:       string;
    reportType: 'daily' | 'weekly' | 'monthly';
  }): Promise<void> {
    await this.attendanceQueue.add('generate-report', payload, {
      attempts: 2,
      removeOnComplete: true,
    });
  }
}
