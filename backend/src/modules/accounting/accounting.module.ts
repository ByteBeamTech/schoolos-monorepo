import { Module }             from '@nestjs/common';
import { AccountingService }  from './services/accounting.service';
import { AccountingController } from './controllers/accounting.controller';
import { PrismaModule }       from '../../infra/database/prisma.module';
import { ComplianceModule }   from '../../core/compliance/compliance.module';
import { RolesModule }        from '../../core/roles/roles.module';

@Module({
  imports:     [PrismaModule, ComplianceModule, RolesModule],
  providers:   [AccountingService],
  controllers: [AccountingController],
  exports:     [AccountingService],
})
export class AccountingModule {}
