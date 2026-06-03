import {
  Controller, Get, Post, Patch, Param,
  Body, Query, UseGuards,
}  from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AttendanceService }     from '../services/attendance.service';
import { LeaveService }          from '../leave/leave.service';
import {
  BulkMarkAttendanceDto,
  MarkPeriodAttendanceDto,
  UpdateAttendanceDto,
  CreateLeaveRequestDto,
  ApproveLeaveDto,
} from '../dto/attendance.dto';
import { JwtGuard }          from '../../../core/auth/guards/jwt.guard';
import { RolesGuard }        from '../../../core/roles/roles.guard';
import { Roles }             from '../../../core/roles/roles.decorator';
import { CurrentUser }       from '../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../core/auth/guards/jwt.strategy';

@ApiTags('attendance')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly attendance: AttendanceService,
    private readonly leave:      LeaveService,
  ) {}

  @Post('daily')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'Mark daily attendance for a section' })
  markDaily(@Body() dto: BulkMarkAttendanceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.attendance.bulkMarkDaily(user.tenantId, dto, user.id, user.role);
  }

  @Get('daily')
  @ApiOperation({ summary: 'Get section attendance for a date' })
  @ApiQuery({ name: 'sectionId', required: true })
  @ApiQuery({ name: 'date',      required: true })
  getDaily(
    @CurrentUser() user: AuthenticatedUser,
    @Query('sectionId') sectionId: string,
    @Query('date')      date:      string,
  ) {
    return this.attendance.getSectionAttendance(user.tenantId, sectionId, date);
  }

  @Post('period')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'Mark period-wise attendance' })
  markPeriod(@Body() dto: MarkPeriodAttendanceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.attendance.markPeriodWise(user.tenantId, dto, user.id, user.role);
  }

  @Get('period')
  @ApiOperation({ summary: 'Get period-wise attendance for a section' })
  @ApiQuery({ name: 'sectionId', required: true })
  @ApiQuery({ name: 'date',      required: true })
  @ApiQuery({ name: 'period',    required: true })
  getPeriod(
    @CurrentUser() user: AuthenticatedUser,
    @Query('sectionId') sectionId: string,
    @Query('date')      date:      string,
    @Query('period')    period:    string,
  ) {
    return this.attendance.getSectionAttendance(user.tenantId, sectionId, date, parseInt(period));
  }

  @Get('student/:studentId')
  @ApiOperation({ summary: 'Get student attendance for date range' })
  @ApiQuery({ name: 'fromDate', required: true })
  @ApiQuery({ name: 'toDate',   required: true })
  getStudentAttendance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId') studentId: string,
    @Query('fromDate')  fromDate:  string,
    @Query('toDate')    toDate:    string,
  ) {
    return this.attendance.getStudentAttendance(user.tenantId, studentId, fromDate, toDate);
  }

  @Patch(':id')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'Update a single attendance record' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAttendanceDto,
  ) {
    return this.attendance.updateAttendance(user.tenantId, id, dto, user.id);
  }

  @Get('absentees')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'Get absentees for a date' })
  @ApiQuery({ name: 'date',      required: true })
  @ApiQuery({ name: 'sectionId', required: false })
  getAbsentees(
    @CurrentUser() user: AuthenticatedUser,
    @Query('date')      date:       string,
    @Query('sectionId') sectionId?: string,
  ) {
    return this.attendance.getAbsentees(user.tenantId, date, sectionId);
  }

  @Get('report/monthly')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'Monthly attendance report for a section' })
  @ApiQuery({ name: 'sectionId', required: true })
  @ApiQuery({ name: 'year',      required: true })
  @ApiQuery({ name: 'month',     required: true })
  getMonthlyReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query('sectionId') sectionId: string,
    @Query('year')      year:      string,
    @Query('month')     month:     string,
  ) {
    return this.attendance.getMonthlyReport(user.tenantId, sectionId, parseInt(year), parseInt(month));
  }

  @Get('register/monthly')
@Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
@ApiOperation({ summary: 'Monthly attendance register' })
@ApiQuery({ name: 'sectionId', required: true })
@ApiQuery({ name: 'year', required: true })
@ApiQuery({ name: 'month', required: true })
getMonthlyRegister(
  @CurrentUser() user: AuthenticatedUser,
  @Query('sectionId') sectionId: string,
  @Query('year') year: string,
  @Query('month') month: string,
) {
  return this.attendance.getMonthlyRegister(
    user.tenantId,
    sectionId,
    parseInt(year),
    parseInt(month),
  );
}

  @Get('stats')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Attendance dashboard stats' })
  @ApiQuery({ name: 'date', required: true })
  getStats(@CurrentUser() user: AuthenticatedUser, @Query('date') date: string) {
    return this.attendance.getDashboardStats(user.tenantId, date);
  }

  @Post('leave')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER', 'PARENT')
  @ApiOperation({ summary: 'Submit leave request for student' })
  createLeave(@Body() dto: CreateLeaveRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.leave.create(user.tenantId, dto, user.id);
  }

  @Get('leave')
  @ApiOperation({ summary: 'List leave requests' })
  @ApiQuery({ name: 'studentId', required: false })
  @ApiQuery({ name: 'status',    required: false })
  getLeaves(
    @CurrentUser() user: AuthenticatedUser,
    @Query('studentId') studentId?: string,
    @Query('status')    status?:    string,
  ) {
    return this.leave.findAll(user.tenantId, { studentId, status });
  }

  @Get('leave/pending')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'List pending leave requests' })
  getPendingLeaves(@CurrentUser() user: AuthenticatedUser) {
    return this.leave.getPending(user.tenantId);
  }

  @Get('leave/:id')
  @ApiOperation({ summary: 'Get leave request by ID' })
  getLeave(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.leave.findById(user.tenantId, id);
  }

  @Post('leave/:id/approve')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'Approve leave — auto-marks attendance as LEAVE' })
  approveLeave(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() _dto: ApproveLeaveDto,
  ) {
    return this.leave.approve(user.tenantId, id, user.id);
  }

  @Post('leave/:id/reject')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'Reject leave request' })
  rejectLeave(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.leave.reject(user.tenantId, id, user.id);
  }
}
