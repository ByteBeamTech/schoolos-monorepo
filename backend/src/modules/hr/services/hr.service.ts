import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import {
  CreateJoiningRequestDto,
  ApproveJoiningDto,
  RejectJoiningDto,
  ApplyLeaveDto,
  ConfigureWorkflowDto,
  SetLeaveBalanceDto,
  JoiningRequestQueryDto,
  LeaveQueryDto,
} from '../dto/hr.dto';

@Injectable()
export class HRService {
  private readonly logger = new Logger(HRService.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // ========== WORKFLOW CONFIG ==========

  async configureWorkflow(tenantId: string, dto: ConfigureWorkflowDto, userId: string) {
    return this.prisma.approvalWorkflowConfig.upsert({
      where: { tenantId_workflowType: { // @ts-ignore
          tenantId, workflowType: dto.workflowType } },
      create: {
        // @ts-ignore
          tenantId,
        workflowType: dto.workflowType,
        levels: dto.levels as any,
        createdBy: userId,
      },
      update: {
        levels: dto.levels as any,
      },
    });
  }

  async getWorkflowConfig(tenantId: string, workflowType: string) {
    return this.prisma.approvalWorkflowConfig.findUnique({
      where: { tenantId_workflowType: { // @ts-ignore
          tenantId, workflowType } },
    });
  }

  // ========== JOINING REQUESTS ==========

  async createJoiningRequest(tenantId: string, dto: CreateJoiningRequestDto, submittedBy: string) {
    // Get workflow config
    const workflow = await this.getWorkflowConfig(// @ts-ignore
          tenantId, 'joining');
    const levels = (workflow?.levels as any[]) || [{ level: 1, role: 'SCHOOL_ADMIN' }];
    const maxLevel = levels.length;

    // Create joining request
    const request = await this.prisma.joiningRequest.create({
      data: {
        // @ts-ignore
          tenantId,
        candidateName: dto.candidateName,
        email: dto.email,
        phone: dto.phone,
        position: dto.position,
        department: dto.department,
        proposedSalary: dto.proposedSalary,
        resumeUrl: dto.resumeUrl,
        documents: dto.documents,
        notes: dto.notes,
        // @ts-ignore
        submittedBy,
        maxLevel,
        currentLevel: 1,
        status: 'PENDING',
      },
    });

    // Create approval records for each level
    for (const levelConfig of levels) {
      await this.prisma.joiningApproval.create({
        data: {
          joiningRequestId: request.id,
          // @ts-ignore
          tenantId,
          level: levelConfig.level,
          approverRole: levelConfig.role as any,
          approverId: '', // Will be filled when someone with this role approves
          status: levelConfig.level === 1 ? 'PENDING' : 'PENDING',
        },
      });
    }

    this.logger.log(`Joining request created: ${request.id} for ${dto.candidateName}`);
    return request;
  }

  async getJoiningRequests(tenantId: string, query: JoiningRequestQueryDto) {
    const where: any = { tenantId };
    if (query.status) where.status = query.status;
    if (query.department) where.department = query.department;

    return this.prisma.joiningRequest.findMany({
      where,
      include: { approvals: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getJoiningRequestById(tenantId: string, id: string) {
    const request = await this.prisma.joiningRequest.findFirst({
      where: { id, tenantId },
      include: { approvals: { orderBy: { level: 'asc' } } },
    });

    if (!request) throw new NotFoundException('Joining request not found');
    return request;
  }

  async getPendingApprovalsForRole(tenantId: string, role: string) {
    // Find all joining requests where current level approval is pending for this role
    const approvals = await this.prisma.joiningApproval.findMany({
      where: {
        // @ts-ignore
          tenantId,
        approverRole: role as any,
        status: 'PENDING',
      },
      include: {
        joiningRequest: true,
      },
    });

    // Filter to only show if it's the current level
    return approvals.filter((a: any) => a.joiningRequest.currentLevel === a.level);
  }

  async approveJoiningRequest(
    tenantId: string,
    requestId: string,
    dto: ApproveJoiningDto,
    approverId: string,
    approverRole: string,
  ) {
    const request = await this.getJoiningRequestById(// @ts-ignore
          tenantId, requestId);

    // Find current level approval
    const currentApproval = request.approvals.find((a: any) => a.level === request.currentLevel);
    if (!currentApproval) throw new BadRequestException('No pending approval found');

    // Check if approver has the right role
    if (currentApproval.approverRole !== approverRole) {
      throw new ForbiddenException(`This approval requires ${currentApproval.approverRole} role`);
    }

    // Update approval
    await this.prisma.joiningApproval.update({
      where: { id: currentApproval.id },
      data: {
        status: 'APPROVED',
        approverId,
        comments: dto.comments,
        actionAt: new Date(),
      },
    });

    // Check if this is the last level
    if (request.currentLevel >= request.maxLevel) {
      // Final approval - mark as approved
      await this.prisma.joiningRequest.update({
        where: { id: requestId },
        data: { status: 'APPROVED' },
      });
      this.logger.log(`Joining request ${requestId} fully approved`);
    } else {
      // Move to next level
      await this.prisma.joiningRequest.update({
        where: { id: requestId },
        data: {
          currentLevel: request.currentLevel + 1,
          status: 'IN_REVIEW',
        },
      });
    }

    return this.getJoiningRequestById(// @ts-ignore
          tenantId, requestId);
  }

  async rejectJoiningRequest(
    tenantId: string,
    requestId: string,
    dto: RejectJoiningDto,
    approverId: string,
    approverRole: string,
  ) {
    const request = await this.getJoiningRequestById(// @ts-ignore
          tenantId, requestId);

    const currentApproval = request.approvals.find((a: any) => a.level === request.currentLevel);
    if (!currentApproval) throw new BadRequestException('No pending approval found');

    if (currentApproval.approverRole !== approverRole) {
      throw new ForbiddenException(`This approval requires ${currentApproval.approverRole} role`);
    }

    await this.prisma.joiningApproval.update({
      where: { id: currentApproval.id },
      data: {
        status: 'REJECTED',
        approverId,
        comments: dto.comments,
        actionAt: new Date(),
      },
    });

    await this.prisma.joiningRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        // @ts-ignore
        rejectionReason: dto.reason,
      },
    });

    this.logger.log(`Joining request ${requestId} rejected`);
    return this.getJoiningRequestById(// @ts-ignore
          tenantId, requestId);
  }

  // ========== STAFF LEAVE ==========

  async applyLeave(tenantId: string, staffId: string, dto: ApplyLeaveDto) {
    const fromDate = new Date(dto.fromDate);
    const toDate = new Date(dto.toDate);
    const diffTime = Math.abs(toDate.getTime() - fromDate.getTime());
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    // Check leave balance
    const year = fromDate.getFullYear();
    const balance = await this.prisma.leaveBalance.findUnique({
      where: {
        tenantId_staffId_leaveType_year: {
          // @ts-ignore
          tenantId,
          staffId,
          leaveType: dto.leaveType as any,
          year,
        },
      },
    });

    if (balance && balance.totalDays - balance.usedDays < totalDays) {
      throw new BadRequestException(
        `Insufficient leave balance. Available: ${balance.totalDays - balance.usedDays}, Requested: ${totalDays}`,
      );
    }

    await this.prisma.staffLeave.create({
      data: {
        // @ts-ignore
          tenantId,
        staffId,
        leaveType: dto.leaveType as any,
        fromDate,
        toDate,
        totalDays,
        reason: dto.reason,
        status: 'PENDING',
      },
    });
  }

  async getLeaveRequests(tenantId: string, query: LeaveQueryDto) {
    const where: any = { tenantId };
    if (query.staffId) where.staffId = query.staffId;
    if (query.status) where.status = query.status;
    if (query.fromDate || query.toDate) {
      where.fromDate = {};
      if (query.fromDate) where.fromDate.gte = new Date(query.fromDate);
      if (query.toDate) where.fromDate.lte = new Date(query.toDate);
    }

    return this.prisma.staffLeave.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveLeave(tenantId: string, leaveId: string, approverId: string, comments?: string) {
    const leave = await this.prisma.staffLeave.findFirst({
      where: { id: leaveId, tenantId },
    });

    if (!leave) throw new NotFoundException('Leave request not found');
    if (leave.status !== 'PENDING') throw new BadRequestException('Leave already processed');

    // Deduct from balance
    const year = leave.fromDate.getFullYear();
    await this.prisma.leaveBalance.upsert({
      where: {
        tenantId_staffId_leaveType_year: {
          // @ts-ignore
          tenantId,
          staffId: leave.staffId,
          leaveType: leave.leaveType,
          year,
        },
      },
      create: {
        // @ts-ignore
          tenantId,
        staffId: leave.staffId,
        leaveType: leave.leaveType,
        year,
        totalDays: 0,
        usedDays: leave.totalDays,
      },
      update: {
        usedDays: { increment: leave.totalDays },
      },
    });

    return this.prisma.staffLeave.update({
      where: { id: leaveId },
      data: {
        status: 'APPROVED',
        approvedBy: approverId,
        // @ts-ignore
        approvedAt: new Date(),
        comments,
      },
    });
  }

  async rejectLeave(tenantId: string, leaveId: string, approverId: string, reason: string) {
    const leave = await this.prisma.staffLeave.findFirst({
      where: { id: leaveId, tenantId },
    });

    if (!leave) throw new NotFoundException('Leave request not found');
    if (leave.status !== 'PENDING') throw new BadRequestException('Leave already processed');

    return this.prisma.staffLeave.update({
      where: { id: leaveId },
      data: {
        status: 'REJECTED',
        approvedBy: approverId,
        // @ts-ignore
        approvedAt: new Date(),
        comments: reason,
      },
    });
  }

  // ========== LEAVE BALANCE ==========

  async setLeaveBalance(tenantId: string, dto: SetLeaveBalanceDto) {
    return this.prisma.leaveBalance.upsert({
      where: {
        tenantId_staffId_leaveType_year: {
          // @ts-ignore
          tenantId,
          staffId: dto.staffId,
          leaveType: dto.leaveType as any,
          year: dto.year,
        },
      },
      create: {
        // @ts-ignore
          tenantId,
        staffId: dto.staffId,
        leaveType: dto.leaveType as any,
        totalDays: dto.totalDays,
        usedDays: 0,
        year: dto.year,
      },
      update: {
        totalDays: dto.totalDays,
      },
    });
  }

  async getLeaveBalances(tenantId: string, staffId: string, year: number) {
    return this.prisma.leaveBalance.findMany({
      where: { // @ts-ignore
          tenantId, staffId, year },
    });
  }
}
