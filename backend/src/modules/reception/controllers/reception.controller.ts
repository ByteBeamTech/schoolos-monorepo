import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtGuard } from '../../../core/auth/guards/jwt.guard';
import { RolesGuard } from '../../../core/roles/roles.guard';
import { Roles } from '../../../core/roles/roles.decorator';
import { ReceptionService } from '../services/reception.service';
import {
  CreateComplaintDto,
  UpdateComplaintDto,
  ResolveComplaintDto,
  AddCommentDto,
  ComplaintQueryDto,
  MarkStaffAttendanceDto,
  BulkStaffAttendanceDto,
  StaffAttendanceQueryDto,
  CreateVisitorDto,
  CheckOutVisitorDto,
  VisitorQueryDto,
} from '../dto/reception.dto';

@ApiTags('reception')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('reception')
export class ReceptionController {
  constructor(private readonly receptionService: ReceptionService) {}

  // ========== COMPLAINTS ==========

  @Post('complaints')
  @ApiOperation({ summary: 'Create a new complaint' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'RECEPTIONIST', 'TEACHER')
  async createComplaint(@Req() req: any, @Body() dto: CreateComplaintDto) {
    return this.receptionService.createComplaint(req.tenantId, dto, req.user.id);
  }

  @Get('complaints')
  @ApiOperation({ summary: 'Get all complaints' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'RECEPTIONIST')
  async getComplaints(@Req() req: any, @Query() query: ComplaintQueryDto) {
    return this.receptionService.getComplaints(req.tenantId, query);
  }

  @Get('complaints/:id')
  @ApiOperation({ summary: 'Get complaint details' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'RECEPTIONIST')
  async getComplaint(@Req() req: any, @Param('id') id: string) {
    return this.receptionService.getComplaintById(req.tenantId, id);
  }

  @Patch('complaints/:id')
  @ApiOperation({ summary: 'Update complaint (status, assignment, priority)' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'RECEPTIONIST')
  async updateComplaint(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateComplaintDto) {
    return this.receptionService.updateComplaint(req.tenantId, id, dto, req.user.id);
  }

  @Post('complaints/:id/resolve')
  @ApiOperation({ summary: 'Resolve a complaint' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'RECEPTIONIST')
  async resolveComplaint(@Req() req: any, @Param('id') id: string, @Body() dto: ResolveComplaintDto) {
    return this.receptionService.resolveComplaint(req.tenantId, id, dto, req.user.id);
  }

  @Post('complaints/:id/comment')
  @ApiOperation({ summary: 'Add comment to complaint' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'RECEPTIONIST', 'TEACHER')
  async addComment(@Req() req: any, @Param('id') id: string, @Body() dto: AddCommentDto) {
    return this.receptionService.addComment(req.tenantId, id, dto, req.user.id);
  }

  // ========== STAFF ATTENDANCE ==========

  @Post('staff-attendance')
  @ApiOperation({ summary: 'Mark staff attendance' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'RECEPTIONIST', 'HR_MANAGER')
  async markStaffAttendance(@Req() req: any, @Body() dto: MarkStaffAttendanceDto) {
    return this.receptionService.markStaffAttendance(req.tenantId, dto, req.user.id);
  }

  @Post('staff-attendance/bulk')
  @ApiOperation({ summary: 'Bulk mark staff attendance' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'RECEPTIONIST', 'HR_MANAGER')
  async bulkMarkStaffAttendance(@Req() req: any, @Body() dto: BulkStaffAttendanceDto) {
    return this.receptionService.bulkMarkStaffAttendance(req.tenantId, dto, req.user.id);
  }

  @Get('staff-attendance')
  @ApiOperation({ summary: 'Get staff attendance records' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'RECEPTIONIST', 'HR_MANAGER')
  async getStaffAttendance(@Req() req: any, @Query() query: StaffAttendanceQueryDto) {
    return this.receptionService.getStaffAttendance(req.tenantId, query);
  }

  @Get('staff-attendance/summary/:month/:year')
  @ApiOperation({ summary: 'Get staff attendance summary for a month' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'HR_MANAGER')
  async getStaffAttendanceSummary(
    @Req() req: any,
    @Param('month') month: string,
    @Param('year') year: string,
  ) {
    return this.receptionService.getStaffAttendanceSummary(
      req.tenantId,
      parseInt(month),
      parseInt(year),
    );
  }

  // ========== VISITORS ==========

  @Post('visitors')
  @ApiOperation({ summary: 'Check in a visitor' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'RECEPTIONIST')
  async createVisitor(@Req() req: any, @Body() dto: CreateVisitorDto) {
    return this.receptionService.createVisitor(req.tenantId, dto, req.user.id);
  }

  @Get('visitors')
  @ApiOperation({ summary: 'Get visitors list' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'RECEPTIONIST')
  async getVisitors(@Req() req: any, @Query() query: VisitorQueryDto) {
    return this.receptionService.getVisitors(req.tenantId, query);
  }

  @Get('visitors/stats/today')
  @ApiOperation({ summary: 'Get today visitor statistics' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'RECEPTIONIST')
  async getTodayVisitorStats(@Req() req: any) {
    return this.receptionService.getTodayVisitorStats(req.tenantId);
  }

  @Get('visitors/:id')
  @ApiOperation({ summary: 'Get visitor details' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'RECEPTIONIST')
  async getVisitor(@Req() req: any, @Param('id') id: string) {
    return this.receptionService.getVisitorById(req.tenantId, id);
  }

  @Get('visitors/:id/pass')
  @ApiOperation({ summary: 'Get visitor pass for printing' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'RECEPTIONIST')
  async getVisitorPass(@Req() req: any, @Param('id') id: string) {
    return this.receptionService.getVisitorPass(req.tenantId, id);
  }

  @Post('visitors/:id/checkout')
  @ApiOperation({ summary: 'Check out a visitor' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'RECEPTIONIST')
  async checkOutVisitor(@Req() req: any, @Param('id') id: string, @Body() dto: CheckOutVisitorDto) {
    return this.receptionService.checkOutVisitor(req.tenantId, id, dto);
  }
}
