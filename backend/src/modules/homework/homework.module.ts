import { Module }           from '@nestjs/common';
import { HomeworkService }  from './services/homework.service';
import { HomeworkController } from './controllers/homework.controller';
import { PrismaModule }     from '../../infra/database/prisma.module';
import { RolesModule }      from '../../core/roles/roles.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports:     [PrismaModule, RolesModule, NotificationsModule],
  providers:   [HomeworkService],
  controllers: [HomeworkController],
  exports:     [HomeworkService],
})
export class HomeworkModule {}
