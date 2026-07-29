import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '@core/auth/guards/jwt.guard';
import { RolesGuard } from '@core/roles/roles.guard';
import { Roles } from '@core/roles/roles.decorator';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';
import { TripScheduleService } from '../services/trip-schedule.service';
import { CreateTripScheduleDto, UpdateTripScheduleDto } from '../dto/trip-schedule.dto';

const FLEET_ROLES = ['SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TRANSPORT_MANAGER'];

@Controller('transport/trip-schedules')
@UseGuards(JwtGuard, RolesGuard)
export class TripScheduleController {
  constructor(private readonly service: TripScheduleService) {}

  @Get()
  @Roles(...FLEET_ROLES)
  list(@CurrentUser() user: AuthenticatedUser, @Query('routeId') routeId?: string) {
    return this.service.list(user, routeId);
  }

  @Get(':id')
  @Roles(...FLEET_ROLES)
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.getOne(user, id);
  }

  @Post()
  @Roles(...FLEET_ROLES)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTripScheduleDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @Roles(...FLEET_ROLES)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTripScheduleDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @Patch(':id/deactivate')
  @Roles(...FLEET_ROLES)
  deactivate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.deactivate(user, id);
  }
}
