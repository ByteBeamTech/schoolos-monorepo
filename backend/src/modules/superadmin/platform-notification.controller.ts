import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SendEmailDto } from './dto/send-email.dto';
import { JwtSuperadminGuard } from '../../core/auth/guards/jwt-superadmin.guard';
import { RolesGuard } from '../../core/roles/roles.guard';
import { Roles } from '../../core/roles/roles.decorator';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { SuperadminUser } from '../../core/auth/guards/jwt-superadmin.strategy';
import { SuperadminRoute } from '../../core/auth/decorators/superadmin-route.decorator';
import { PlatformNotificationService } from './platform-notification.service';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';
@SuperadminRoute()
@ApiTags('Superadmin Notifications')
@ApiBearerAuth('access-token')
@UseGuards(JwtSuperadminGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller('superadmin/notifications')
export class PlatformNotificationController {
  constructor(
    private readonly service: PlatformNotificationService,
  ) {}

  @Post('broadcast')
  @ApiOperation({ summary: 'Broadcast notification to schools' })
  broadcast(
    @Body() dto: BroadcastNotificationDto,
    @CurrentUser() user: SuperadminUser,
  ) {
    return this.service.broadcast(dto, user.id);
  }
@Post('email')
@ApiOperation({
  summary: 'Send email to a specific recipient',
})
sendEmail(
  @Body() dto: SendEmailDto,
  @CurrentUser() user: SuperadminUser,
) {
  return this.service.sendEmail(
    dto,
    user.id,
  );
}
}
