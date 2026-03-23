import { Module } from '@nestjs/common';
import { StaffService }    from './services/staff.service';
import { StaffController } from './controllers/staff.controller';
import { ComplianceModule } from '../../core/compliance/compliance.module';

@Module({
  imports:     [ComplianceModule],
  providers:   [StaffService],
  controllers: [StaffController],
  exports:     [StaffService],
})
export class StaffModule {}
