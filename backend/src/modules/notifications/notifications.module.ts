import { Module }           from '@nestjs/common';
import { BullModule }       from '@nestjs/bull';
import { QUEUE_NAMES }      from '../../infra/queue/queue.module';

import { TemplateService } from './templates/template.service';

import { EmailChannel }     from './channels/email.channel';
import { SmsChannel }       from './channels/sms.channel';
import { WhatsAppChannel }  from './channels/whatsapp.channel';
import { PushChannel }      from './channels/push/push.channel';

import { NotificationProcessor }  from './queue/notification.processor';
import { NotificationService }    from './services/notification.service';
import { NotificationController } from './controllers/notification.controller';

import { NotificationEventService } from './events/notification-event.service';
import { NotificationDispatcherService }from './dispatcher/notification-dispatcher.service';



@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.NOTIFICATIONS }),
  ],
  providers: [
    // Channels
    EmailChannel,
    SmsChannel,
    NotificationDispatcherService,
    WhatsAppChannel,
    PushChannel,
    TemplateService,
    // Queue processor
    NotificationProcessor,
    // Service
    NotificationEventService,
    NotificationService,
  ],
  controllers: [ NotificationController ],
  exports:     [NotificationService, 
NotificationEventService, NotificationDispatcherService, TemplateService,
],
})
export class NotificationsModule {}
