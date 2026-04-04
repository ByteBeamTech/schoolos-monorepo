import {
  Body, Controller, Get, Post,
  Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { NotificationService } from '../services/notification.service';
import {
  SendNotificationDto,
  BulkNotificationDto,
  AbsentAlertDto,
  FeeReminderDto,
} from '../dto/notification.dto';
import { JwtGuard }          from '../../../core/auth/guards/jwt.guard';
import { RolesGuard }        from '../../../core/roles/roles.guard';
import { Roles }             from '../../../core/roles/roles.decorator';
import { CurrentUser }       from '../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../core/auth/guards/jwt.strategy';

@ApiTags('notifications')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  @Post('send')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'Send a single notification via email/SMS/WhatsApp' })
  send(@Body() dto: SendNotificationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.send(user.tenantId, dto, user.id);
  }

  @Post('send-bulk')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Send notification to multiple recipients' })
  sendBulk(@Body() dto: BulkNotificationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.sendBulk(user.tenantId, dto, user.id);
  }

  @Post('absent-alerts')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'Send absent alerts to parents for a date/section' })
  sendAbsentAlerts(@Body() dto: AbsentAlertDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.sendAbsentAlerts(user.tenantId, dto, user.id);
  }

  @Post('arrival-notifications')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'Send arrival confirmation to parents after attendance is marked' })
  sendArrivalNotifications(
    @Body() dto: { date: string; sectionId: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.sendArrivalNotifications(user.tenantId, dto.date, dto.sectionId, user.id);
  }

  @Post('fee-reminders')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Send fee payment reminders for upcoming due dates' })
  sendFeeReminders(@Body() dto: FeeReminderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.sendFeeReminders(user.tenantId, dto, user.id);
  }

  @Get()
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'List notifications' })
  @ApiQuery({ name: 'recipientId', required: false })
  @ApiQuery({ name: 'channel',     required: false })
  @ApiQuery({ name: 'status',      required: false })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('recipientId') recipientId?: string,
    @Query('channel')     channel?:     string,
    @Query('status')      status?:      string,
  ) {
    return this.service.findAll(user.tenantId, { recipientId, channel, status });
  }

  @Get('stats')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Notification delivery stats' })
  getStats(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getStats(user.tenantId);
  }
}
