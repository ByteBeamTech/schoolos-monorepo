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
import { ConductorService } from '../services/conductor.service';
import { CreateConductorDto, ListConductorsQueryDto, UpdateConductorDto } from '../dto/conductor.dto';

const FLEET_ROLES = ['SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TRANSPORT_MANAGER'];

@Controller('transport/conductors')
@UseGuards(JwtGuard, RolesGuard)
export class ConductorController {
  constructor(private readonly service: ConductorService) {}

  @Get()
  @Roles(...FLEET_ROLES)
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListConductorsQueryDto) {
    return this.service.list(user, query);
  }

  @Get(':id')
  @Roles(...FLEET_ROLES)
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.getOne(user, id);
  }

  @Post()
  @Roles(...FLEET_ROLES)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateConductorDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @Roles(...FLEET_ROLES)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateConductorDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(...FLEET_ROLES)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
