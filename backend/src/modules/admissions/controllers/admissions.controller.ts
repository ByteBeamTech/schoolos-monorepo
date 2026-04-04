import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards }  from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdmissionsService }   from '../services/admissions.service';
import { CreateAdmissionDto, UpdateAdmissionStatusDto } from '../dto/admissions.dto';
import { JwtGuard }            from '../../../core/auth/guards/jwt.guard';
import { RolesGuard }          from '../../../core/roles/roles.guard';
import { Roles }               from '../../../core/roles/roles.decorator';
import { CurrentUser }         from '../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser }   from '../../../core/auth/guards/jwt.strategy';

@ApiTags('admissions')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('admissions')
export class AdmissionsController {
  constructor(private readonly svc: AdmissionsService) {}

  @Get('stats')            stats(@CurrentUser() u: AuthenticatedUser) { return this.svc.stats(u.tenantId); }
  @Get('source-report')    sourceReport(@CurrentUser() u: AuthenticatedUser) { return this.svc.sourceReport(u.tenantId); }

  @Get()
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'source', required: false })
  @ApiQuery({ name: 'search', required: false })
  list(
    @CurrentUser() u: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('search') search?: string,
  ) { return this.svc.list(u.tenantId, { status, source, search }); }

  @Get(':id')
  getById(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.getById(u.tenantId, id);
  }

  @Post()
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'STAFF')
  create(@Body() dto: CreateAdmissionDto, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.create(u.tenantId, dto, u.id);
  }

  @Patch(':id/status')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'STAFF')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateAdmissionStatusDto, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.updateStatus(u.tenantId, id, dto, u.id);
  }

  @Post(':id/note')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'STAFF')
  addNote(@Param('id') id: string, @Body('note') note: string, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.addNote(u.tenantId, id, note, u.id);
  }
}
