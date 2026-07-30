import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '@core/auth/guards/jwt.guard';
import { RolesGuard } from '@core/roles/roles.guard';
import { Roles } from '@core/roles/roles.decorator';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';
import { TripIncidentService } from '../services/trip-incident.service';
import { ReportIncidentDto, ResolveIncidentDto } from '../dto/trip-incident.dto';

const FLEET_ROLES = ['SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TRANSPORT_MANAGER'];

@Controller('transport/trips/:tripId/incidents')
@UseGuards(JwtGuard, RolesGuard)
export class TripIncidentController {
  constructor(private readonly service: TripIncidentService) {}

  @Get()
  @Roles(...FLEET_ROLES)
  list(@CurrentUser() user: AuthenticatedUser, @Param('tripId') tripId: string) {
    return this.service.list(user, tripId);
  }

  @Post()
  @Roles(...FLEET_ROLES)
  report(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId') tripId: string,
    @Body() dto: ReportIncidentDto,
  ) {
    return this.service.report(user, tripId, dto);
  }

  @Patch(':incidentId/resolve')
  @Roles(...FLEET_ROLES)
  resolve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId') tripId: string,
    @Param('incidentId') incidentId: string,
    @Body() dto: ResolveIncidentDto,
  ) {
    return this.service.resolve(user, tripId, incidentId, dto);
  }
}
