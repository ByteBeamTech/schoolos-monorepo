import { Module }             from '@nestjs/common';
import { AdmissionsService }  from './services/admissions.service';
import { AdmissionsController } from './controllers/admissions.controller';
import { PromotionService }   from './services/promotion.service';
import { PromotionController } from './controllers/promotion.controller';
import { PrismaModule }       from '../../infra/database/prisma.module';
import { ComplianceModule }   from '../../core/compliance/compliance.module';
import { RolesModule }        from '../../core/roles/roles.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports:     [PrismaModule, ComplianceModule, RolesModule, NotificationsModule],
  providers:   [AdmissionsService, PromotionService],
  controllers: [AdmissionsController, PromotionController],
  exports:     [AdmissionsService],
})
export class AdmissionsModule {}
