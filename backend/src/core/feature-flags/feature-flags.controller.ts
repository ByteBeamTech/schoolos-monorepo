// path: apps/schoolos/backend/src/core/feature-flags/feature-flags.controller.ts
//
// SA-1: class-level `@UseGuards(JwtGuard)` removed. That single guard
// was wrong for roughly half this controller's routes -- the superadmin-
// actioned ones (override requests, direct override, admin views) need
// JwtSuperadminGuard + @SuperadminRoute() (so the global JwtGuard defers
// to it instead of rejecting a superadmin-signed token first), while the
// tenant-facing ones (GET /, GET /modules, tenant self-service) correctly
// keep JwtGuard. Guards are now applied per-method/per-group instead of
// once at the class level -- see the SA-1 Phase-1 audit report for the
// full platform-wide finding this fixes (feature-flags, saas-billing,
// saas-payment controllers were all affected the same way).

import {
  Controller, Get, Post, Patch, Delete, Param, Body,
  Query, UseGuards, Req,
}  from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request }              from 'express';
import { JwtGuard }             from '../auth/guards/jwt.guard';
import { JwtSuperadminGuard }   from '../auth/guards/jwt-superadmin.guard';
import { SuperadminRoute }      from '../auth/decorators/superadmin-route.decorator';
import { RolesGuard }           from '../roles/roles.guard';
import { Roles }                from '../roles/roles.decorator';
import { CurrentUser }          from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser }    from '../auth/guards/jwt.strategy';
import { FeatureFlagService }   from './feature-flags.service';

@ApiTags('feature-flags')
@ApiBearerAuth('access-token')
@Controller('flags')
export class FeatureFlagsController {
  constructor(private readonly svc: FeatureFlagService) {}

  // ── Evaluation endpoints (tenant-facing, any authenticated user) ──────────

  @Get()
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Get resolved flag map for current user context' })
  async getMyFlags(@CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    const planTier = (req as any).tenantPlanTier ?? undefined;
    return this.svc.getAllForContext({
      tenantId:  user.tenantId,
      userId:    user.id,
      role:      user.role,
      planTier,
    });
  }

  @Get('modules')
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Get only MODULE flags for current tenant' })
  async getModuleFlags(@CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    const planTier = (req as any).tenantPlanTier ?? undefined;
    const all = await this.svc.getAllForContext({
      tenantId: user.tenantId,
      userId:   user.id,
      role:     user.role,
      planTier,
    });
    return Object.fromEntries(
      Object.entries(all).filter(([k]) => k.startsWith('MODULE_'))
    );
  }

  // ── Tenant self-service (tenant-facing, JwtGuard unchanged) ───────────────

  @Get('tenant/controllable')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN', 'SCHOOL_OWNER')
  @ApiOperation({ summary: 'Get flags this tenant can toggle themselves' })
  async getTenantControllable(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const planTier = (req as any).tenantPlanTier ?? 'STARTER';
    return this.svc.getTenantFlags(user.tenantId, planTier);
  }

  @Patch('tenant/toggle')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN', 'SCHOOL_OWNER')
  @ApiOperation({ summary: 'Tenant admin toggles a tenant-controllable flag' })
  async tenantToggle(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { flagName: string; isEnabled: boolean },
  ) {
    await this.svc.setOverride({
      flagName:               body.flagName,
      targetType:            'TENANT',
      targetId:              user.tenantId,
      isEnabled:              body.isEnabled,
      actorId:                user.id,
      tenantId:               user.tenantId,
      tenantControllableOnly: true,
    });
    return { ok: true };
  }

  // ── Superadmin: direct override ───────────────────────────────────────────

