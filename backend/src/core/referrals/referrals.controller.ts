import { Controller, Get, Post, Patch, Body, Param, UseGuards }  from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ReferralsService, CreateReferralDto } from './referrals.service';
import { JwtGuard }          from '../auth/guards/jwt.guard';
import { RolesGuard }        from '../roles/roles.guard';
import { Roles }             from '../roles/roles.decorator';
import { CurrentUser }       from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/guards/jwt.strategy';

@ApiTags('referrals')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('referrals')
export class ReferralsController {
  constructor(private readonly svc: ReferralsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Referral stats for current tenant (or all for SUPER_ADMIN)' })
  getStats(@CurrentUser() u: AuthenticatedUser) {
    return u.role === 'SUPER_ADMIN'
      ? this.svc.getStats()
      : this.svc.getStats(u.tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'List referrals (tenant-scoped or all for SUPER_ADMIN)' })
  list(@CurrentUser() u: AuthenticatedUser) {
    return u.role === 'SUPER_ADMIN'
      ? this.svc.listAll()
      : this.svc.listByTenant(u.tenantId);
  }

  @Post()
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Create referral (school refers another school)' })
  create(@Body() dto: CreateReferralDto, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.create({ ...dto, referrerTenantId: u.tenantId });
  }

  @Patch(':id/status')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'SUPER_ADMIN: update referral status (mark converted)' })
  updateStatus(@Param('id') id: string, @Body('status') status: 'PENDING' | 'CONVERTED' | 'REJECTED') {
    return this.svc.updateStatus(id, status);
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify referral code (for onboarding flow)' })
  verify(@Body('code') code: string) {
    return this.svc.verify(code);
  }
}
