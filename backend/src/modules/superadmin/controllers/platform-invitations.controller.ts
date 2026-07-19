// modules/superadmin/controllers/platform-invitations.controller.ts
import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SuperadminRoute } from '../../../core/auth/decorators/superadmin-route.decorator';
import { JwtSuperadminGuard } from '../../../core/auth/guards/jwt-superadmin.guard';
import { RolesGuard } from '../../../core/roles/roles.guard';
import { Roles } from '../../../core/roles/roles.decorator';
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator';
import { SuperadminUser } from '../../../core/auth/guards/jwt-superadmin.strategy';
import { PlatformInvitationsService } from '../services/platform-invitations.service';

// Administration > Invitations (admin-facing side). The accept-invite
// side (token-based, unauthenticated) lives in a separate PUBLIC
// controller -- see invitation-accept.controller.ts -- since it can't
// sit behind @SuperadminRoute()/JwtSuperadminGuard by definition (the
// person accepting doesn't have a superadmin session yet).
@SuperadminRoute()
@ApiTags('administration')
@ApiBearerAuth('access-token')
@UseGuards(JwtSuperadminGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller('superadmin/invitations')
export class PlatformInvitationsController {
  constructor(private readonly svc: PlatformInvitationsService) {}

  @Get()
  @ApiOperation({ summary: 'List platform-staff invitations' })
  @ApiQuery({ name: 'status', required: false })
  list(@Query('status') status?: string) {
    return this.svc.list(status);
  }

  @Post()
  @ApiOperation({ summary: 'Invite a new platform staff member' })
  create(
    @Body() body: { email: string; role: string; department?: string },
    @CurrentUser() user: SuperadminUser,
  ) {
    return this.svc.create(body, user.id);
  }

  @Post(':id/resend')
  @ApiOperation({ summary: 'Resend an invitation (issues a fresh token/expiry)' })
  resend(@Param('id') id: string, @CurrentUser() user: SuperadminUser) {
    return this.svc.resend(id, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel a pending invitation' })
  cancel(@Param('id') id: string, @CurrentUser() user: SuperadminUser) {
    return this.svc.cancel(id, user.id);
  }
}
