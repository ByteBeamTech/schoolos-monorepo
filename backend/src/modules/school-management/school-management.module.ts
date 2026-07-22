import { Module } from '@nestjs/common';
import { SchoolManagementController } from './school-management.controller';
import { SchoolManagementService }    from './school-management.service';
import { PrismaModule }               from '../../infra/database/prisma.module';
import { ComplianceModule }           from '../../core/compliance/compliance.module';
import { RolesModule }                from '../../core/roles/roles.module';
import { NotificationsModule }        from '../notifications/notifications.module';
import { StudentBillingModule }       from '../student-billing/student-billing.module';

@Module({
  // StudentBillingModule exports DiscountCategoryProvisioningService (see
  // createBranch). No cycle: student-billing imports neither module.
  imports:     [PrismaModule, ComplianceModule, RolesModule, NotificationsModule, StudentBillingModule],
  controllers: [SchoolManagementController],
  providers:   [SchoolManagementService],
  exports:     [SchoolManagementService],
})
export class SchoolManagementModule {}
