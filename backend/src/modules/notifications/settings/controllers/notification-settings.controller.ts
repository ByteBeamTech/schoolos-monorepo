import {
  Body,
  Controller,
  Get,
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

import { NotificationSettingsService } from '../services/notification-settings.service';
import { UpdateNotificationSettingsDto } from '../dto/update-notification-settings.dto';

@ApiTags('notification-settings')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('notifications/settings')
export class NotificationSettingsController {
  constructor(
    private readonly settingsService: NotificationSettingsService,
  ) {}

  @Get()
  async getSettings(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.getSettings(
      user.tenantId,
    );
  }

  @Put()
  async updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateNotificationSettingsDto,
  ) {
    return this.settingsService.updateSettings(
      user.tenantId,
      dto,
    );
  }
}
