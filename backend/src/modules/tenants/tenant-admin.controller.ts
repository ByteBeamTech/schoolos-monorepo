import { Controller, Get, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { TenantAdminService } from './services/tenant-admin.service';
import { JwtGuard }          from '../../core/auth/guards/jwt.guard';
import { RolesGuard }        from '../../core/roles/roles.guard';
import { Roles }             from '../../core/roles/roles.decorator';

@ApiTags('tenant-admin')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
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
