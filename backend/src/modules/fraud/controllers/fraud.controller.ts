import { Controller, Get, Patch, Body, Param, Query, UseGuards }  from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtSuperadminGuard } from '../../../core/auth/guards/jwt-superadmin.guard';
import { SuperadminRoute }    from '../../../core/auth/decorators/superadmin-route.decorator';
import { RolesGuard } from '../../../core/roles/roles.guard';
import { Roles }      from '../../../core/roles/roles.decorator';
import { FraudService } from '../services/fraud.service';

// SA-1A-pattern fix (found post-UI-0.5, via systematic audit of every
// SUPER_ADMIN-role reference in the backend -- see support.controller.ts
// and tenant-admin.controller.ts for the same fix applied earlier the
// same day). Entire controller is superadmin-scoped (@Roles('SUPER_ADMIN')
// already at class level) but was using plain JwtGuard with no
// @SuperadminRoute() marker.
@ApiTags('fraud')
@ApiBearerAuth('access-token')
@SuperadminRoute()
@UseGuards(JwtSuperadminGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller('fraud')
export class FraudController {
  constructor(private readonly svc: FraudService) {}

  @Get('alerts')
  @ApiOperation({ summary: 'List fraud alerts' })
  list(
    @Query('status')   status?:   string,
    @Query('severity') severity?: string,
    @Query('tenantId') tenantId?: string,
    @Query('limit')    _limit?:   string,
  ) {
    return this.svc.list({ status, severity, tenantId });
  }

  @Get('alerts/stats')
  @ApiOperation({ summary: 'Alert stats' })
  stats() { return this.svc.stats(); }

  @Patch('alerts/:id')
  @ApiOperation({ summary: 'Update alert status' })
  update(@Param('id') id: string, @Body() body: { status: string; resolvedBy?: string }) {
    return this.svc.update(id, body);
  }
}
