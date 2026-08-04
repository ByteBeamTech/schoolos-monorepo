// backend/src/modules/student-billing/late-fee/rules/rules.controller.ts
//
// Late Fee Module FDD v2 / Implementation Roadmap v2 Sprint 3.
// Roles matching the established Fee Heads/Discounts pattern: SCHOOL_ADMIN/
// PRINCIPAL for anything that changes a rule, the broader finance-staff
// set (including ACCOUNTANT) for read-only list -- confirmed against
// fee-head.controller.ts's own @Roles decorators before matching it here,
// not assumed.

import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RulesService } from './rules.service';
import { CreateLateFeeRuleDto, DeactivateLateFeeRuleDto } from '../../dto/billing.dto';
import { JwtGuard } from '../../../../core/auth/guards/jwt.guard';
import { RolesGuard } from '../../../../core/roles/roles.guard';
import { Roles } from '../../../../core/roles/roles.decorator';
import { CurrentUser } from '../../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../../core/auth/guards/jwt.strategy';

@ApiTags('late-fee-rules')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('billing/late-fees/rules')
export class RulesController {
  constructor(private readonly service: RulesService) {}

  @Post()
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Create a late fee rule (create-new-not-edit -- never mutates an existing rule)' })
  create(@Body() dto: CreateLateFeeRuleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(user.tenantId, dto, user.id);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'List late fee rules, filterable by scope' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
    @Query('feePlanId') feePlanId?: string,
  ) {
    return this.service.findAll(user.tenantId, branchId, feePlanId);
  }

  @Patch(':id')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Deactivate/supersede a late fee rule (never edits its calculation fields)' })
  deactivate(
    @Param('id') id: string,
    @Body() dto: DeactivateLateFeeRuleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.deactivate(user.tenantId, id, dto, user.id);
  }
}
