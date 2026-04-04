import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService }  from '../../../core/compliance/audit.service';
import { CreateLeaveRequestDto } from '../dto/attendance.dto';

@Injectable()
export class LeaveService {
  private readonly logger = new Logger(LeaveService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit:  AuditService,
  ) {}

  async create(tenantId: string, dto: CreateLeaveRequestDto, actorId: string) {
    const student = await this.prisma.student.findFirst({ where: { id: dto.studentId, tenantId } });
    if (!student) throw new NotFoundException(`Student not found: ${dto.studentId}`);

    const from = new Date(dto.fromDate);
    const to   = new Date(dto.toDate);
    if (from > to) throw new BadRequestException('fromDate must be before toDate.');

    const leave = await this.prisma.leaveRequest.create({
      data: {
        tenantId,
        studentId: dto.studentId,
        fromDate:  from,
        toDate:    to,
        reason:    dto.reason,
        status:    'PENDING',
        appliedBy: actorId,
      },
    });

    await this.audit.logCreate({
      tenantId, actorId,
      entityType: 'LeaveRequest', entityId: leave.id,
      after: { studentId: dto.studentId, fromDate: dto.fromDate, toDate: dto.toDate },
    });

    this.logger.log(`Leave request: ${dto.studentId} | ${dto.fromDate} to ${dto.toDate}`);
    return leave;
  }

  async findAll(tenantId: string, filters: { studentId?: string; status?: string } = {}) {
    return this.prisma.leaveRequest.findMany({
      where: {
        tenantId,
        ...(filters.studentId && { studentId: filters.studentId }),
        ...(filters.status    && { status:    filters.status as any }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(tenantId: string, id: string) {
    const leave = await this.prisma.leaveRequest.findFirst({
      where: { id, tenantId },
    });
    if (!leave) throw new NotFoundException(`Leave request not found: ${id}`);
    return leave;
  }

  async approve(tenantId: string, id: string, actorId: string) {
    const leave = await this.findById(tenantId, id);
    if (leave.status !== 'PENDING') {
      throw new BadRequestException(`Leave is already ${leave.status}.`);
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data:  { status: 'APPROVED', approvedBy: actorId },
    });

    // Build list of dates to mark as LEAVE
    const dates: Date[] = [];
    const current = new Date(leave.fromDate);
    const end     = new Date(leave.toDate);
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    const student = await this.prisma.student.findFirst({ where: { id: leave.studentId } });

    if (student?.academicYear) {
      await Promise.all(
        dates.map(date =>
          this.prisma.attendance.upsert({
            where: {
              tenantId_studentId_date_period: {
                tenantId,
                studentId: leave.studentId,
                date,
                period:    0,
              },
            },
            create: {
              tenantId,
              studentId: leave.studentId,
              sessionId: student.academicYear,
              date,
              status:   'ON_LEAVE' as any,
              period:   null,
              remarks:  `Leave approved: ${leave.reason}`,
              markedBy: actorId,
            },
            update: {
              status:   'ON_LEAVE' as any,
              remarks:  `Leave approved: ${leave.reason}`,
              markedBy: actorId,
            },
          }),
        ),
      );
    }

    await this.audit.logUpdate({
      tenantId, actorId,
      entityType: 'LeaveRequest', entityId: id,
      before: { status: 'PENDING' }, after: { status: 'APPROVED' },
    });

    this.logger.log(`Leave approved: ${id} | ${dates.length} days auto-marked as LEAVE`);
    return updated;
  }

  async reject(tenantId: string, id: string, actorId: string) {
    const leave = await this.findById(tenantId, id);
    if (leave.status !== 'PENDING') {
      throw new BadRequestException(`Leave is already ${leave.status}.`);
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data:  { status: 'REJECTED', approvedBy: actorId },
    });

    await this.audit.logUpdate({
      tenantId, actorId,
      entityType: 'LeaveRequest', entityId: id,
      before: { status: 'PENDING' }, after: { status: 'REJECTED' },
    });

    return updated;
  }

  async getPending(tenantId: string) {
    return this.prisma.leaveRequest.findMany({
      where:   { tenantId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });
  }
}
