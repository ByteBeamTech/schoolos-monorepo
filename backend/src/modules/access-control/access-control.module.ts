import { Module }                 from '@nestjs/common';
import { AccessControlService }   from './services/access-control.service';
import { AccessControlController } from './controllers/access-control.controller';
import { PrismaModule }           from '../../infra/database/prisma.module';
import { RolesModule }            from '../../core/roles/roles.module';

@Module({
  imports:     [PrismaModule, RolesModule],
  providers:   [AccessControlService],
  controllers: [AccessControlController],
  exports:     [AccessControlService],
})
export class AccessControlModule {}
