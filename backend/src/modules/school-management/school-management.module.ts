import { Module } from '@nestjs/common';
import { SchoolManagementController } from './school-management.controller';
import { SchoolManagementService }    from './school-management.service';
import { PrismaModule }               from '../../infra/database/prisma.module';
import { ComplianceModule }           from '../../core/compliance/compliance.module';
import { RolesModule }                from '../../core/roles/roles.module';

@Module({
  imports:     [PrismaModule, ComplianceModule, RolesModule],
  controllers: [SchoolManagementController],
  providers:   [SchoolManagementService],
  exports:     [SchoolManagementService],
})
export class SchoolManagementModule {}
