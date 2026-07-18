// backend/src/modules/superadmin/superadmin.controller.ts
// FULL REPLACEMENT — adds impersonate + knowledge routes that were missing
import { SuperadminRoute } from '../../core/auth/decorators/superadmin-route.decorator';
import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus, BadRequestException,
}  from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SuperadminService }    from './superadmin.service';
import { PlatformConfigService } from '../../core/platform-config/platform-config.service';
import { DEFAULT_SLA_POLICY, PLATFORM_CONFIG_KEYS, SlaPolicyMap } from '../../core/sla-policy.constants';
import { JwtSuperadminGuard }   from '../../core/auth/guards/jwt-superadmin.guard';
import { RolesGuard }           from '../../core/roles/roles.guard';
import { Roles }                from '../../core/roles/roles.decorator';
import { CurrentUser }          from '../../core/auth/decorators/current-user.decorator';
import { SuperadminUser }       from '../../core/auth/guards/jwt-superadmin.strategy';

@SuperadminRoute()
@ApiTags('superadmin')
@ApiBearerAuth('access-token')
@UseGuards(JwtSuperadminGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller('superadmin')
export class SuperadminController {
  constructor(
    private readonly svc: SuperadminService,
    private readonly config: PlatformConfigService,
  ) {}

  // ── Analytics ─────────────────────────────────────────────────────────────
  //
  @Get('tenants')
@ApiOperation({ summary: 'List all tenant schools' })
getTenants(
  @Query('page') page = '1',
  @Query('limit') limit = '20',
) {
  return this.svc.getTenants(
    Number(page),
    Number(limit),
  );
}

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

  // ── Tenant billing history ────────────────────────────────────────────────

  @Get('tenants/:tenantId/billing')
  @ApiOperation({ summary: 'Billing history for a single tenant' })
  tenantBilling(@Param('tenantId') tenantId: string) {
    return this.svc.getTenantBillingHistory(tenantId);
  }

  // ── Audit log ─────────────────────────────────────────────────────────────

  @Get('audit')
  @ApiOperation({ summary: 'Platform-wide audit log with filters' })
  @ApiQuery({ name: 'tenantId',   required: false })
  @ApiQuery({ name: 'action',     required: false })
  @ApiQuery({ name: 'actorId',    required: false })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'from',       required: false })
  @ApiQuery({ name: 'to',         required: false })
  @ApiQuery({ name: 'page',       required: false })
  @ApiQuery({ name: 'limit',      required: false })
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

  // ── Shadow login (impersonation) ──────────────────────────────────────────
  // FIX: this method existed in SuperadminService but was never wired to a route

  @Post('impersonate/:tenantId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate a 30-min impersonation token for a tenant' })
  impersonate(
    @Param('tenantId') tenantId: string,
    @Body('reason')    reason:   string,
    @CurrentUser()     user:     SuperadminUser,
  ) {
    return this.svc.impersonate(user.id, tenantId, reason);
  }

  // ── Knowledge graph query ─────────────────────────────────────────────────
  // FIX: this method existed in SuperadminService but was never wired to a route

  @Get('knowledge')
  @ApiOperation({ summary: 'Cross-tenant knowledge graph query with filters' })
  @ApiQuery({ name: 'status',              required: false })
  @ApiQuery({ name: 'region',              required: false })
  @ApiQuery({ name: 'tier',                required: false })
  @ApiQuery({ name: 'hasOpenAlerts',       required: false })
  @ApiQuery({ name: 'hasOverdueInvoices',  required: false })
  @ApiQuery({ name: 'minStudents',         required: false })
  @ApiQuery({ name: 'maxStudents',         required: false })
  @ApiQuery({ name: 'trialExpiringDays',   required: false })
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
      status,
      region,
      tier,
      hasOpenAlerts:      hasOpenAlerts      === 'true' ? true : hasOpenAlerts      === 'false' ? false : undefined,
      hasOverdueInvoices: hasOverdueInvoices === 'true' ? true : hasOverdueInvoices === 'false' ? false : undefined,
      minStudents:        minStudents        ? parseInt(minStudents)        : undefined,
      maxStudents:        maxStudents        ? parseInt(maxStudents)        : undefined,
      trialExpiringDays:  trialExpiringDays  ? parseInt(trialExpiringDays)  : undefined,
    });
  }

  // ── SLA Settings ─────────────────────────────────────────────────────────
  // Backs the Settings page's new SLA section. SLA_POLICY previously lived
  // as a hardcoded const in support.service.ts -- now configurable via
  // PlatformConfig, falling back to the same factory defaults
  // (DEFAULT_SLA_POLICY) if nothing has been saved yet.

  @Get('config/sla-policy')
  @ApiOperation({ summary: 'Get current SLA response/resolution policy (or factory defaults if unset)' })
  async getSlaPolicy() {
    const saved = await this.config.get<SlaPolicyMap>(PLATFORM_CONFIG_KEYS.SLA_POLICY);
    return { policy: saved ?? DEFAULT_SLA_POLICY, isDefault: !saved };
  }

  @Patch('config/sla-policy')
  @ApiOperation({ summary: 'Update SLA response/resolution policy' })
  async updateSlaPolicy(
    @Body() body: SlaPolicyMap,
    @CurrentUser() user: SuperadminUser,
  ) {
    // Basic shape/sanity validation -- every priority present, both
    // fields positive integers. Not exhaustive DTO validation (no
    // class-validator decorators wired for this route yet), but enough
    // to stop obviously broken input (negative minutes, missing
    // priorities) from silently corrupting every future ticket's SLA
    // dates.
    for (const key of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const) {
      const entry = body?.[key];
      if (!entry || !Number.isFinite(entry.responseMin) || !Number.isFinite(entry.resolutionMin)
          || entry.responseMin <= 0 || entry.resolutionMin <= 0) {
        throw new BadRequestException(
          `Invalid SLA policy for ${key}: responseMin and resolutionMin must both be positive numbers.`,
        );
      }
    }
    await this.config.set(PLATFORM_CONFIG_KEYS.SLA_POLICY, body, user.id);
    return { ok: true, policy: body };
  }
}
