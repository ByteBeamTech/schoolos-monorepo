import { Module }      from '@nestjs/common';
import { HRService }   from './services/hr.service';
import { HRController } from './controllers/hr.controller';
import { PrismaModule } from '../../infra/database/prisma.module';
import { ComplianceModule } from '../../core/compliance/compliance.module';
import { RolesModule }  from '../../core/roles/roles.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports:     [PrismaModule, ComplianceModule, RolesModule, NotificationsModule],
  providers:   [HRService],
  controllers: [HRController],
  exports:     [HRService],
})
export class HRModule {}
