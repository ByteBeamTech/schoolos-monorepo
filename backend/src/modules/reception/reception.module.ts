import { Module }            from '@nestjs/common';
import { ReceptionService }  from './services/reception.service';
import { ReceptionController } from './controllers/reception.controller';
import { PrismaModule }      from '../../infra/database/prisma.module';
import { ComplianceModule }  from '../../core/compliance/compliance.module';
import { RolesModule }       from '../../core/roles/roles.module';

@Module({
  imports:     [PrismaModule, ComplianceModule, RolesModule],
  providers:   [ReceptionService],
  controllers: [ReceptionController],
  exports:     [ReceptionService],
})
export class ReceptionModule {}
