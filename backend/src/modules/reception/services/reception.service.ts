import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infra/database/prisma.service';
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

@Injectable()
export class ReceptionService {
  private readonly logger = new Logger(ReceptionService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ========== COMPLAINTS ==========

  private async generateTicketNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.complaint.count({
      where: {
        // @ts-ignore
          tenantId,
        ticketNumber: { startsWith: `CMPL-${year}` },
      },
    });
    return `CMPL-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  async createComplaint(tenantId: string, dto: CreateComplaintDto, createdBy: string) {
    const ticketNumber = await this.generateTicketNumber(tenantId);

    const complaint = await this.prisma.complaint.create({
      data: ({
        // @ts-ignore
          tenantId,
        ticketNumber,
        complainantName: dto.complainantName,
        complainantPhone: dto.complainantPhone,
        complainantEmail: dto.complainantEmail,
        complainantType: dto.complainantType as any,
        relatedStudentId: dto.relatedStudentId,
        relatedStaffId: dto.relatedStaffId,
        category: dto.category as any,
        subject: dto.subject,
        description: dto.description,
        priority: (dto.priority as any) || 'MEDIUM',
        status: 'OPEN',
        createdBy,
      }) as any,
    });

    // Create activity log
    await this.prisma.complaintActivity.create({
      data: {
        complaintId: complaint.id,
        // @ts-ignore
          tenantId,
        actorId: createdBy,
        action: 'created',
        newValue: 'OPEN',
      },
    });

    this.logger.log(`Complaint created: ${ticketNumber}`);
    return complaint;
  }

  async getComplaints(tenantId: string, query: ComplaintQueryDto) {
    const where: any = { tenantId };
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.category) where.category = query.category;
    if (query.assignedTo) where.assignedTo = query.assignedTo;

    return this.prisma.complaint.findMany({
      where,
      include: { activities: { orderBy: { createdAt: 'desc' }, take: 5 } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getComplaintById(tenantId: string, id: string) {
    const complaint = await this.prisma.complaint.findFirst({
      where: { id, tenantId },
      include: { activities: { orderBy: { createdAt: 'desc' } } },
    });

    if (!complaint) throw new NotFoundException('Complaint not found');
    return complaint;
  }

  async updateComplaint(tenantId: string, id: string, dto: UpdateComplaintDto, actorId: string) {
    const complaint = await this.getComplaintById(// @ts-ignore
          tenantId, id);

    const updateData: any = {};
    const activities: any[] = [];

    if (dto.status && dto.status !== complaint.status) {
      updateData.status = dto.status;
      activities.push({
        complaintId: id,
        // @ts-ignore
          tenantId,
        actorId,
        action: 'status_changed',
        oldValue: complaint.status,
        newValue: dto.status,
      });
    }

    if (dto.assignedTo && dto.assignedTo !== complaint.assignedTo) {
      updateData.assignedTo = dto.assignedTo;
      activities.push({
        complaintId: id,
        // @ts-ignore
          tenantId,
        actorId,
        action: 'assigned',
        oldValue: complaint.assignedTo,
        newValue: dto.assignedTo,
      });
    }

    if (dto.priority && dto.priority !== complaint.priority) {
      updateData.priority = dto.priority;
      activities.push({
        complaintId: id,
        // @ts-ignore
          tenantId,
        actorId,
        action: 'priority_changed',
        oldValue: complaint.priority,
        newValue: dto.priority,
      });
    }

    if (Object.keys(updateData).length === 0) {
      return complaint;
    }

    await this.prisma.complaint.update({
      where: { id },
      data: updateData,
    });

    for (const activity of activities) {
      await this.prisma.complaintActivity.create({ data: activity as any });
    }

    return this.getComplaintById(// @ts-ignore
          tenantId, id);
  }

  async resolveComplaint(tenantId: string, id: string, dto: ResolveComplaintDto, actorId: string) {
    const complaint = await this.getComplaintById(// @ts-ignore
          tenantId, id);

    if (complaint.status === 'RESOLVED' || complaint.status === 'CLOSED') {
      throw new BadRequestException('Complaint already resolved/closed');
    }

    await this.prisma.complaint.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolution: dto.resolution,
        // @ts-ignore
        resolvedBy: actorId,
        resolvedAt: new Date(),
      },
    });

    await this.prisma.complaintActivity.create({
      data: {
        complaintId: id,
        // @ts-ignore
          tenantId,
        actorId,
        action: 'resolved',
        oldValue: complaint.status,
        newValue: 'RESOLVED',
        comment: dto.resolution,
      },
    });

    return this.getComplaintById(// @ts-ignore
          tenantId, id);
  }

  async addComment(tenantId: string, id: string, dto: AddCommentDto, actorId: string) {
    await this.getComplaintById(// @ts-ignore
          tenantId, id);

    await this.prisma.complaintActivity.create({
      data: {
        complaintId: id,
        // @ts-ignore
          tenantId,
        actorId,
        action: 'commented',
        comment: dto.comment,
      },
    });

    return this.getComplaintById(// @ts-ignore
          tenantId, id);
  }

  // ========== STAFF ATTENDANCE ==========

  async markStaffAttendance(tenantId: string, dto: MarkStaffAttendanceDto, markedBy: string) {
    return this.prisma.staffAttendance.upsert({
      where: {
        tenantId_staffId_date: {
          // @ts-ignore
          tenantId,
          staffId: dto.staffId,
          date: new Date(dto.date),
        },
      },
      create: {
        // @ts-ignore
          tenantId,
        staffId: dto.staffId,
        date: new Date(dto.date),
        status: dto.status as any,
        checkIn: dto.checkIn ? new Date(dto.checkIn) : null,
        checkOut: dto.checkOut ? new Date(dto.checkOut) : null,
        // @ts-ignore
        source: 'MANUAL',
        remarks: dto.remarks,
        // @ts-ignore
        markedBy,
      },
      update: {
        status: dto.status as any,
        checkIn: dto.checkIn ? new Date(dto.checkIn) : undefined,
        checkOut: dto.checkOut ? new Date(dto.checkOut) : undefined,
        remarks: dto.remarks,
        // @ts-ignore
        markedBy,
      },
    });
  }

  async bulkMarkStaffAttendance(tenantId: string, dto: BulkStaffAttendanceDto, markedBy: string) {
    const results = await Promise.all(
      dto.records.map((record) =>
        this.markStaffAttendance(// @ts-ignore
          tenantId, { ...record, date: dto.date }, markedBy).catch(
          (e) => ({ error: e.message, staffId: record.staffId }),
        ),
      ),
    );

    return {
      success: results.filter((r: any) => !('error' in r)).length,
      failed: results.filter((r: any) => 'error' in r),
    };
  }

  async getStaffAttendance(tenantId: string, query: StaffAttendanceQueryDto) {
    const where: any = { tenantId };
    if (query.staffId) where.staffId = query.staffId;
    if (query.fromDate || query.toDate) {
      where.date = {};
      if (query.fromDate) where.date.gte = new Date(query.fromDate);
      if (query.toDate) where.date.lte = new Date(query.toDate);
    }

    return this.prisma.staffAttendance.findMany({
      where,
      orderBy: { date: 'desc' },
    });
  }

  async getStaffAttendanceSummary(tenantId: string, month: number, year: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const attendance = await this.prisma.staffAttendance.findMany({
      where: {
        // @ts-ignore
          tenantId,
        date: { gte: startDate, lte: endDate },
      },
    });

    // Group by staffId
    const summary: Record<string, any> = {};
    for (const record of attendance) {
      if (!summary[record.staffId]) {
        summary[record.staffId] = { present: 0, absent: 0, late: 0, halfDay: 0, onLeave: 0 };
      }
      const status = record.status.toLowerCase().replace('_', '');
      if (status === 'present') summary[record.staffId].present++;
      else if (status === 'absent') summary[record.staffId].absent++;
      else if (status === 'late') summary[record.staffId].late++;
      else if (status === 'halfday') summary[record.staffId].halfDay++;
      else if (status === 'onleave') summary[record.staffId].onLeave++;
    }

    return summary;
  }

  // ========== VISITORS ==========

  private async generatePassNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.visitor.count({
      where: {
        // @ts-ignore
          tenantId,
        passNumber: { startsWith: `VIS-${year}` },
      },
    });
    return `VIS-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  async createVisitor(tenantId: string, dto: CreateVisitorDto, createdBy: string) {
    const passNumber = await this.generatePassNumber(tenantId);

    const visitor = await this.prisma.visitor.create({
      data: {
        // @ts-ignore
          tenantId,
        passNumber,
        visitorName: dto.visitorName,
        phone: dto.phone,
        email: dto.email,
        idType: dto.idType,
        idNumber: dto.idNumber,
        photoUrl: dto.photoUrl,
        company: dto.company,
        purpose: dto.purpose as any,
        personToMeet: dto.personToMeet,
        personToMeetId: dto.personToMeetId,
        department: dto.department,
        expectedDuration: dto.expectedDuration,
        vehicleNumber: dto.vehicleNumber,
        remarks: dto.remarks,
        status: 'CHECKED_IN',
        createdBy,
      },
    });

    this.logger.log(`Visitor checked in: ${passNumber} - ${dto.visitorName}`);
    return visitor;
  }

  async getVisitors(tenantId: string, query: VisitorQueryDto) {
    const where: any = { tenantId };
    if (query.status) where.status = query.status;
    if (query.personToMeetId) where.personToMeetId = query.personToMeetId;
    if (query.date) {
      const date = new Date(query.date);
      where.checkIn = {
        gte: new Date(date.setHours(0, 0, 0, 0)),
        lte: new Date(date.setHours(23, 59, 59, 999)),
      };
    }

    return this.prisma.visitor.findMany({
      where,
      orderBy: { checkIn: 'desc' },
    });
  }

  async getVisitorById(tenantId: string, id: string) {
    const visitor = await this.prisma.visitor.findFirst({
      where: { id, tenantId },
    });

    if (!visitor) throw new NotFoundException('Visitor not found');
    return visitor;
  }

  async checkOutVisitor(tenantId: string, id: string, dto: CheckOutVisitorDto) {
    const visitor = await this.getVisitorById(// @ts-ignore
          tenantId, id);

    if (visitor.status !== 'CHECKED_IN') {
      throw new BadRequestException('Visitor not currently checked in');
    }

    return this.prisma.visitor.update({
      where: { id },
      data: {
        status: 'CHECKED_OUT',
        checkOut: new Date(),
        remarks: dto.remarks || visitor.remarks,
      },
    });
  }

  async getVisitorPass(tenantId: string, id: string) {
    const visitor = await this.getVisitorById(// @ts-ignore
          tenantId, id);

    // Return pass data for printing
    return {
      passNumber: visitor.passNumber,
      visitorName: visitor.visitorName,
      phone: visitor.phone,
      company: visitor.company,
      purpose: visitor.purpose,
      personToMeet: visitor.personToMeet,
      department: visitor.department,
      checkIn: visitor.checkIn,
      vehicleNumber: visitor.vehicleNumber,
      photoUrl: visitor.photoUrl,
      // QR code data - encode pass number and visitor ID
      qrData: JSON.stringify({ id: visitor.id, pass: visitor.passNumber, tenant: tenantId }),
    };
  }

  async getTodayVisitorStats(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [checkedIn, checkedOut, total] = await Promise.all([
      this.prisma.visitor.count({
        where: { // @ts-ignore
          tenantId, status: 'CHECKED_IN', checkIn: { gte: today } },
      }),
      this.prisma.visitor.count({
        where: { // @ts-ignore
          tenantId, status: 'CHECKED_OUT', checkIn: { gte: today } },
      }),
      this.prisma.visitor.count({
        where: { // @ts-ignore
          tenantId, checkIn: { gte: today } },
      }),
    ]);

    return { checkedIn, checkedOut, total };
  }
}
