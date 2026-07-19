// modules/superadmin/controllers/platform-users.controller.ts
import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SuperadminRoute } from '../../../core/auth/decorators/superadmin-route.decorator';
import { JwtSuperadminGuard } from '../../../core/auth/guards/jwt-superadmin.guard';
import { RolesGuard } from '../../../core/roles/roles.guard';
import { Roles } from '../../../core/roles/roles.decorator';
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator';
import { SuperadminUser } from '../../../core/auth/guards/jwt-superadmin.strategy';
import { PlatformUsersService } from '../services/platform-users.service';

// Administration > Users / Sessions / Login History. Restricted to
// SUPER_ADMIN only -- managing platform staff (including who else holds
// SUPER_ADMIN) is deliberately not delegated to SAAS_OWNER/ACCOUNT_MANAGER,
// unlike the Approvals workflow those two roles were originally added for.
@SuperadminRoute()
@ApiTags('administration')
@ApiBearerAuth('access-token')
@UseGuards(JwtSuperadminGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller('superadmin/platform-users')
export class PlatformUsersController {
  constructor(private readonly svc: PlatformUsersService) {}

  @Get()
  @ApiOperation({ summary: 'List platform staff users' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'role',   required: false })
  @ApiQuery({ name: 'status', required: false })
  list(
    @Query('search') search?: string,
    @Query('role')   role?:   string,
    @Query('status') status?: string,
  ) {
    return this.svc.list({ search, role, status });
  }

  @Post()
  @ApiOperation({ summary: 'Create a platform user (sets a temp password, shown once)' })
  create(
    @Body() body: { email: string; firstName: string; lastName: string; role: string },
    @CurrentUser() user: SuperadminUser,
  ) {
    return this.svc.create(body, user.id);
  }

  // ── Sessions ─────────────────────────────────────────────────────────────
  // NOTE: registered before the :id routes below -- NestJS matches routes
  // in declaration order, so 'sessions/all' must come before ':id' or a
  // request to GET /platform-users/sessions/all would be misrouted to
  // getOne() with id='sessions'.

  @Get('sessions/all')
  @ApiOperation({ summary: 'List all active platform-staff sessions' })
  @ApiQuery({ name: 'userId', required: false })
  listSessions(@Query('userId') userId?: string) {
    return this.svc.listSessions(userId);
  }

  @Patch('sessions/:sessionId/revoke')
  @ApiOperation({ summary: 'Revoke a single session' })
  revokeSession(@Param('sessionId') sessionId: string, @CurrentUser() user: SuperadminUser) {
    return this.svc.revokeSession(sessionId, user.id);
  }

  // ── Login history ────────────────────────────────────────────────────────
  // Same ordering note as Sessions above.

  @Get('login-history/all')
  @ApiOperation({ summary: 'Platform-staff login/logout/password-change history' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'search', required: false })
  loginHistory(@Query('userId') userId?: string, @Query('search') search?: string) {
    return this.svc.loginHistory({ userId, search });
  }

  // ── :id routes (must come after the static routes above) ────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get a platform user' })
  getOne(@Param('id') id: string) {
    return this.svc.getById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit a platform user' })
  update(
    @Param('id') id: string,
    @Body() body: { firstName?: string; lastName?: string; role?: string },
    @CurrentUser() user: SuperadminUser,
  ) {
    return this.svc.update(id, body, user.id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Enable or disable a platform user' })
  setStatus(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
    @CurrentUser() user: SuperadminUser,
  ) {
    return this.svc.setStatus(id, body.isActive, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a platform user' })
  remove(@Param('id') id: string, @CurrentUser() user: SuperadminUser) {
    return this.svc.softDelete(id, user.id);
  }

  @Post(':id/reset-password')
  @ApiOperation({ summary: "Admin-reset a user's password (returns a temp password once)" })
  resetPassword(@Param('id') id: string, @CurrentUser() user: SuperadminUser) {
    return this.svc.resetPassword(id, user.id);
  }

  @Patch(':id/force-password-change')
  @ApiOperation({ summary: "Force a user to change their password on next login" })
  forcePasswordChange(@Param('id') id: string, @CurrentUser() user: SuperadminUser) {
    return this.svc.forcePasswordChange(id, user.id);
  }

  @Post(':id/revoke-sessions')
  @ApiOperation({ summary: "Revoke all of a user's active sessions" })
  revokeAllSessions(@Param('id') id: string, @CurrentUser() user: SuperadminUser) {
    return this.svc.revokeAllSessions(id, user.id);
  }
}
