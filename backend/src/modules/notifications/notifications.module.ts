import { Module }           from '@nestjs/common';
import { PrismaModule } from '../../infra/database/prisma.module';
import { BullModule }       from '@nestjs/bull';
import { QUEUE_NAMES }      from '../../infra/queue/queue.module';

import { TemplateService } from './templates/template.service';

import { EmailChannel }     from './channels/email.channel';
import { SmsChannel }       from './channels/sms.channel';
import { WhatsAppChannel }  from './channels/whatsapp.channel';
import { PushChannel }      from './channels/push/push.channel';
import { ZohoEmailService }from './providers/email/zoho-email.service';

import { NotificationProcessor }  from './queue/notification.processor';
import { NotificationService }    from './services/notification.service';
import { NotificationController } from './controllers/notification.controller';
import { NotificationEventService } from './events/notification-event.service';
import { NotificationDispatcherService }from './dispatcher/notification-dispatcher.service';
import { NotificationSettingsService } from './settings/services/notification-settings.service';
import { NotificationSettingsController } from './settings/controllers/notification-settings.controller';
import { NotificationPreferencesService }from './preferences/services/notification-preferences.service';
import { NotificationPreferencesController }from './preferences/controllers/notification-preferences.controller';
import { NotificationHistoryService } from './history/services/notification-history.service';
import { NotificationHistoryController } from './history/controllers/notification-history.controller';
import { ProviderTestService } from './settings/services/provider-test.service';
import { ProviderTestController } from './settings/controllers/provider-test.controller';

@Module({
  imports: [
	  PrismaModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.NOTIFICATIONS }),
  ],
  providers: [
    // Channels
    EmailChannel,
    SmsChannel,
    NotificationDispatcherService,
    NotificationHistoryService,
    NotificationPreferencesService,
    WhatsAppChannel,
    PushChannel,
    TemplateService,
    // Queue processor
    NotificationProcessor,
    // Service
    NotificationEventService,
    NotificationSettingsService,
    ZohoEmailService,
    NotificationService,
    ProviderTestService,
  ],
  controllers: [ NotificationController, NotificationSettingsController, NotificationPreferencesController, NotificationHistoryController, ProviderTestController,],
  exports:     [NotificationService, 
NotificationEventService, NotificationDispatcherService, TemplateService,
],
})
export class NotificationsModule {}
