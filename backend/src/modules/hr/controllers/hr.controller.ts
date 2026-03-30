import {
  Controller,
  Get,
  Post,
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
import { HRService } from '../services/hr.service';
import {
  CreateJoiningRequestDto,
  ApproveJoiningDto,
  RejectJoiningDto,
  ApplyLeaveDto,
  ApproveLeaveDto,
  RejectLeaveDto,
  ConfigureWorkflowDto,
  SetLeaveBalanceDto,
  JoiningRequestQueryDto,
  LeaveQueryDto,
} from '../dto/hr.dto';

@ApiTags('hr')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('hr')
export class HRController {
  constructor(private readonly hrService: HRService) {}

  // ========== WORKFLOW CONFIG ==========

  @Post('workflow/configure')
  @ApiOperation({ summary: 'Configure approval workflow' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  async configureWorkflow(@Req() req: any, @Body() dto: ConfigureWorkflowDto) {
    return this.hrService.configureWorkflow(req.tenantId, dto, req.user.id);
  }

  @Get('workflow/:type')
  @ApiOperation({ summary: 'Get workflow configuration' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'HR_MANAGER')
  async getWorkflowConfig(@Req() req: any, @Param('type') type: string) {
    return this.hrService.getWorkflowConfig(req.tenantId, type);
  }

  // ========== JOINING REQUESTS ==========

  @Post('joining')
  @ApiOperation({ summary: 'Create a new joining request' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'HR_MANAGER')
  async createJoiningRequest(@Req() req: any, @Body() dto: CreateJoiningRequestDto) {
    return this.hrService.createJoiningRequest(req.tenantId, dto, req.user.id);
  }

  @Get('joining')
  @ApiOperation({ summary: 'Get all joining requests' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'HR_MANAGER')
  async getJoiningRequests(@Req() req: any, @Query() query: JoiningRequestQueryDto) {
    return this.hrService.getJoiningRequests(req.tenantId, query);
  }

  @Get('joining/pending')
  @ApiOperation({ summary: 'Get pending approvals for current user role' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'HR_MANAGER')
  async getPendingApprovals(@Req() req: any) {
    return this.hrService.getPendingApprovalsForRole(req.tenantId, req.user.role);
  }

  @Get('joining/:id')
  @ApiOperation({ summary: 'Get joining request details' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'HR_MANAGER')
  async getJoiningRequest(@Req() req: any, @Param('id') id: string) {
    return this.hrService.getJoiningRequestById(req.tenantId, id);
  }

  @Post('joining/:id/approve')
  @ApiOperation({ summary: 'Approve joining request at current level' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'HR_MANAGER')
  async approveJoining(@Req() req: any, @Param('id') id: string, @Body() dto: ApproveJoiningDto) {
    return this.hrService.approveJoiningRequest(
      req.tenantId,
      id,
      dto,
      req.user.id,
      req.user.role,
    );
  }

  @Post('joining/:id/reject')
  @ApiOperation({ summary: 'Reject joining request' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'HR_MANAGER')
  async rejectJoining(@Req() req: any, @Param('id') id: string, @Body() dto: RejectJoiningDto) {
    return this.hrService.rejectJoiningRequest(
      req.tenantId,
      id,
      dto,
      req.user.id,
      req.user.role,
    );
  }

  // ========== STAFF LEAVE ==========

  @Post('leave/apply')
  @ApiOperation({ summary: 'Apply for leave' })
  async applyLeave(@Req() req: any, @Body() dto: ApplyLeaveDto) {
    return this.hrService.applyLeave(req.tenantId, req.user.id, dto);
  }

  @Get('leave')
  @ApiOperation({ summary: 'Get leave requests' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'HR_MANAGER')
  async getLeaveRequests(@Req() req: any, @Query() query: LeaveQueryDto) {
    return this.hrService.getLeaveRequests(req.tenantId, query);
  }

  @Get('leave/my')
  @ApiOperation({ summary: 'Get my leave requests' })
  async getMyLeaveRequests(@Req() req: any) {
    return this.hrService.getLeaveRequests(req.tenantId, { staffId: req.user.id });
  }

  @Post('leave/:id/approve')
  @ApiOperation({ summary: 'Approve leave request' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'HR_MANAGER')
  async approveLeave(@Req() req: any, @Param('id') id: string, @Body() dto: ApproveLeaveDto) {
    return this.hrService.approveLeave(req.tenantId, id, req.user.id, dto.comments);
  }

  @Post('leave/:id/reject')
  @ApiOperation({ summary: 'Reject leave request' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'HR_MANAGER')
  async rejectLeave(@Req() req: any, @Param('id') id: string, @Body() dto: RejectLeaveDto) {
    return this.hrService.rejectLeave(req.tenantId, id, req.user.id, dto.reason);
  }

  // ========== LEAVE BALANCE ==========

  @Post('leave-balance')
  @ApiOperation({ summary: 'Set leave balance for staff' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'HR_MANAGER')
  async setLeaveBalance(@Req() req: any, @Body() dto: SetLeaveBalanceDto) {
    return this.hrService.setLeaveBalance(req.tenantId, dto);
  }

  @Get('leave-balance/:staffId/:year')
  @ApiOperation({ summary: 'Get leave balances for staff' })
  async getLeaveBalances(
    @Req() req: any,
    @Param('staffId') staffId: string,
    @Param('year') year: string,
  ) {
    return this.hrService.getLeaveBalances(req.tenantId, staffId, parseInt(year));
  }

  @Get('leave/balances')
  @ApiOperation({ summary: 'Get leave balances (flat, current year)' })
  async getLeaveBalancesFlat(
    @Req() req: any,
    @Query('staffId') staffId?: string,
  ) {
    if (!staffId) return [];
    const year = new Date().getFullYear();
    return this.hrService.getLeaveBalances(req.tenantId, staffId, year);
  }

}
