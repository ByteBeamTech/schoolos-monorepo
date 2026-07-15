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
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';
import { Roles } from '@core/roles/roles.decorator';
import { RolesGuard } from '@core/roles/roles.guard';

import { CreateTenantAddonDto } from '../dto/create-tenant-addon.dto';
import { UpdateTenantAddonDto } from '../dto/update-tenant-addon.dto';
import { TenantAddonQueryDto } from '../dto/tenant-addon-query.dto';
import { TenantAddonsService } from '../services/tenant-addons.service';

@ApiTags('Commercial - Tenant Addons')
@ApiBearerAuth()
@Controller('commercial/tenant-addons')
@UseGuards(JwtGuard, RolesGuard)
export class TenantAddonsController {
  constructor(
    private readonly service: TenantAddonsService,
  ) {}

  @Post()
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Assign addon to subscription',
  })
  create(
    @CurrentUser()
    user: AuthenticatedUser,
    @Body()
    dto: CreateTenantAddonDto,
  ) {
    return this.service.create(
      user.tenantId,
      dto,
    );
  }

  @Get()
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'List tenant addons',
  })
  findAll(
    @Query()
    query: TenantAddonQueryDto,
  ) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Get tenant addon',
  })
  findOne(
    @Param('id')
    id: string,
  ) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Update tenant addon',
  })
  update(
    @Param('id')
    id: string,
    @Body()
    dto: UpdateTenantAddonDto,
  ) {
    return this.service.update(
      id,
      dto,
    );
  }

  @Patch(':id/activate')
  @Roles('SUPER_ADMIN')
  activate(
    @Param('id')
    id: string,
  ) {
    return this.service.activate(id);
  }

  @Patch(':id/deactivate')
  @Roles('SUPER_ADMIN')
  deactivate(
    @Param('id')
    id: string,
  ) {
    return this.service.deactivate(id);
  }

  @Patch(':id/archive')
  @Roles('SUPER_ADMIN')
  archive(
    @Param('id')
    id: string,
  ) {
    return this.service.archive(id);
  }

  @Get('subscription/:subscriptionId')
  @Roles('SUPER_ADMIN')
  bySubscription(
    @Param('subscriptionId')
    subscriptionId: string,
  ) {
    return this.service.bySubscription(
      subscriptionId,
    );
  }
}
