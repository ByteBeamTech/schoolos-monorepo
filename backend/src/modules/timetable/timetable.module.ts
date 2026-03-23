import { Module }             from '@nestjs/common';
import { TimetableService }   from './services/timetable.service';
import { TimetableController } from './controllers/timetable.controller';

@Module({
  providers:   [TimetableService],
  controllers: [TimetableController],
  exports:     [TimetableService],
})
export class TimetableModule {}
