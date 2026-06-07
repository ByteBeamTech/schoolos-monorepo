import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';

import { JwtGuard } from '../../../../core/auth/guards/jwt.guard';
import { RolesGuard } from '../../../../core/roles/roles.guard';

import { CurrentUser } from '../../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../../core/auth/guards/jwt.strategy';

import { NotificationPreferencesService } from '../services/notification-preferences.service';
import { UpdateNotificationPolicyDto } from '../dto/update-notification-policy.dto';

@ApiTags('notification-preferences')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('notifications/preferences')
export class NotificationPreferencesController {
  constructor(
    private readonly service: NotificationPreferencesService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.listPolicies(
      user.tenantId,
    );
  }

  @Put(':eventType')
  async update(
    @Param('eventType') eventType: string,
    @Body() dto: UpdateNotificationPolicyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updatePolicy(
      user.tenantId,
      eventType,
      dto,
    );
  }
}
