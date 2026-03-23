import { Module }           from '@nestjs/common';
import { FraudService }     from './services/fraud.service';
import { FraudController }  from './controllers/fraud.controller';
import { PrismaModule }     from '../../infra/database/prisma.module';
import { RolesModule }      from '../../core/roles/roles.module';

@Module({
  imports:     [PrismaModule, RolesModule],
  providers:   [FraudService],
  controllers: [FraudController],
  exports:     [FraudService],
})
export class FraudModule {}
