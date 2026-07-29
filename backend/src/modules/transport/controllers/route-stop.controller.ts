import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '@core/auth/guards/jwt.guard';
import { RolesGuard } from '@core/roles/roles.guard';
import { Roles } from '@core/roles/roles.decorator';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';
import { RouteStopService } from '../services/route-stop.service';
import { AddRouteStopDto, ReorderRouteStopsDto, UpdateRouteStopDto } from '../dto/route-stop.dto';

const FLEET_ROLES = ['SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TRANSPORT_MANAGER'];

@Controller('transport/routes/:routeId/stops')
@UseGuards(JwtGuard, RolesGuard)
export class RouteStopController {
  constructor(private readonly service: RouteStopService) {}

  @Get()
  @Roles(...FLEET_ROLES)
  list(@CurrentUser() user: AuthenticatedUser, @Param('routeId') routeId: string) {
    return this.service.list(user, routeId);
  }

  @Post()
  @Roles(...FLEET_ROLES)
  add(
    @CurrentUser() user: AuthenticatedUser,
    @Param('routeId') routeId: string,
    @Body() dto: AddRouteStopDto,
  ) {
    return this.service.add(user, routeId, dto);
  }

  @Patch('reorder')
  @Roles(...FLEET_ROLES)
  reorder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('routeId') routeId: string,
    @Body() dto: ReorderRouteStopsDto,
  ) {
    return this.service.reorder(user, routeId, dto);
  }

  @Patch(':routeStopId')
  @Roles(...FLEET_ROLES)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('routeId') routeId: string,
    @Param('routeStopId') routeStopId: string,
    @Body() dto: UpdateRouteStopDto,
  ) {
    return this.service.update(user, routeId, routeStopId, dto);
  }

  @Delete(':routeStopId')
  @Roles(...FLEET_ROLES)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('routeId') routeId: string,
    @Param('routeStopId') routeStopId: string,
  ) {
    return this.service.remove(user, routeId, routeStopId);
  }
}
