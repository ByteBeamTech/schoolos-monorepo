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
import { VehicleService } from '../services/vehicle.service';
import { CreateVehicleDto, ListVehiclesQueryDto, UpdateVehicleDto } from '../dto/vehicle.dto';

// SAD Ch.10 actors with Fleet authority.
const FLEET_ROLES = ['SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TRANSPORT_MANAGER'];

@Controller('transport/vehicles')
@UseGuards(JwtGuard, RolesGuard)
export class VehicleController {
  constructor(private readonly service: VehicleService) {}

  @Get()
  @Roles(...FLEET_ROLES)
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListVehiclesQueryDto) {
    return this.service.list(user, query);
  }

  @Get(':id')
  @Roles(...FLEET_ROLES)
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.getOne(user, id);
  }

  @Post()
  @Roles(...FLEET_ROLES)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateVehicleDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @Roles(...FLEET_ROLES)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(...FLEET_ROLES)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
