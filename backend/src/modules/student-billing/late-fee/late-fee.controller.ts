// modules/student-billing/late-fee/late-fee.controller.ts
//
// P0: LateFeeService had no HTTP surface at all. waiveLateFee() is only
// useful if a finance-staff member can actually trigger it, so this adds the
// minimum needed for that -- one endpoint, matching the existing
// billing-controller conventions (JwtGuard + RolesGuard, same finance-staff
// role set used across invoice/discount/payment controllers).
//
// Late Fee FDD v2 / Implementation Roadmap Sprint 1 adds one more: the
// waiver history for a fee (GET :id/waivers), closing FDD Section 1.4's
// audit gap visibly, not just in the database.
//
// Still deliberately NOT added here: routes for calculateLateFee()/
// applyLateFees() (the cron-driven calculation path), a general late-fee
// list endpoint, or anything for LateFeeRule -- all Sprint 2/3 per the
// Implementation Roadmap, out of scope for this sprint.

import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { LateFeeService } from './late-fee.service';
import { JwtGuard } from '../../../core/auth/guards/jwt.guard';
import { RolesGuard } from '../../../core/roles/roles.guard';
import { Roles } from '../../../core/roles/roles.decorator';
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../core/auth/guards/jwt.strategy';

class WaiveLateFeeDto {
  @ApiProperty() @IsNumber() @IsPositive() amount!: number;
  @ApiProperty() @IsString() @IsNotEmpty() reason!: string;
}

@ApiTags('late-fees')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('billing/late-fees')
export class LateFeeController {
  constructor(private readonly service: LateFeeService) {}

  @Patch(':id/waive')
  @Roles('SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Waive some or all of the outstanding balance of a late fee' })
  waive(
    @Param('id') id: string,
    @Body() dto: WaiveLateFeeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.waiveLateFee(user.tenantId, id, dto.amount, user.id, dto.reason);
  }

  @Get(':id/waivers')
  @Roles('SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Waiver history for a late fee, newest first' })
  getWaivers(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getWaivers(user.tenantId, id);
  }
}
