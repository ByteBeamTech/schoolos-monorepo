import { Module }                from '@nestjs/common';
import { EventEmitterModule }    from '@nestjs/event-emitter';
import { GradebookService }      from './services/gradebook.service';
import { GradebookController }   from './controllers/gradebook.controller';
import { ReportCardService }     from './services/report-card.service';
import { ReportCardController }  from './controllers/report-card.controller';
import { PrismaModule }          from '../../infra/database/prisma.module';
import { RolesModule }           from '../../core/roles/roles.module';

@Module({
  imports:     [PrismaModule, RolesModule, EventEmitterModule.forRoot()],
  providers:   [GradebookService, ReportCardService],
  controllers: [GradebookController, ReportCardController],
  exports:     [GradebookService, ReportCardService],
})
export class GradebookModule {}
