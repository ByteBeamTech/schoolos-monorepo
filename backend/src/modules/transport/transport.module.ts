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
import { TripScheduleService } from './services/trip-schedule.service';
import { TripService } from './services/trip.service';
import { TripGenerationWorker } from './services/trip-generation.worker';
import { StudentTransportAssignmentService } from './services/student-transport-assignment.service';
import { TransportPricingService } from './services/transport-pricing.service';
import { VehicleController } from './controllers/vehicle.controller';
import { DriverController } from './controllers/driver.controller';
import { ConductorController } from './controllers/conductor.controller';
import { StopController } from './controllers/stop.controller';
import { RouteController } from './controllers/route.controller';
import { RouteStopController } from './controllers/route-stop.controller';
import { TransportStopPricingController } from './controllers/transport-stop-pricing.controller';
import { TripScheduleController } from './controllers/trip-schedule.controller';
import { TripController } from './controllers/trip.controller';
import { StudentTransportAssignmentController } from './controllers/student-transport-assignment.controller';
import { TransportPricingController } from './controllers/transport-pricing.controller';
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
    TripScheduleService,
    TripService,
    TripGenerationWorker,
    StudentTransportAssignmentService,
    TransportPricingService,
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
    TripScheduleController,
    TripController,
    StudentTransportAssignmentController,
    TransportPricingController,
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
    TripScheduleService,
    TripService,
    StudentTransportAssignmentService,
    TransportPricingService,
  ],
})
export class TransportModule {}
