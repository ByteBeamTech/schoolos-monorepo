import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

export const QUEUE_NAMES = {
  NOTIFICATIONS:   'notifications',
  BILLING_CYCLE:   'billing-cycle',
  DUNNING:         'dunning',
  REPORTS:         'reports',
  ATTENDANCE:      'attendance',
  DOCUMENTS:       'documents',
  EMAIL:           'email',
  SMS:             'sms',
  PUSH:            'push',
  WHATSAPP:        'whatsapp',
  BULK_OPERATIONS: 'bulk-operations',
} as const;

@Global()
@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_NAMES.NOTIFICATIONS },
      { name: QUEUE_NAMES.BILLING_CYCLE },
      { name: QUEUE_NAMES.DUNNING },
      { name: QUEUE_NAMES.REPORTS },
      { name: QUEUE_NAMES.ATTENDANCE },
      { name: QUEUE_NAMES.DOCUMENTS },
      { name: QUEUE_NAMES.EMAIL },
      { name: QUEUE_NAMES.SMS },
      { name: QUEUE_NAMES.PUSH },
      { name: QUEUE_NAMES.WHATSAPP },
      { name: QUEUE_NAMES.BULK_OPERATIONS },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
