import { Module } from '@nestjs/common';
import { AcademicsService }    from './services/academics.service';
import { AcademicsController } from './controllers/academics.controller';
import { ComplianceModule }    from '../../core/compliance/compliance.module';

@Module({
  imports:     [ComplianceModule],
  providers:   [AcademicsService],
  controllers: [AcademicsController],
  exports:     [AcademicsService],
})
export class AcademicsModule {}
