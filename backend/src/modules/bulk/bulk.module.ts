import { Module }        from '@nestjs/common';
import { BullModule }    from '@nestjs/bull';
import { BulkService }   from './services/bulk.service';
import { BulkController } from './controllers/bulk.controller';
import { PrismaModule }  from '../../infra/database/prisma.module';
import { RolesModule }   from '../../core/roles/roles.module';
import { QUEUE_NAMES }   from '../../infra/queue/queue.module';
import { StudentBillingModule } from '../student-billing/student-billing.module';

@Module({
  imports: [
    PrismaModule,
    RolesModule,
    StudentBillingModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.BULK_OPERATIONS }),
  ],
  providers:   [BulkService],
  controllers: [BulkController],
  exports:     [BulkService],
})
export class BulkModule {}
