import { Module }           from '@nestjs/common';
import { BullModule }       from '@nestjs/bull';
import { QUEUE_NAMES }      from '../../infra/queue/queue.module';

import { EmailChannel }     from './channels/email.channel';
import { SmsChannel }       from './channels/sms.channel';
import { WhatsAppChannel }  from './channels/whatsapp.channel';

import { NotificationProcessor }  from './queue/notification.processor';
import { NotificationService }    from './services/notification.service';
import { NotificationController } from './controllers/notification.controller';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.NOTIFICATIONS }),
  ],
  providers: [
    // Channels
    EmailChannel,
    SmsChannel,
    WhatsAppChannel,
    // Queue processor
    NotificationProcessor,
    // Service
    NotificationService,
  ],
  controllers: [NotificationController],
  exports:     [NotificationService],
})
export class NotificationsModule {}
