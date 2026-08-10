// backend/src/modules/student-billing/billing-run/controllers/billing-run.controller.ts
//
// Phase 4 (frozen). No feePlanId anywhere in this surface -- trigger is
// branch+period only.

import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { BillingRunService } from '../services/billing-run.service';
import { AttemptStatus } from '@prisma/client';
import { TriggerBillingRunDto } from '../../dto/billing.dto';
import { JwtGuard }          from '../../../../core/auth/guards/jwt.guard';
import { RolesGuard }        from '../../../../core/roles/roles.guard';
import { Roles }             from '../../../../core/roles/roles.decorator';
import { CurrentUser }       from '../../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../../core/auth/guards/jwt.strategy';

@ApiTags('billing-runs')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('billing/runs')
export class BillingRunController {
  constructor(private readonly service: BillingRunService) {}

  @Post()
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Trigger a billing run for this branch + period (no feePlanId -- resolved per student at execution time)' })
  trigger(@Body() dto: TriggerBillingRunDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.trigger(user.tenantId, user.branchId, dto.periodMonth, dto.periodYear, 'MANUAL', user.id);
  }

  @Post(':id/execute')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Execute a triggered billing run -- per-attempt atomic, continue-on-failure across the run' })
  execute(@Param('id') id: string) {
    return this.service.execute(id);
  }

  @Post(':id/retry-failed')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Re-run only the FAILED attempts of a billing run' })
  retryFailed(@Param('id') id: string) {
    return this.service.retryFailed(id);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Get a billing run, including attempt counts by status' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findById(user.tenantId, id);
  }

  @Get(':id/attempts')
  @Roles('SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'List attempts for a billing run' })
  @ApiQuery({ name: 'status', required: false, enum: AttemptStatus })
  findAttempts(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Query('status') status?: string) {
    const validStatus = status && Object.values(AttemptStatus).includes(status as AttemptStatus)
      ? (status as AttemptStatus)
      : undefined;
    return this.service.findAttempts(user.tenantId, id, validStatus);
  }
}
