// backend/src/modules/onboarding/onboarding.controller.ts
// FULL REPLACEMENT — swaps JwtGuard for JwtSuperadminGuard
// FIX: any tenant JWT could previously call POST /onboarding/tenant and create
// schools, or PATCH status to suspend any other school.

import {
  Controller, Get, Post, Patch, Body, Param,
  Query, UseGuards, HttpCode, HttpStatus,
}  from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtSuperadminGuard }   from '../../core/auth/guards/jwt-superadmin.guard'; // ← CHANGED
import { RolesGuard }           from '../../core/roles/roles.guard';
import { Roles }                from '../../core/roles/roles.decorator';
import { CurrentUser }          from '../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser }    from '../../core/auth/guards/jwt.strategy';
import { OnboardingService }    from './onboarding.service';
import { OnboardTenantDto }     from './onboarding.dto';
import { SuperadminRoute }
from '../../core/auth/decorators/superadmin-route.decorator';

@ApiTags('onboarding')
@ApiBearerAuth('access-token')
@SuperadminRoute()
@UseGuards(JwtSuperadminGuard, RolesGuard)   // ← WAS: JwtGuard — now superadmin-only
@Roles('SUPER_ADMIN')
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly svc: OnboardingService) {}

  @Get('plans')
  @ApiOperation({ summary: 'List active pricing plans for plan selection' })
  getPlans() { return this.svc.getPlans(); }

  @Get('stats')
  @ApiOperation({ summary: 'Tenant counts by status' })
  getStats() { return this.svc.getStats(); }

  @Get('check-slug/:slug')
  @ApiOperation({ summary: 'Check if a school slug is available' })
  checkSlug(@Param('slug') slug: string) { return this.svc.checkSlug(slug); }

  @Get('tenants')
  @ApiOperation({ summary: 'List all tenants with pagination' })
  @ApiQuery({ name: 'page',   required: false })
  @ApiQuery({ name: 'limit',  required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  listTenants(
    @Query('page')   page?:   string,
    @Query('limit')  limit?:  string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.svc.listTenants({
      page:   page   ? parseInt(page)   : 1,
      limit:  limit  ? parseInt(limit)  : 20,
      search, status,
    });
  }

  @Get('tenants/:id')
  @ApiOperation({ summary: 'Get tenant detail' })
  getTenant(@Param('id') id: string) { return this.svc.getTenant(id); }

  @Post('tenant')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Onboard a new school — creates tenant + admin + subscription + session' })
  onboard(@Body() dto: OnboardTenantDto, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.onboardTenant(dto, u.id);
  }

  @Patch('tenants/:id/status')
  @ApiOperation({ summary: 'Update tenant status (ACTIVE/SUSPENDED/CANCELLED)' })
  updateStatus(
    @Param('id')        id:     string,
    @Body('status')     status: string,
    @CurrentUser()      u:      AuthenticatedUser,
  ) {
    return this.svc.updateTenantStatus(id, status, u.id);
  }

  @Post('tenants/:id/reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset the school admin password' })
  resetPassword(
    @Param('id')        id:       string,
    @Body('password')   password: string,
    @CurrentUser()      u:        AuthenticatedUser,
  ) {
    return this.svc.resetAdminPassword(id, password, u.id);
  }
}
