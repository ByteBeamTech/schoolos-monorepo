// core/feature-flags/feature-flags.controller.ts — FULL REPLACEMENT
import {
  Controller, Get, Post, Patch, Delete, Param, Body,
  Query, UseGuards, Req, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request }             from 'express';
import { JwtGuard }            from '../auth/guards/jwt.guard';
import { RolesGuard }          from '../roles/roles.guard';
import { Roles }               from '../roles/roles.decorator';
import { CurrentUser }         from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser }   from '../auth/guards/jwt.strategy';
import { FeatureFlagService }  from './feature-flags.service';

// Roles that can approve override requests
const APPROVER_ROLES = ['SUPER_ADMIN', 'SAAS_OWNER', 'ACCOUNT_MANAGER'];

@ApiTags('feature-flags')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard)
@Controller('flags')
export class FeatureFlagsController {
  constructor(private readonly svc: FeatureFlagService) {}

  // ── Evaluation endpoints (used by frontend to gate UI) ─────────────────────

  @Get()
  @ApiOperation({ summary: 'Get resolved flag map for current user context' })
  async getMyFlags(@CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    // Fetch tenant's plan tier for tier gate
    const planTier = (req as any).tenantPlanTier ?? undefined;
    return this.svc.getAllForContext({
      tenantId:  user.tenantId,
      userId:    user.id,
      role:      user.role,
      planTier,
    });
  }

  @Get('modules')
  @ApiOperation({ summary: 'Get only MODULE flags for current tenant — used by sidebar' })
  async getModuleFlags(@CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    const planTier = (req as any).tenantPlanTier ?? undefined;
    const all = await this.svc.getAllForContext({
      tenantId: user.tenantId,
      userId:   user.id,
      role:     user.role,
      planTier,
    });
    // Return only MODULE_ prefixed flags
    return Object.fromEntries(
      Object.entries(all).filter(([k]) => k.startsWith('MODULE_'))
    );
  }

  // ── Tenant self-service (tenant admin controls their own allowed flags) ─────

  @Get('tenant/controllable')
  @UseGuards(RolesGuard)
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
  @UseGuards(RolesGuard)
  @Roles('SCHOOL_ADMIN', 'SCHOOL_OWNER')
  @ApiOperation({ summary: 'Tenant admin toggles a tenant-controllable flag' })
  async tenantToggle(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { flagName: string; isEnabled: boolean },
  ) {
    // Verify the flag is tenant-controllable before allowing
    await this.svc.setOverride({
      flagName:              body.flagName,
      targetType:            'TENANT',
      targetId:              user.tenantId,
      isEnabled:             body.isEnabled,
      actorId:               user.id,
      tenantId:              user.tenantId,
      tenantControllableOnly: true, // service will throw if flag is not tenant-controllable
    });
    return { ok: true };
  }

  // ── Superadmin: direct override (no approval needed for superadmin role) ───

  @Post('override')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Superadmin: set a flag override directly (no approval)' })
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
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Superadmin: remove a flag override' })
  async deleteOverride(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { flagName: string; targetType: string; targetId: string },
  ) {
    await this.svc.deleteOverride({ ...body, actorId: user.id, tenantId: user.tenantId });
    return { ok: true };
  }

  // ── Override request workflow ───────────────────────────────────────────────

  @Post('requests')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'SAAS_OWNER', 'ACCOUNT_MANAGER')
  @ApiOperation({ summary: 'Submit a flag override request for approval' })
  async createRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: {
      flagName:                    string;
      targetType:                  string;
      targetId:                    string;
      targetName?:                 string;
      isEnabled:                   boolean;
      requestReason:               string;
      activationMode:              string;
      activatesAt?:                string;
      trialDays?:                  number;
      autoRevokeIfNotUpgradedDays?: number;
    },
  ) {
    return this.svc.createOverrideRequest({
      ...body,
      requestedBy:         user.id,
      requestedByTenantId: user.tenantId,
    });
  }

  @Get('requests')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'SAAS_OWNER', 'ACCOUNT_MANAGER')
  @ApiOperation({ summary: 'List override requests with filters' })
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
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'SAAS_OWNER', 'ACCOUNT_MANAGER')
  @ApiOperation({ summary: 'Get pending approval requests — used for badge count' })
  async getPendingCount(@CurrentUser() user: AuthenticatedUser) {
    const requests = await this.svc.getPendingRequests();
    return { count: requests.length, requests };
  }

  @Patch('requests/:id/approve')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'SAAS_OWNER', 'ACCOUNT_MANAGER')
  @ApiOperation({ summary: 'Approve an override request' })
  async approveRequest(
    @Param('id')          requestId: string,
    @CurrentUser()        user:      AuthenticatedUser,
    @Body() body: { approverNote?: string },
  ) {
    // Account managers cannot approve their own requests
    const request = await this.svc.getAllRequests({ page: 1, limit: 1 });
    // Full self-approval check happens in service
    return this.svc.approveRequest({
      requestId,
      approvedBy:   user.id,
      approverNote: body.approverNote,
      tenantId:     user.tenantId,
    });
  }

  @Patch('requests/:id/reject')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'SAAS_OWNER', 'ACCOUNT_MANAGER')
  @ApiOperation({ summary: 'Reject an override request' })
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
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'SAAS_OWNER', 'ACCOUNT_MANAGER')
  @ApiOperation({ summary: 'Cancel your own pending request' })
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
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'SAAS_OWNER')
  @ApiOperation({ summary: 'Revoke an approved override (immediately disables the feature)' })
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

  // ── Admin: view all flags + overrides ──────────────────────────────────────

  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'SAAS_OWNER')
  @ApiOperation({ summary: 'Get all flag definitions with their current overrides' })
  async getAllFlags() {
    return this.svc.getAllFlags();
  }

  @Get('admin/tenant/:tenantId')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'SAAS_OWNER', 'ACCOUNT_MANAGER')
  @ApiOperation({ summary: 'Get resolved flags for a specific tenant (superadmin view)' })
  async getTenantResolved(
    @Param('tenantId') tenantId: string,
    @Query('planTier') planTier?: string,
  ) {
    return this.svc.getAllForContext({ tenantId, planTier });
  }
}

