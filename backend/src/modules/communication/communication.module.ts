import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

import { CommunicationService } from './services/communication.service';
import { CommunicationController } from './controllers/communication.controller';

import { PrismaModule } from '../../infra/database/prisma.module';
import { ComplianceModule } from '../../core/compliance/compliance.module';
import { RolesModule } from '../../core/roles/roles.module';

import { CommunicationsOrchestrator } from './orchestrator/communications.orchestrator';
import { QueueManagerService } from './queues/queue-manager.service';
import { NotificationLogService } from './logs/notification-log.service';
import { TemplateService } from './templates/template.service';

import { COMMUNICATION_QUEUES } from './queues/queue.constants';

@Module({
  imports: [
    PrismaModule,
    ComplianceModule,
    RolesModule,

    BullModule.registerQueue(
      { name: COMMUNICATION_QUEUES.CRITICAL },
      { name: COMMUNICATION_QUEUES.TRANSACTIONAL },
      { name: COMMUNICATION_QUEUES.BULK },
      { name: COMMUNICATION_QUEUES.OPS },
    ),
  ],

  controllers: [CommunicationController],

  providers: [
    CommunicationService,

    CommunicationsOrchestrator,
    QueueManagerService,
    NotificationLogService,
    TemplateService,
  ],

  exports: [
    CommunicationService,

    CommunicationsOrchestrator,
    QueueManagerService,
    NotificationLogService,
    TemplateService,
  ],
})
export class CommunicationModule {}

