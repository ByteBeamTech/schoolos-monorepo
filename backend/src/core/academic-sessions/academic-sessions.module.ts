import { Module } from '@nestjs/common';
import { AcademicSessionsService }    from './services/academic-sessions.service';
import { AcademicSessionsController } from './controllers/academic-sessions.controller';
import { ComplianceModule }           from '../compliance/compliance.module';

@Module({
  imports:     [ComplianceModule],
  providers:   [AcademicSessionsService],
  controllers: [AcademicSessionsController],
  exports:     [AcademicSessionsService],
})
export class AcademicSessionsModule {}
