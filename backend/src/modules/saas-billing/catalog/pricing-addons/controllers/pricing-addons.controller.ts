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

import { CreatePricingAddonDto } from '../dto/create-pricing-addon.dto';
import { PricingAddonQueryDto } from '../dto/pricing-addon-query.dto';
import { UpdatePricingAddonDto } from '../dto/update-pricing-addon.dto';
import { PricingAddonsService } from '../services/pricing-addons.service';

@ApiTags('Commercial - Pricing Addons')
@ApiBearerAuth()
@Controller('commercial/pricing-addons')
@UseGuards(JwtGuard, RolesGuard)
export class PricingAddonsController {
  constructor(
    private readonly service: PricingAddonsService,
  ) {}

  @Post()
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Create pricing addon',
  })
  create(
    @Body() dto: CreatePricingAddonDto,
  ) {
    return this.service.create(dto);
  }

  @Get()
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'List pricing addons',
  })
  findAll(
    @Query() query: PricingAddonQueryDto,
  ) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Get pricing addon',
  })
  findOne(
    @Param('id') id: string,
  ) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Update pricing addon',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePricingAddonDto,
  ) {
    return this.service.update(id, dto);
  }

  @Patch(':id/archive')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Archive pricing addon',
  })
  archive(
    @Param('id') id: string,
  ) {
    return this.service.archive(id);
  }

  @Patch(':id/restore')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Restore pricing addon',
  })
  restore(
    @Param('id') id: string,
  ) {
    return this.service.restore(id);
  }

  @Get('active/list')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'List active pricing addons',
  })
  findActive() {
    return this.service.active();
  }
}
