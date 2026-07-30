import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '@core/auth/guards/jwt.guard';
import { RolesGuard } from '@core/roles/roles.guard';
import { Roles } from '@core/roles/roles.decorator';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';
import { TripService } from '../services/trip.service';
import {
  AssignTripResourcesDto,
  CancelTripDto,
  CreateTripDto,
  GenerateTripsDto,
  ListTripsQueryDto,
} from '../dto/trip.dto';
import { ReplaceTripResourceDto } from '../dto/trip-incident.dto';

const FLEET_ROLES = ['SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TRANSPORT_MANAGER'];

@Controller('transport/trips')
@UseGuards(JwtGuard, RolesGuard)
export class TripController {
  constructor(private readonly service: TripService) {}

  @Get()
  @Roles(...FLEET_ROLES)
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListTripsQueryDto) {
    return this.service.list(user, query);
  }

  @Get(':id')
  @Roles(...FLEET_ROLES)
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.getOne(user, id);
  }

  @Post()
  @Roles(...FLEET_ROLES)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTripDto) {
    return this.service.create(user, dto);
  }

  @Post('generate')
  @Roles(...FLEET_ROLES)
  generate(@CurrentUser() user: AuthenticatedUser, @Body() dto: GenerateTripsDto) {
    return this.service.generateForDate(user, dto.date);
  }

  @Patch(':id/assign')
  @Roles(...FLEET_ROLES)
  assignResources(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignTripResourcesDto,
  ) {
    return this.service.assignResources(user, id, dto);
  }

  // Ch.5 Daily Operations: Driver Replacement / Vehicle Breakdown — allowed while RUNNING.
  @Patch(':id/replace-resource')
  @Roles(...FLEET_ROLES)
  replaceResource(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReplaceTripResourceDto,
  ) {
    return this.service.replaceResource(user, id, dto);
  }

  @Post(':id/start')
  @Roles(...FLEET_ROLES)
  start(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.start(user, id);
  }

  @Post(':id/complete')
  @Roles(...FLEET_ROLES)
  complete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.complete(user, id);
  }

  @Post(':id/cancel')
  @Roles(...FLEET_ROLES)
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CancelTripDto,
  ) {
    return this.service.cancel(user, id, dto);
  }
}
