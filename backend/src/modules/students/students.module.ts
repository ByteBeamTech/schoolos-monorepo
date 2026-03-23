import { Module } from '@nestjs/common';
import { StudentsService }    from './services/students.service';
import { StudentsController } from './controllers/students.controller';
import { ComplianceModule }   from '../../core/compliance/compliance.module';

@Module({
  imports:     [ComplianceModule],
  providers:   [StudentsService],
  controllers: [StudentsController],
  exports:     [StudentsService],
})
export class StudentsModule {}
