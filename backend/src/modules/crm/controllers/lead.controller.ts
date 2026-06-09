import {
  Body,
  Controller,
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
import { LeadService } from '../services/lead.service';
import {
  AssignLeadDto,
  ChangeLeadStatusDto,
  CreateLeadDto,
  ListLeadsQueryDto,
  UpdateLeadDto,
} from '../dto/lead.dto';

@Controller('crm/leads')
@UseGuards(JwtGuard, RolesGuard)
export class LeadController {
  constructor(private readonly service: LeadService) {}

  // List — RECEPTIONIST sees own branch; SCHOOL_ADMIN tenant-wide; PRINCIPAL own branch.
  @Get()
  @Roles('RECEPTIONIST', 'SCHOOL_ADMIN', 'PRINCIPAL')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListLeadsQueryDto) {
    return this.service.list(user, query);
  }

  @Get(':id')
  @Roles('RECEPTIONIST', 'SCHOOL_ADMIN', 'PRINCIPAL')
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.getOne(user, id);
  }

  @Post()
  @Roles('RECEPTIONIST', 'SCHOOL_ADMIN')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLeadDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @Roles('RECEPTIONIST', 'SCHOOL_ADMIN')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @Patch(':id/assign')
  @Roles('RECEPTIONIST', 'SCHOOL_ADMIN', 'PRINCIPAL')
  assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignLeadDto,
  ) {
    return this.service.assign(user, id, dto);
  }

  @Patch(':id/status')
  @Roles('RECEPTIONIST', 'SCHOOL_ADMIN', 'PRINCIPAL')
  changeStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ChangeLeadStatusDto,
  ) {
    return this.service.changeStatus(user, id, dto);
  }
}
