import { Module }                 from '@nestjs/common';
import { ExaminationsService }    from './services/examinations.service';
import { ExaminationsController } from './controllers/examinations.controller';

@Module({
  providers:   [ExaminationsService],
  controllers: [ExaminationsController],
  exports:     [ExaminationsService],
})
export class ExaminationsModule {}
