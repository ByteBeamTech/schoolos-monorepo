// modules/superadmin/controllers/invitation-accept.controller.ts
//
// PUBLIC side of Administration > Invitations. Deliberately NOT under
// @SuperadminRoute()/JwtSuperadminGuard -- the person accepting an
// invite doesn't have a superadmin session yet; the token itself is the
// credential. Kept as its own controller (not folded into
// PlatformInvitationsController) so the public/guarded boundary is a
// file-level split, not something that could be accidentally weakened
// by a future edit to a shared, mostly-guarded controller.

import { Controller, Get, Post, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../../core/auth/decorators/public.decorator';
import { PlatformInvitationsService } from '../services/platform-invitations.service';

@ApiTags('administration')
@Controller('auth/invitations')
export class InvitationAcceptController {
  constructor(private readonly svc: PlatformInvitationsService) {}

  @Get(':token')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Look up an invitation by token (for the accept-invite form)' })
  getByToken(@Param('token') token: string) {
    return this.svc.getByToken(token);
  }

  @Post(':token/accept')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Accept an invitation, creating the platform user account' })
  accept(
    @Param('token') token: string,
    @Body() body: { firstName: string; lastName: string; password: string },
  ) {
    return this.svc.accept(token, body);
  }
}
