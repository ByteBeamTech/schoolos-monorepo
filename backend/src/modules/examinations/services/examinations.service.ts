import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import {
  CreateExamDto, UpdateExamDto,
  CreateExamScheduleDto, BulkMarkEntryDto,
} from '../dto/examinations.dto';

@Injectable()
export class ExaminationsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Exams ─────────────────────────────────────────────────────────────────

  async createExam(tenantId: string, dto: CreateExamDto) {
    return this.prisma.exam.create({
      data: {
        tenantId,
        sessionId:   dto.sessionId,
        name:        dto.name,
        type:        dto.type as any,
        startDate:   new Date(dto.startDate),
        endDate:     new Date(dto.endDate),
        isPublished: false,
      },
    });
  }

  async listExams(tenantId: string, sessionId: string) {
    return this.prisma.exam.findMany({
      where:   { tenantId, sessionId },
      include: { _count: { select: { schedules: true, marks: true } } },
      orderBy: { startDate: 'desc' },
    });
  }

  async getExam(tenantId: string, id: string) {
    const exam = await this.prisma.exam.findFirst({
      where:   { id, tenantId },
      include: { schedules: { orderBy: { date: 'asc' } } },
    });
    if (!exam) throw new NotFoundException(`Exam ${id} not found`);
    return exam;
  }

  async updateExam(tenantId: string, id: string, dto: UpdateExamDto) {
    const exam = await this.prisma.exam.findFirst({ where: { id, tenantId } });
    if (!exam) throw new NotFoundException(`Exam ${id} not found`);
    return this.prisma.exam.update({
      where: { id },
      data: {
        ...(dto.name        !== undefined && { name:        dto.name }),
        ...(dto.startDate   !== undefined && { startDate:   new Date(dto.startDate) }),
        ...(dto.endDate     !== undefined && { endDate:     new Date(dto.endDate) }),
        ...(dto.isPublished !== undefined && { isPublished: dto.isPublished }),
      },
    });
  }

  async publishExam(tenantId: string, id: string) {
    return this.updateExam(tenantId, id, { isPublished: true });
  }

  // ── Schedules ─────────────────────────────────────────────────────────────

  async createSchedule(tenantId: string, examId: string, dto: CreateExamScheduleDto) {
    const exam = await this.prisma.exam.findFirst({ where: { id: examId, tenantId } });
    if (!exam) throw new NotFoundException(`Exam ${examId} not found`);

    const conflict = await this.prisma.examSchedule.findFirst({
      where: { examId, classId: dto.classId, subjectId: dto.subjectId },
    });
    if (conflict) throw new ConflictException('Schedule already exists for this class+subject');

    return this.prisma.examSchedule.create({
      data: {
        examId,
        classId:   dto.classId,
        subjectId: dto.subjectId,
        date:      new Date(dto.date),
        startTime: dto.startTime,
        endTime:   dto.endTime,
        maxMarks:  dto.maxMarks,
        passMarks: dto.passMarks,
        hallId:    dto.hallId ?? null,
      },
    });
  }

  // ── Marks ─────────────────────────────────────────────────────────────────

  async bulkEnterMarks(tenantId: string, dto: BulkMarkEntryDto, actorId: string) {
    const exam = await this.prisma.exam.findFirst({ where: { id: dto.examId, tenantId } });
    if (!exam) throw new NotFoundException(`Exam ${dto.examId} not found`);

    const results = await Promise.all(
      dto.marks.map(m =>
        this.prisma.mark.upsert({
          where: {
            examId_studentId_scheduleId: {
              examId:     dto.examId,
              studentId:  m.studentId,
              scheduleId: m.scheduleId,
            },
          },
          create: {
            tenantId,
            examId:        dto.examId,
            studentId:     m.studentId,
            scheduleId:    m.scheduleId,
            marksObtained: m.marksObtained ?? null,
            isAbsent:      m.isAbsent ?? false,
            remarks:       m.remarks ?? null,
            enteredBy:     actorId,
          },
          update: {
            marksObtained: m.marksObtained ?? null,
            isAbsent:      m.isAbsent ?? false,
            remarks:       m.remarks ?? null,
            enteredBy:     actorId,
          },
        })
      )
    );

    return { examId: dto.examId, entered: results.length };
  }

  async getStudentResult(tenantId: string, examId: string, studentId: string) {
    const exam = await this.prisma.exam.findFirst({
      where:   { id: examId, tenantId },
      include: { schedules: true },
    });
    if (!exam) throw new NotFoundException(`Exam ${examId} not found`);

    const marks = await this.prisma.mark.findMany({
      where:   { tenantId, examId, studentId },
      include: { schedule: true },
    });

    const totalMax      = exam.schedules.reduce((s: number, sc: any) => s + Number(sc.maxMarks), 0);
    const totalObtained = marks.filter((m: any) => !m.isAbsent).reduce((s: number, m: any) => s + Number(m.marksObtained ?? 0), 0);
    const percentage    = totalMax > 0 ? Math.round(totalObtained / totalMax * 100) : 0;
    const passed        = marks.every((m: any) => m.isAbsent || Number(m.marksObtained ?? 0) >= Number(m.schedule.passMarks));
    const grade         = percentage >= 90 ? 'A+' : percentage >= 80 ? 'A' : percentage >= 70 ? 'B+' :
                          percentage >= 60 ? 'B'  : percentage >= 50 ? 'C' : percentage >= 40 ? 'D' : 'F';

    return { examId, studentId, totalMax, totalObtained, percentage, grade, passed, marks };
  }

  async getClassResults(tenantId: string, examId: string, classId: string) {
    const schedules    = await this.prisma.examSchedule.findMany({ where: { examId, classId } });
    const scheduleIds  = schedules.map((s: any) => s.id);

    // Get marks without student relation (Mark model doesn't have it)
    const marks = await this.prisma.mark.findMany({
      where:   { tenantId, examId, scheduleId: { in: scheduleIds } },
      include: { schedule: { select: { maxMarks: true, passMarks: true, subjectId: true } } },
    });

    // Fetch students separately
    const studentIds = [...new Set(marks.map((m: any) => m.studentId))];
    const students   = await this.prisma.student.findMany({
      where:  { id: { in: studentIds } },
      select: { id: true, firstName: true, lastName: true, admissionNumber: true, rollNumber: true },
    });
    const studentMap = new Map(students.map((s: any) => [s.id, s]));

    // Group marks by student
    const byStudent = new Map<string, typeof marks>();
    for (const m of marks) {
      const arr = byStudent.get(m.studentId) ?? [];
      arr.push(m);
      byStudent.set(m.studentId, arr);
    }

    const totalMax = schedules.reduce((s: number, sc: any) => s + Number(sc.maxMarks), 0);

    const results = Array.from(byStudent.entries()).map(([studentId, sm]) => {
      const obtained   = sm.filter((m: any) => !m.isAbsent).reduce((s: number, m: any) => s + Number(m.marksObtained ?? 0), 0);
      const percentage = totalMax > 0 ? Math.round(obtained / totalMax * 100) : 0;
      const grade      = percentage >= 90 ? 'A+' : percentage >= 80 ? 'A' : percentage >= 70 ? 'B+' :
                         percentage >= 60 ? 'B'  : percentage >= 50 ? 'C' : percentage >= 40 ? 'D' : 'F';
      return { studentId, student: studentMap.get(studentId), obtained, totalMax, percentage, grade };
    });

    results.sort((a, b) => b.percentage - a.percentage);
    return { examId, classId, totalMax, toppers: results.slice(0, 3), results };
  }

  async getExamStats(tenantId: string, sessionId: string) {
    const [total, published, upcoming] = await Promise.all([
      this.prisma.exam.count({ where: { tenantId, sessionId } }),
      this.prisma.exam.count({ where: { tenantId, sessionId, isPublished: true } }),
      this.prisma.exam.count({ where: { tenantId, sessionId, startDate: { gte: new Date() } } }),
    ]);
    return { total, published, upcoming, completed: total - upcoming };
  }
}
