import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '@core/auth/guards/jwt.guard';
import { RolesGuard } from '@core/roles/roles.guard';
import { Roles } from '@core/roles/roles.decorator';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';
import { RouteService } from '../services/route.service';
import {
  CloneRouteDto,
  ConfirmSuspendRouteDto,
  CreateRouteDto,
  ListRoutesQueryDto,
  UpdateRouteDto,
} from '../dto/route.dto';

const FLEET_ROLES = ['SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TRANSPORT_MANAGER'];

@Controller('transport/routes')
@UseGuards(JwtGuard, RolesGuard)
export class RouteController {
  constructor(private readonly service: RouteService) {}

  // ---- Phase 3: Route Planning ----

  @Get()
  @Roles(...FLEET_ROLES)
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListRoutesQueryDto) {
    return this.service.list(user, query);
  }

  @Get(':id')
  @Roles(...FLEET_ROLES)
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.getOne(user, id);
  }

  @Post()
  @Roles(...FLEET_ROLES)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRouteDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @Roles(...FLEET_ROLES)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRouteDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(...FLEET_ROLES)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }

  @Get(':id/simulate')
  @Roles(...FLEET_ROLES)
  simulate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.simulate(user, id);
  }

  // ---- Phase 4: Route Lifecycle ----

  @Post(':id/activate')
  @Roles(...FLEET_ROLES)
  activate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.activate(user, id);
  }

  @Post(':id/archive')
  @Roles(...FLEET_ROLES)
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.archive(user, id);
  }

  @Post(':id/clone')
  @Roles(...FLEET_ROLES)
  clone(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CloneRouteDto,
  ) {
    return this.service.clone(user, id, dto);
  }

  // AF-007 wizard: Preview / Impact Analysis step for Route Suspend.
  @Get(':id/suspend/preview')
  @Roles(...FLEET_ROLES)
  previewSuspend(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.previewSuspend(user, id);
  }

  // AF-007 wizard: User Confirmation -> Execute -> Publish Domain Events -> Audit -> Completion Report.
  @Post(':id/suspend/confirm')
  @Roles(...FLEET_ROLES)
  confirmSuspend(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ConfirmSuspendRouteDto,
  ) {
    return this.service.confirmSuspend(user, id, dto);
  }
}
