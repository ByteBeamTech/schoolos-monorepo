import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EVENTS }        from '../../../core/events/events.constants';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService }  from '../../../core/compliance/audit.service';
import {
  BulkMarkAttendanceDto,
  MarkPeriodAttendanceDto,
  UpdateAttendanceDto,
} from '../dto/attendance.dto';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly prisma:   PrismaService,
    private readonly audit:    AuditService,
    private readonly emitter:  EventEmitter2,
  ) {}

  async bulkMarkDaily(tenantId: string, dto: BulkMarkAttendanceDto, actorId: string) {
    const date = new Date(dto.date);
    date.setUTCHours(0, 0, 0, 0);

    const section = await this.prisma.section.findFirst({ where: { id: dto.sectionId, tenantId } });
    if (!section) throw new NotFoundException(`Section not found: ${dto.sectionId}`);

    // BUG 2 FIX: upsert WHERE period must be null (not 0) to match the unique
    // constraint @@unique([tenantId, studentId, date, period]) and the create
    // data which also stores null. period: 0 caused a mismatch — Prisma treated
    // it as a different key, so upsert always inserted → unique constraint error.
    const results = await Promise.all(
      dto.attendance.map(entry =>
        this.prisma.attendance.upsert({
          where: {
            tenantId_studentId_date_period: {
              tenantId,
              studentId: entry.studentId,
              date,
              period:    null,   // ✅ was: 0 — must match create.period below
            },
          },
          create: {
            tenantId,
            studentId: entry.studentId,
            sessionId: dto.sessionId,
            date,
            status:    entry.status as any,
            period:    null,
            remarks:   entry.remarks ?? null,
            markedBy:  actorId,
          },
          update: {
            status:   entry.status as any,
            remarks:  entry.remarks ?? null,
            markedBy: actorId,
          },
        }),
      ),
    );

    await this.audit.log({
      tenantId, actorId,
      action:     'CREATE' as any,
      entityType: 'Attendance',
      entityId:   dto.sectionId,
      after:      { date: dto.date, sectionId: dto.sectionId, count: results.length },
    });

    this.logger.log(`Daily attendance: ${results.length} students | section: ${dto.sectionId} | ${dto.date}`);

    const present          = dto.attendance.filter(a => a.status === 'PRESENT').length;
    const absent           = dto.attendance.filter(a => a.status === 'ABSENT').length;
    const late             = dto.attendance.filter(a => a.status === 'LATE').length;
    const total            = results.length;
    const percentage       = total > 0 ? Math.round((present + late * 0.5) / total * 100) : 0;
    const absentStudentIds = dto.attendance.filter(a => a.status === 'ABSENT').map(a => a.studentId);

    // Emit ATTENDANCE_MARKED — drives absent SMS alerts to guardians via EventListenerService
    this.emitter.emit(EVENTS.ATTENDANCE_MARKED, {
      tenantId,
      sectionId:        dto.sectionId,
      date:             dto.date,
      present,
      absent,
      percentage,
      absentStudentIds,
    });

    // Emit ATTENDANCE_LOW when section drops below 75% — creates FraudAlert
    if (total >= 5 && percentage < 75) {
      this.emitter.emit(EVENTS.ATTENDANCE_LOW, {
        tenantId,
        sectionId:  dto.sectionId,
        date:       dto.date,
        percentage,
      });
    }

    return {
      date:      dto.date,
      sectionId: dto.sectionId,
      marked:    total,
      present,
      absent,
      late,
    };
  }

  async markPeriodWise(tenantId: string, dto: MarkPeriodAttendanceDto, actorId: string) {
    const date = new Date(dto.date);
    date.setUTCHours(0, 0, 0, 0);

    if (dto.period < 1 || dto.period > 8) {
      throw new BadRequestException('Period must be between 1 and 8.');
    }

    const results = await Promise.all(
      dto.attendance.map(entry =>
        this.prisma.attendance.upsert({
          where: {
            tenantId_studentId_date_period: {
              tenantId,
              studentId: entry.studentId,
              date,
              period:    dto.period,
            },
          },
          create: {
            tenantId,
            studentId: entry.studentId,
            sessionId: dto.sessionId,
            date,
            status:    entry.status as any,
            period:    dto.period,
            remarks:   entry.remarks ?? null,
            markedBy:  actorId,
          },
          update: {
            status:   entry.status as any,
            remarks:  entry.remarks ?? null,
            markedBy: actorId,
          },
        }),
      ),
    );

    this.logger.log(`Period ${dto.period} attendance: ${results.length} students | section: ${dto.sectionId}`);
    return { date: dto.date, period: dto.period, sectionId: dto.sectionId, marked: results.length };
  }

  async getSectionAttendance(tenantId: string, sectionId: string, date: string, period?: number) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);

    const records = await this.prisma.attendance.findMany({
      where: {
        tenantId,
        date:   d,
        period: period ?? null,
        student: { sectionId },
      },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, admissionNumber: true, rollNumber: true },
        },
      },
      orderBy: { student: { rollNumber: 'asc' } },
    });

    const summary = {
      total:   records.length,
      present: records.filter((r: any) => r.status === 'PRESENT').length,
      absent:  records.filter((r: any) => r.status === 'ABSENT').length,
      late:    records.filter((r: any) => r.status === 'LATE').length,
      leave:   records.filter((r: any) => r.status === 'ON_LEAVE').length,
    };

    return { date, sectionId, period: period ?? 'daily', summary, records };
  }

  async getStudentAttendance(tenantId: string, studentId: string, fromDate: string, toDate: string) {
    const from = new Date(fromDate);
    const to   = new Date(toDate);
    from.setUTCHours(0, 0, 0, 0);
    to.setUTCHours(23, 59, 59, 999);

    const records = await this.prisma.attendance.findMany({
      where: { tenantId, studentId, date: { gte: from, lte: to }, period: null },
      orderBy: { date: 'asc' },
    });

    const total   = records.length;
    const present = records.filter((r: any) => r.status === 'PRESENT').length;
    const absent  = records.filter((r: any) => r.status === 'ABSENT').length;
    const late    = records.filter((r: any) => r.status === 'LATE').length;
    const leave   = records.filter((r: any) => r.status === 'ON_LEAVE').length;
    const percentage = total > 0 ? Math.round((present + late * 0.5) / total * 100) : 0;

    return { studentId, fromDate, toDate, summary: { total, present, absent, late, leave, percentage }, records };
  }

  async updateAttendance(tenantId: string, id: string, dto: UpdateAttendanceDto, actorId: string) {
    const record = await this.prisma.attendance.findFirst({ where: { id, tenantId } });
    if (!record) throw new NotFoundException(`Attendance record not found: ${id}`);

    const updated = await this.prisma.attendance.update({
      where: { id },
      data: {
        status:   dto.status as any,
        remarks:  dto.remarks ?? null,
        markedBy: actorId,
      },
    });

    await this.audit.logUpdate({
      tenantId, actorId,
      entityType: 'Attendance', entityId: id,
      before: { status: record.status }, after: { status: dto.status },
    });

    return updated;
  }

  async getMonthlyReport(tenantId: string, sectionId: string, year: number, month: number) {
    const from = new Date(year, month - 1, 1);
    const to   = new Date(year, month, 0, 23, 59, 59);

    const students = await this.prisma.student.findMany({
      where:   { tenantId, sectionId, isActive: true },
      select:  { id: true, firstName: true, lastName: true, admissionNumber: true, rollNumber: true },
      orderBy: { rollNumber: 'asc' },
    });

    const records = await this.prisma.attendance.findMany({
      where: { tenantId, date: { gte: from, lte: to }, period: null, student: { sectionId } },
    });

    const report = students.map((student: any) => {
      const sr      = records.filter((r: any) => r.studentId === student.id);
      const present = sr.filter((r: any) => r.status === 'PRESENT').length;
      const absent  = sr.filter((r: any) => r.status === 'ABSENT').length;
      const late    = sr.filter((r: any) => r.status === 'LATE').length;
      const leave   = sr.filter((r: any) => r.status === 'ON_LEAVE').length;
      const total   = sr.length;
      const pct     = total > 0 ? Math.round((present + late * 0.5) / total * 100) : 0;
      return { student, present, absent, late, leave, total, percentage: pct, lowAttendance: pct < 75 };
    });

    const workingDays = [...new Set(records.map((r: any) => r.date.toISOString().split('T')[0]))].length;
    return { sectionId, year, month, workingDays, totalStudents: students.length, lowAttendanceCount: report.filter((r: any) => r.lowAttendance).length, report };
  }

  async getAbsentees(tenantId: string, date: string, sectionId?: string) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);

    return this.prisma.attendance.findMany({
      where: {
        tenantId,
        date:   d,
        status: 'ABSENT' as any,
        period: null,
        ...(sectionId && { student: { sectionId } }),
      },
      include: {
        student: {
          select: {
            id: true, firstName: true, lastName: true,
            admissionNumber: true, rollNumber: true, sectionId: true,
            guardianLinks: {
              where:   { isPrimary: true },
              include: { guardian: { select: { firstName: true, phone: true } } },
              take:    1,
            },
          },
        },
      },
      orderBy: { student: { lastName: 'asc' } },
    });
  }

  async getDashboardStats(tenantId: string, date: string) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);

    const [total, present, absent, late] = await Promise.all([
      this.prisma.attendance.count({ where: { tenantId, date: d, period: null } }),
      this.prisma.attendance.count({ where: { tenantId, date: d, period: null, status: 'PRESENT' as any } }),
      this.prisma.attendance.count({ where: { tenantId, date: d, period: null, status: 'ABSENT'  as any } }),
      this.prisma.attendance.count({ where: { tenantId, date: d, period: null, status: 'LATE'    as any } }),
    ]);

    return {
      date, total, present, absent, late,
      percentage: total > 0 ? Math.round((present + late * 0.5) / total * 100) : 0,
    };
  }
}
