import { Controller, Get, Patch, Param, Body, Query, UseGuards }  from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { TenantAdminService } from './services/tenant-admin.service';
import { JwtSuperadminGuard } from '../../core/auth/guards/jwt-superadmin.guard';
import { SuperadminRoute }    from '../../core/auth/decorators/superadmin-route.decorator';
import { RolesGuard }        from '../../core/roles/roles.guard';
import { Roles }             from '../../core/roles/roles.decorator';

// SA-1A-pattern fix (found post-UI-0.5, via real usage): this entire
// controller is superadmin-only (both routes already documented
// "Superadmin:" in their @ApiOperation summaries, both already
// @Roles('SUPER_ADMIN')) but was using plain JwtGuard with no
// @SuperadminRoute() marker -- so the global JwtGuard rejected every
// genuine superadmin token with "Invalid token signature" before
// RolesGuard's SUPER_ADMIN check could ever run. Identical root cause to
// the original SA-1A finding (core/feature-flags, saas-billing,
// saas-payment controllers). Since every route here is superadmin-scoped
// (unlike support.controller.ts, which mixes tenant-facing and
// superadmin-only routes in one class), the fix is applied at class
// level rather than per-method.
@SuperadminRoute()
@ApiTags('tenant-admin')
@ApiBearerAuth('access-token')
@UseGuards(JwtSuperadminGuard, RolesGuard)
@Controller('tenant-admin')
export class TenantAdminController {
  constructor(private readonly svc: TenantAdminService) {}

  @Get('schools')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Superadmin: list all schools with filters' })
  @ApiQuery({ name: 'region', required: false })
  @ApiQuery({ name: 'status', required: false })
  listSchools(@Query('region') region?: string, @Query('status') status?: string) {
    return this.svc.listSchools({ region, status });
  }

  @Patch(':id/toggle-feature')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Superadmin: toggle any tenant boolean field' })
  toggleFeature(@Param('id') id: string, @Body() body: { feature: string; value: boolean }) {
    return this.svc.toggleFeature(id, body.feature, body.value);
  }
}
