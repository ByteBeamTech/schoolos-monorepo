// backend/src/modules/student-billing/billing-rules/controllers/billing-rule.controller.ts
//
// Phase 2, frozen. No PATCH/PUT route exists here, deliberately -- see
// billing-rule.service.ts's own header comment. A permanent change is a
// new FeePlan referencing a new rule, not an edit to this one.

import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BillingRuleService } from '../services/billing-rule.service';
import { CreateBillingRuleDto } from '../../dto/billing.dto';
import { JwtGuard }          from '../../../../core/auth/guards/jwt.guard';
import { RolesGuard }        from '../../../../core/roles/roles.guard';
import { Roles }             from '../../../../core/roles/roles.decorator';
import { CurrentUser }       from '../../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../../core/auth/guards/jwt.strategy';

@ApiTags('billing-rules')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('billing/billing-rules')
export class BillingRuleController {
  constructor(private readonly service: BillingRuleService) {}

  @Post()
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Create a billing rule (create-only -- never edited once referenced by a plan)' })
  create(@Body() dto: CreateBillingRuleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(user.tenantId, dto);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'List billing rules' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findAll(user.tenantId);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Get a billing rule by id' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findById(user.tenantId, id);
  }
}