  @Post('override')
  @SuperadminRoute()
  @UseGuards(JwtSuperadminGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Superadmin: set a flag override directly' })
  async setOverride(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: {
      flagName:   string;
      targetType: string;
      targetId:   string;
      isEnabled:  boolean;
      expiresAt?: string;
      reason?:    string;
    },
  ) {
    await this.svc.setOverride({
      ...body,
      actorId:  user.id,
      tenantId: user.tenantId,
    });
    return { ok: true };
  }

  @Delete('override')
  @SuperadminRoute()
  @UseGuards(JwtSuperadminGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Superadmin: remove a flag override' })
  async deleteOverride(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { flagName: string; targetType: string; targetId: string },
  ) {
    await this.svc.deleteOverride({ ...body, actorId: user.id, tenantId: user.tenantId });
    return { ok: true };
  }

  // ── Override request workflow (superadmin platform roles) ──────────────────

  @Post('requests')
  @SuperadminRoute()
  @UseGuards(JwtSuperadminGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'SAAS_OWNER', 'ACCOUNT_MANAGER')
  @ApiOperation({ summary: 'Submit a flag override request' })
  async createRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any,
  ) {
    return this.svc.createOverrideRequest({
      ...body,
      requestedBy:         user.id,
      requestedByTenantId: user.tenantId,
    });
  }

  @Get('requests')
  @SuperadminRoute()
  @UseGuards(JwtSuperadminGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'SAAS_OWNER', 'ACCOUNT_MANAGER')
  @ApiOperation({ summary: 'List override requests' })
  async listRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status')      status?:      string,
    @Query('flagName')    flagName?:    string,
    @Query('targetId')    targetId?:    string,
    @Query('myRequests')  myRequests?:  string,
    @Query('page')        page?:        string,
    @Query('limit')       limit?:       string,
  ) {
    return this.svc.getAllRequests({
      status,
      flagName,
      targetId,
      requestedBy: myRequests === 'true' ? user.id : undefined,
      page:  page  ? parseInt(page)  : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  @Get('requests/pending')
  @SuperadminRoute()
  @UseGuards(JwtSuperadminGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'SAAS_OWNER', 'ACCOUNT_MANAGER')
  async getPendingCount() {
    const requests = await this.svc.getPendingRequests();
    return { count: requests.length, requests };
  }

  @Patch('requests/:id/approve')
  @SuperadminRoute()
  @UseGuards(JwtSuperadminGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'SAAS_OWNER', 'ACCOUNT_MANAGER')
  async approveRequest(
    @Param('id')          requestId: string,
    @CurrentUser()        user:      AuthenticatedUser,
    @Body() body: { approverNote?: string },
  ) {
    return this.svc.approveRequest({
      requestId,
      approvedBy:   user.id,
      approverRole: user.role,
      approverNote: body.approverNote,
      tenantId:     user.tenantId,
    });
  }

  @Patch('requests/:id/reject')
  @SuperadminRoute()
  @UseGuards(JwtSuperadminGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'SAAS_OWNER', 'ACCOUNT_MANAGER')
  async rejectRequest(
    @Param('id')   requestId: string,
    @CurrentUser() user:      AuthenticatedUser,
    @Body() body: { rejectionReason: string },
  ) {
    return this.svc.rejectRequest({
      requestId,
      rejectedBy:      user.id,
      rejectionReason: body.rejectionReason,
      tenantId:        user.tenantId,
    });
  }

  @Patch('requests/:id/cancel')
  @SuperadminRoute()
  @UseGuards(JwtSuperadminGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'SAAS_OWNER', 'ACCOUNT_MANAGER')
  async cancelRequest(
    @Param('id')   requestId: string,
    @CurrentUser() user:      AuthenticatedUser,
  ) {
    return this.svc.cancelRequest({
      requestId,
      cancelledBy: user.id,
      tenantId:    user.tenantId,
    });
  }

  @Patch('requests/:id/revoke')
  @SuperadminRoute()
  @UseGuards(JwtSuperadminGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'SAAS_OWNER')
  async revokeOverride(
    @Param('id')   requestId: string,
    @CurrentUser() user:      AuthenticatedUser,
    @Body() body: { revokeReason: string },
  ) {
    return this.svc.revokeOverride({
      requestId,
      revokedBy:    user.id,
      revokeReason: body.revokeReason,
      tenantId:     user.tenantId,
    });
  }

  // ── Admin: view all ───────────────────────────────────────────────────────

  @Get('admin/all')
  @SuperadminRoute()
  @UseGuards(JwtSuperadminGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'SAAS_OWNER')
  async getAllFlags() {
    return this.svc.getAllFlags();
  }

  @Get('admin/tenant/:tenantId')
  @SuperadminRoute()
  @UseGuards(JwtSuperadminGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'SAAS_OWNER', 'ACCOUNT_MANAGER')
  async getTenantResolved(
    @Param('tenantId') tenantId: string,
    @Query('planTier') planTier?: string,
  ) {
    return this.svc.getAllForContext({ tenantId, planTier });
  }
}
