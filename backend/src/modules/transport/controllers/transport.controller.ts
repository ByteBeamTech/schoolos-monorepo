import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TransportService }  from '../services/transport.service';
import { CreateRouteDto, AssignStudentDto } from '../dto/transport.dto';
import { JwtGuard }          from '../../../core/auth/guards/jwt.guard';
import { RolesGuard }        from '../../../core/roles/roles.guard';
import { Roles }             from '../../../core/roles/roles.decorator';
import { CurrentUser }       from '../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../core/auth/guards/jwt.strategy';

@ApiTags('transport')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('transport')
export class TransportController {
  constructor(private readonly svc: TransportService) {}

  @Get('stats')   stats(@CurrentUser() u: AuthenticatedUser) { return this.svc.stats(u.tenantId); }
  @Get('routes')  list(@CurrentUser()  u: AuthenticatedUser) { return this.svc.listRoutes(u.tenantId); }

  @Get('routes/:id')
  getRoute(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.getRoute(u.tenantId, id);
  }

  @Post('routes')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  createRoute(@Body() dto: CreateRouteDto, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.createRoute(u.tenantId, dto);
  }

  @Post('assign')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  assign(@Body() dto: AssignStudentDto, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.assignStudent(u.tenantId, dto);
  }

  @Delete('unassign/:studentId')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  unassign(@Param('studentId') sid: string, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.unassignStudent(u.tenantId, sid);
  }
}
