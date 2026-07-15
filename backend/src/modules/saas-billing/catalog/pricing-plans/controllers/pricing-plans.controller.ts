import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { JwtGuard } from '@core/auth/guards/jwt.guard';
import { Roles } from '@core/roles/roles.decorator';
import { RolesGuard } from '@core/roles/roles.guard';

import { CreatePricingPlanDto } from '../dto/create-pricing-plan.dto';
import { PricingPlanQueryDto } from '../dto/pricing-plan-query.dto';
import { UpdatePricingPlanDto } from '../dto/update-pricing-plan.dto';
import { PricingPlansService } from '../services/pricing-plans.service';

@ApiTags('Commercial - Pricing Plans')
@ApiBearerAuth()
@Controller('commercial/pricing-plans')
@UseGuards(JwtGuard, RolesGuard)
export class PricingPlansController {
  constructor(
    private readonly service: PricingPlansService,
  ) {}

  @Post()
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Create pricing plan',
  })
  create(
    @Body() dto: CreatePricingPlanDto,
  ) {
    return this.service.create(dto);
  }

  @Get()
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'List pricing plans',
  })
  findAll(
    @Query() query: PricingPlanQueryDto,
  ) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Get pricing plan',
  })
  findOne(
    @Param('id') id: string,
  ) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Update pricing plan',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePricingPlanDto,
  ) {
    return this.service.update(id, dto);
  }

  @Patch(':id/archive')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Archive pricing plan',
  })
  archive(
    @Param('id') id: string,
  ) {
    return this.service.archive(id);
  }

  @Patch(':id/restore')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Restore pricing plan',
  })
  restore(
    @Param('id') id: string,
  ) {
    return this.service.restore(id);
  }

  @Patch(':id/publish')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Publish pricing plan',
  })
  publish(
    @Param('id') id: string,
  ) {
    return this.service.publish(id);
  }

  @Get('public/list')
  @ApiOperation({
    summary: 'Public pricing plans',
  })
  findPublic() {
    return this.service.findPublic();
  }

  @Get('recommended/list')
  @ApiOperation({
    summary: 'Recommended pricing plans',
  })
  findRecommended() {
    return this.service.findRecommended();
  }
}
