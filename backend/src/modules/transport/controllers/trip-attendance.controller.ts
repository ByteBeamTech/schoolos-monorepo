import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '@core/auth/guards/jwt.guard';
import { RolesGuard } from '@core/roles/roles.guard';
import { Roles } from '@core/roles/roles.decorator';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';
import { TripBoardingType } from '@prisma/client';
import { TripAttendanceService } from '../services/trip-attendance.service';
import { MarkAttendanceDto } from '../dto/trip-attendance.dto';

// Same role set as the rest of the Fleet/Trip controllers. Ch.10's SAD lists
// Driver/Conductor as actors conceptually, but this schema's UserRole enum
// has no DRIVER/CONDUCTOR value (verified) -- Driver/Conductor exist only as
// master-data records (Phase 1) with no linked User account, so there's no
// login identity for them to mark their own attendance yet. A field-facing
// driver/conductor portal would need its own User<->Driver link first;
// that's a separate, later feature, not assumed here.
const ATTENDANCE_ROLES = ['SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TRANSPORT_MANAGER'];

@Controller('transport/trips/:tripId/attendance')
@UseGuards(JwtGuard, RolesGuard)
export class TripAttendanceController {
  constructor(private readonly service: TripAttendanceService) {}

  @Get('roster')
  @Roles(...ATTENDANCE_ROLES)
  getRoster(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId') tripId: string,
    @Query('boardingType') boardingType?: TripBoardingType,
  ) {
    return this.service.getRoster(user, tripId, boardingType);
  }

  @Post('mark')
  @Roles(...ATTENDANCE_ROLES)
  markAttendance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId') tripId: string,
    @Body() dto: MarkAttendanceDto,
  ) {
    return this.service.markAttendance(user, tripId, dto);
  }
}
