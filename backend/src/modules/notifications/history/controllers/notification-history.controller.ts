import {
  Controller,
  Get,
  Query,
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

import { NotificationHistoryService }
from '../services/notification-history.service';

import { NotificationHistoryQueryDto }
from '../dto/notification-history-query.dto';

@ApiTags('notification-history')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('notifications/history')
export class NotificationHistoryController {
  constructor(
    private readonly service: NotificationHistoryService,
  ) {}

  @Get()
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: NotificationHistoryQueryDto,
  ) {
    return this.service.history(
      user.tenantId,
      query,
    );
  }

  @Get('stats')
  stats(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.stats(
      user.tenantId,
    );
  }
}
