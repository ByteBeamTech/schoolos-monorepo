import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';
import { JwtGuard } from '@core/auth/guards/jwt.guard';
import { Roles } from '@core/roles/roles.decorator';
import { RolesGuard } from '@core/roles/roles.guard';

import { TenantSubscriptionQueryDto } from '../dto/tenant-subscription-query.dto';
import { TenantSubscriptionsService } from '../services/tenant-subscriptions.service';

@ApiTags('Commercial - Tenant Subscriptions')
@ApiBearerAuth()
@Controller('commercial/subscriptions')
@UseGuards(JwtGuard, RolesGuard)
export class TenantSubscriptionsController {
  constructor(
    private readonly service: TenantSubscriptionsService,
  ) {}

  @Get('current')
  @Roles(
    'SUPER_ADMIN',
    'SCHOOL_OWNER',
    'SCHOOL_ADMIN',
  )
  @ApiOperation({
    summary: 'Current tenant subscription',
  })
  current(
    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    return this.service.getCurrentSubscription(
      user.tenantId,
    );
  }

  @Get()
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'List subscriptions',
  })
  findAll(
    @Query()
    query: TenantSubscriptionQueryDto,
  ) {
    return this.service.findAll(
      query,
    );
  }

  @Get(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Subscription details',
  })
  findOne(
    @Param('id')
    id: string,
  ) {
    return this.service.getById(id);
  }

  @Patch(':id/cancel')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Cancel subscription',
  })
  cancel(
    @Param('id')
    id: string,

    @Body('reason')
    reason?: string,
  ) {
    return this.service.cancel(
      id,
      reason,
    );
  }

  @Patch(':id/enable-auto-renew')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Enable auto renewal',
  })
  enableAutoRenew(
    @Param('id')
    id: string,
  ) {
    return this.service.enableAutoRenew(
      id,
    );
  }

  @Patch(':id/disable-auto-renew')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Disable auto renewal',
  })
  disableAutoRenew(
    @Param('id')
    id: string,
  ) {
    return this.service.disableAutoRenew(
      id,
    );
  }
}
