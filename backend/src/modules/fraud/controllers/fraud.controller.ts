import { Controller, Get, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtGuard }   from '../../../core/auth/guards/jwt.guard';
import { RolesGuard } from '../../../core/roles/roles.guard';
import { Roles }      from '../../../core/roles/roles.decorator';
import { FraudService } from '../services/fraud.service';

@ApiTags('fraud')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
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
