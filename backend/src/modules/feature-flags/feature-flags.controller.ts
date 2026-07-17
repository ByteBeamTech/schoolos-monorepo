import { Controller, Get, UseGuards }  from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtSuperadminGuard } from '../../core/auth/guards/jwt-superadmin.guard';
import { SuperadminRoute }    from '../../core/auth/decorators/superadmin-route.decorator';
import { RolesGuard } from '../../core/roles/roles.guard';
import { Roles }      from '../../core/roles/roles.decorator';
import { ALL_FLAGS }  from '../../core/feature-flags/flag-definitions';

// SA-1A: auth-guard fix only (was JwtGuard, silently rejecting every
// superadmin-signed token before RolesGuard's SUPER_ADMIN check could
// ever run -- identical root cause to the fixes in core/feature-flags/
// feature-flags.controller.ts, saas-billing.controller.ts, and
// saas-payment.controller.ts). This controller is a separate,
// apparently-duplicate implementation from core/feature-flags/
// feature-flags.controller.ts (different route prefix: /feature-flags
// vs /flags; also double-registers FeatureFlagService as a provider in
// its own @Global() module) -- flagged for a future SA-2 cleanup, NOT
// touched here. SA-1A's scope is authentication consistency only.
@ApiTags('feature-flags')
@ApiBearerAuth('access-token')
@Controller('feature-flags')
export class FeatureFlagsController {
  @Get('definitions')
  @SuperadminRoute()
  @UseGuards(JwtSuperadminGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get all flag definitions' })
  getDefinitions() { return ALL_FLAGS; }
}
