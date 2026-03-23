import { Module }          from '@nestjs/common';
import { PayrollService }  from './services/payroll.service';
import { PayrollController } from './controllers/payroll.controller';
import { PrismaModule }    from '../../infra/database/prisma.module';
import { ComplianceModule } from '../../core/compliance/compliance.module';
import { RolesModule }     from '../../core/roles/roles.module';

@Module({
  imports:     [PrismaModule, ComplianceModule, RolesModule],
  providers:   [PayrollService],
  controllers: [PayrollController],
  exports:     [PayrollService],
})
export class PayrollModule {}
