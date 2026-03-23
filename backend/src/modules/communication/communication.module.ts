import { Module }                  from '@nestjs/common';
import { CommunicationService }    from './services/communication.service';
import { CommunicationController } from './controllers/communication.controller';
import { PrismaModule }            from '../../infra/database/prisma.module';
import { ComplianceModule }        from '../../core/compliance/compliance.module';
import { RolesModule }             from '../../core/roles/roles.module';

@Module({
  imports:     [PrismaModule, ComplianceModule, RolesModule],
  providers:   [CommunicationService],
  controllers: [CommunicationController],
  exports:     [CommunicationService],
})
export class CommunicationModule {}
