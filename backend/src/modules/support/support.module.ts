import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { SupportService } from './services/support.service';
import { SupportCronService } from './support-cron.service';
import { SupportController } from './controllers/support.controller';
import { PrismaModule } from '../../infra/database/prisma.module';
import { RolesModule } from '../../core/roles/roles.module';
import { QUEUE_NAMES } from '../../infra/queue/queue.module';

@Module({
  imports: [
    PrismaModule,
    RolesModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.NOTIFICATIONS }),
  ],
  providers: [SupportService, SupportCronService],
  controllers: [SupportController],
  exports: [SupportService],
})
export class SupportModule {}