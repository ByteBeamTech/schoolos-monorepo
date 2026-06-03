import { Module } from '@nestjs/common';

import { PrismaModule } from '@infra/database/prisma.module';

import { AcademicCalendarController } from './controllers/academic-calendar.controller';

import { AcademicCalendarService } from './services/academic-calendar.service';
import { CalendarEngineService } from './services/calendar-engine.service';

@Module({
  imports: [PrismaModule],
  controllers: [AcademicCalendarController],
  providers: [
    AcademicCalendarService,
    CalendarEngineService,
  ],
  exports: [
    AcademicCalendarService,
    CalendarEngineService,
  ],
})
export class AcademicCalendarModule {}
