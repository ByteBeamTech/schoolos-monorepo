import { Module }            from '@nestjs/common';
import { TransportService }  from './services/transport.service';
import { TransportController } from './controllers/transport.controller';
import { TransportSettingsService } from './services/transport-settings.service';
import { TransportSettingsController } from './controllers/transport-settings.controller';
import { VehicleService } from './services/vehicle.service';
import { DriverService } from './services/driver.service';
import { ConductorService } from './services/conductor.service';
import { StopService } from './services/stop.service';
import { RouteService } from './services/route.service';
import { RouteStopService } from './services/route-stop.service';
import { TransportStopPricingService } from './services/transport-stop-pricing.service';
import { VehicleController } from './controllers/vehicle.controller';
import { DriverController } from './controllers/driver.controller';
import { ConductorController } from './controllers/conductor.controller';
import { StopController } from './controllers/stop.controller';
import { RouteController } from './controllers/route.controller';
import { RouteStopController } from './controllers/route-stop.controller';
import { TransportStopPricingController } from './controllers/transport-stop-pricing.controller';
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
    StopService,
    RouteService,
    RouteStopService,
    TransportStopPricingService,
  ],
  controllers: [
    TransportController,
    TransportSettingsController,
    VehicleController,
    DriverController,
    ConductorController,
    StopController,
    RouteController,
    RouteStopController,
    TransportStopPricingController,
  ],
  exports:     [
    TransportService,
    TransportSettingsService,
    VehicleService,
    DriverService,
    ConductorService,
    StopService,
    RouteService,
    RouteStopService,
    TransportStopPricingService,
  ],
})
export class TransportModule {}
