// modules/superadmin/superadmin.controller.ts
// Phase 1: switched from JwtGuard → JwtSuperadminGuard
// This enforces aud === 'schoolos-superadmin' on all superadmin endpoints.
// Tenant-issued tokens are now rejected at the guard level.

import {
  Controller, Get, Post, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
}  from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SuperadminService }    from './superadmin.service';
import { JwtSuperadminGuard }   from '../../core/auth/guards/jwt-superadmin.guard';
import { RolesGuard }           from '../../core/roles/roles.guard';
import { Roles }                from '../../core/roles/roles.decorator';
import { CurrentUser }          from '../../core/auth/decorators/current-user.decorator';
import { SuperadminUser }       from '../../core/auth/guards/jwt-superadmin.strategy';

@ApiTags('superadmin')
@ApiBearerAuth('access-token')
@UseGuards(JwtSuperadminGuard, RolesGuard)   // ← JwtSuperadminGuard replaces JwtGuard
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
@Get('tenants/:tenantId/billing')
  @ApiOperation({ summary: 'Billing history for a single tenant — invoices + payments' })
  tenantBilling(@Param('tenantId') tenantId: string) {
    return this.svc.getTenantBillingHistory(tenantId);
  }
 
  @Get('audit')
  @ApiOperation({ summary: 'Platform-wide audit log with filters' })
  auditLog(
    @Query('tenantId')   tenantId?:   string,
    @Query('action')     action?:     string,
    @Query('actorId')    actorId?:    string,
    @Query('entityType') entityType?: string,
    @Query('from')       from?:       string,
    @Query('to')         to?:         string,
    @Query('page')       page?:       string,
    @Query('limit')      limit?:      string,
  ) {
    return this.svc.getPlatformAuditLog({
      tenantId, action, actorId, entityType, from, to,
      page:  page  ? parseInt(page)  : 1,
      limit: limit ? parseInt(limit) : 50,
    });
  }

}
