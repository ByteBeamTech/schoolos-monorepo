import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PrismaService }    from '../../infra/database/prisma.service';
import { JwtGuard }         from '../../core/auth/guards/jwt.guard';
import { RolesGuard }       from '../../core/roles/roles.guard';
import { Roles }            from '../../core/roles/roles.decorator';
import { CurrentUser }      from '../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser }from '../../core/auth/guards/jwt.strategy';
import { IsString, IsBoolean, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SetFeatureFlagDto {
  @ApiProperty()           @IsString()  flag!:      string;
  @ApiProperty()           @IsBoolean() isEnabled!: boolean;
  @ApiPropertyOptional()   @IsObject()  @IsOptional() config?: Record<string, any>;
}

@ApiTags('feature-flags')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private readonly prisma: PrismaService) {}

  // Superadmin: get all flags for a tenant
  @Get('tenant/:tenantId')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get all feature flags for a tenant' })
  async getTenantFlags(@Param('tenantId') tenantId: string) {
    return this.prisma.featureFlag.findMany({
      where:   { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  // Superadmin: set a flag for a specific tenant
  @Post('tenant/:tenantId')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Set feature flag for a tenant' })
  async setFlag(
    @Param('tenantId') tenantId: string,
    @Body() dto: SetFeatureFlagDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.prisma.featureFlag.upsert({
      where:  { tenantId_name: { tenantId, name: dto.flag } },
      create: {
        tenantId, name: dto.flag, isEnabled: dto.isEnabled,
        config:    dto.config ?? {},
        enabledAt: dto.isEnabled ? new Date() : null,
        enabledBy: dto.isEnabled ? user.id : null,
      },
      update: {
        isEnabled: dto.isEnabled,
        config:    dto.config ?? {},
        enabledAt: dto.isEnabled ? new Date() : null,
        enabledBy: dto.isEnabled ? user.id : null,
      },
    });
  }

  // Superadmin: bulk enable flag for ALL tenants
  @Post('global/:flag/enable')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Enable a feature flag for ALL active tenants' })
  async enableGlobal(
    @Param('flag') flag: string,
    @Body() body: { config?: Record<string, any> },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const tenants = await this.prisma.tenant.findMany({ where: { status: 'ACTIVE' } });
    let count = 0;
    for (const t of tenants) {
      await this.prisma.featureFlag.upsert({
        where:  { tenantId_name: { tenantId: t.id, name: flag } },
        create: { tenantId: t.id, name: flag, isEnabled: true, config: body.config ?? {}, enabledAt: new Date(), enabledBy: user.id },
        update: { isEnabled: true, config: body.config ?? {}, enabledAt: new Date(), enabledBy: user.id },
      });
      count++;
    }
    return { enabled: count, flag };
  }

  // Superadmin: disable flag for ALL tenants (kill switch)
  @Delete('global/:flag')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Kill switch — disable flag for ALL tenants' })
  async killSwitch(@Param('flag') flag: string) {
    const result = await this.prisma.featureFlag.updateMany({
      where: { name: flag },
      data:  { isEnabled: false },
    });
    return { disabled: result.count, flag };
  }

  // School: check own flags
  @Get()
  @ApiOperation({ summary: 'Get feature flags for current tenant' })
  async getMyFlags(@CurrentUser() user: AuthenticatedUser) {
    const flags = await this.prisma.featureFlag.findMany({
      where: { tenantId: user.tenantId },
    });
    // Return as key-value map
    return Object.fromEntries(flags.map((f: any) => [f.name, { isEnabled: f.isEnabled, config: f.config }]));
  }
}
