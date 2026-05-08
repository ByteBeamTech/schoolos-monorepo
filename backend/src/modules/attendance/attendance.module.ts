import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AttendanceService }    from './services/attendance.service';
import { LeaveService }         from './leave/leave.service';
import { AttendanceController } from './controllers/attendance.controller';
import { ComplianceModule }     from '../../core/compliance/compliance.module';

@Module({
  imports:     [ComplianceModule, EventEmitterModule],
  providers:   [AttendanceService, LeaveService],
  controllers: [AttendanceController],
  exports:     [AttendanceService, LeaveService],
})
export class AttendanceModule {}
