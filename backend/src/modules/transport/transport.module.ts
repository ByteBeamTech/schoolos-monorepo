import { Module }            from '@nestjs/common';
import { TransportService }  from './services/transport.service';
import { TransportController } from './controllers/transport.controller';
import { TransportSettingsService } from './services/transport-settings.service';
import { TransportSettingsController } from './controllers/transport-settings.controller';
import { VehicleService } from './services/vehicle.service';
import { DriverService } from './services/driver.service';
import { ConductorService } from './services/conductor.service';
import { VehicleController } from './controllers/vehicle.controller';
import { DriverController } from './controllers/driver.controller';
import { ConductorController } from './controllers/conductor.controller';
import { PrismaModule }      from '../../infra/database/prisma.module';
import { ComplianceModule }  from '../../core/compliance/compliance.module';
import { RolesModule }       from '../../core/roles/roles.module';

@Module({
  imports:     [PrismaModule, ComplianceModule, RolesModule],
  providers:   [
    TransportService,
    TransportSettingsService,
    VehicleService,
    DriverService,
    ConductorService,
  ],
  controllers: [
    TransportController,
    TransportSettingsController,
    VehicleController,
    DriverController,
    ConductorController,
  ],
  exports:     [
    TransportService,
    TransportSettingsService,
    VehicleService,
    DriverService,
    ConductorService,
  ],
})
export class TransportModule {}
