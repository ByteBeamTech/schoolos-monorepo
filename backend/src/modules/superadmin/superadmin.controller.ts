import {
  Controller, Get, Post, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SuperadminService } from './superadmin.service';
import { JwtGuard }          from '../../core/auth/guards/jwt.guard';
import { RolesGuard }        from '../../core/roles/roles.guard';
import { Roles }             from '../../core/roles/roles.decorator';
import { CurrentUser }       from '../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/auth/guards/jwt.strategy';

@ApiTags('superadmin')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller('superadmin')
export class SuperadminController {
  constructor(private readonly svc: SuperadminService) {}

  @Get('revenue')
  @ApiOperation({ summary: 'MRR, ARR, churn, invoice aging' })
  revenue() { return this.svc.getRevenueIntelligence(); }

  @Get('health')
  @ApiOperation({ summary: 'Per-tenant health scores' })
  health() { return this.svc.getTenantHealthScores(); }

  @Get('trials')
  @ApiOperation({ summary: 'Trial expiry funnel' })
  trials() { return this.svc.getTrialFunnel(); }

  @Get('cohorts')
  @ApiOperation({ summary: 'Cohort retention data' })
  cohorts() { return this.svc.getCohortData(); }

  @Get('monitoring')
  @ApiOperation({ summary: 'System monitoring snapshot' })
  monitoring() { return this.svc.getSystemMonitoring(); }

  @Post('impersonate/:tenantId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Shadow login — get short-lived JWT for tenant admin' })
  impersonate(
    @Param('tenantId')  tenantId: string,
    @Body('reason')     reason:   string,
    @CurrentUser()      user:     AuthenticatedUser,
  ) { return this.svc.impersonate(user.id, tenantId, reason); }

  @Get('knowledge')
  @ApiOperation({ summary: 'Cross-table knowledge query' })
  knowledge(
    @Query('status')             status?:             string,
    @Query('region')             region?:             string,
    @Query('tier')               tier?:               string,
    @Query('hasOpenAlerts')      hasOpenAlerts?:      string,
    @Query('hasOverdueInvoices') hasOverdueInvoices?: string,
    @Query('minStudents')        minStudents?:        string,
    @Query('maxStudents')        maxStudents?:        string,
    @Query('trialExpiringDays')  trialExpiringDays?:  string,
  ) {
    return this.svc.knowledgeQuery({
      status, region, tier,
      hasOpenAlerts:      hasOpenAlerts      ? hasOpenAlerts === 'true'      : undefined,
      hasOverdueInvoices: hasOverdueInvoices ? hasOverdueInvoices === 'true' : undefined,
      minStudents:        minStudents        ? parseInt(minStudents)         : undefined,
      maxStudents:        maxStudents        ? parseInt(maxStudents)         : undefined,
      trialExpiringDays:  trialExpiringDays  ? parseInt(trialExpiringDays)  : undefined,
    });
  }
}
