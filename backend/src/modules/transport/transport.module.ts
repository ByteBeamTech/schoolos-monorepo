import { Module }            from '@nestjs/common';
import { TransportService }  from './services/transport.service';
import { TransportController } from './controllers/transport.controller';
import { TransportSettingsService } from './services/transport-settings.service';
import { TransportSettingsController } from './controllers/transport-settings.controller';
import { PrismaModule }      from '../../infra/database/prisma.module';
import { ComplianceModule }  from '../../core/compliance/compliance.module';
import { RolesModule }       from '../../core/roles/roles.module';

@Module({
  imports:     [PrismaModule, ComplianceModule, RolesModule],
  providers:   [TransportService, TransportSettingsService],
  controllers: [TransportController, TransportSettingsController],
  exports:     [TransportService, TransportSettingsService],
})
export class TransportModule {}
