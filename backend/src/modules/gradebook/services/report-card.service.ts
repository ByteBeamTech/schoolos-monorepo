// ─────────────────────────────────────────────────────────────────────────────
// FILE: backend/src/modules/gradebook/services/report-card.service.ts
// Add this service to the gradebook module.
// Wire in gradebook.module.ts: add ReportCardService to providers[].
// ─────────────────────────────────────────────────────────────────────────────
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EVENTS }        from '../../../core/events/events.constants';

export interface ReportCardResult {
  studentId:            string;
  studentName:          string;
  admissionNo:          string;
  rollNumber:           string | null;
  className:            string;
  section:              string;
  examName:             string;
  sessionName:          string;
  subjects: Array<{
    name:         string;
    maxMarks:     number;
    passMarks:    number;
    obtained:     number | null;
    isAbsent:     boolean;
    grade:        string;
  }>;
  totalMax:             number;
  totalObtained:        number;
  percentage:           number;
  grade:                string;
  rank:                 number;
  totalStudents:        number;
  passed:               boolean;
  attendancePercentage?: number;
}

@Injectable()
export class ReportCardService {
  constructor(
    private readonly prisma:   PrismaService,
    private readonly emitter:  EventEmitter2,
  ) {}

  // ── Apply grade from boundaries, fallback to built-in scale ──────────────
  private applyGrade(pct: number, boundaries: any[]): string {
    if (boundaries.length > 0) {
      for (const b of boundaries) {
        if (pct >= Number(b.minMark) && pct <= Number(b.maxMark)) return b.grade;
      }
      return 'F';
    }
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B+';
    if (pct >= 60) return 'B';
    if (pct >= 50) return 'C';
    if (pct >= 40) return 'D';
    return 'F';
  }

  // ── Single student report card ────────────────────────────────────────────
  async getStudentReportCard(
    tenantId:  string,
    examId:    string,
    studentId: string,
    sessionId: string,
  ): Promise<ReportCardResult> {
    // Fetch exam + schedules + subject names
    const exam = await this.prisma.exam.findFirst({
      where:   { id: examId, tenantId },
      include: {
        schedules: {
          include: { subject: true } as any,
        },
        session: true,
      } as any,
    });
    if (!exam) throw new NotFoundException(`Exam ${examId} not found`);

    // Fetch student with section/class
    const student = await this.prisma.student.findFirst({
      where:   { id: studentId, tenantId },
      include: { section: { include: { class: true } as any } } as any,
    });
    if (!student) throw new NotFoundException(`Student ${studentId} not found`);

    // Fetch marks for this student in this exam
    const marks = await this.prisma.mark.findMany({
      where: { tenantId, examId, studentId },
    });

    // Fetch grade boundaries
    const boundaries = await this.prisma.gradeBoundary.findMany({
      where:   { tenantId, sessionId },
      orderBy: { minMark: 'desc' },
    });

    // Build subject results
    const schedules = (exam as any).schedules as any[];
    const subjects = schedules
      .filter(sch => sch.classId === (student as any).section?.class?.id || !sch.classId)
      .map(sch => {
        const mark     = marks.find((m: any) => m.scheduleId === sch.id);
        const obtained = mark && !mark.isAbsent ? Number(mark.marksObtained ?? 0) : null;
        const subPct   = obtained !== null ? (obtained / Number(sch.maxMarks)) * 100 : 0;
        return {
          name:      (sch as any).subject?.name ?? sch.subjectId,
          maxMarks:  Number(sch.maxMarks),
          passMarks: Number(sch.passMarks),
          obtained,
          isAbsent:  mark?.isAbsent ?? false,
          grade:     obtained !== null ? this.applyGrade(subPct, boundaries) : 'AB',
        };
      });

    // Totals
    const totalMax      = subjects.reduce((s, sub) => s + sub.maxMarks,             0);
    const totalObtained = subjects.reduce((s, sub) => s + (sub.obtained ?? 0),      0);
    const percentage    = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100 * 10) / 10 : 0;
    const grade         = this.applyGrade(percentage, boundaries);
    const passed        = subjects.every(
      sub => sub.isAbsent || (sub.obtained !== null && sub.obtained >= sub.passMarks)
    );

    // Attendance % for the session
    let attendancePercentage: number | undefined;
    try {
      const [presentCount, totalCount] = await Promise.all([
        this.prisma.attendance.count({
          where: { tenantId, studentId, sessionId, status: 'PRESENT' },
        }),
        this.prisma.attendance.count({
          where: { tenantId, studentId, sessionId },
        }),
      ]);
      attendancePercentage = totalCount > 0
        ? Math.round((presentCount / totalCount) * 100)
        : undefined;
    } catch {
      // attendance is optional — swallow
    }

    // Rank: fetch all other student percentages for same exam + class to compute rank
    const classScheduleIds = schedules.map((s: any) => s.id);
    const allMarks = await this.prisma.mark.findMany({
      where:  { tenantId, examId, scheduleId: { in: classScheduleIds } },
      select: { studentId: true, marksObtained: true, isAbsent: true },
    });

    // Group by student and compute their totals
    const byStudent = new Map<string, number>();
    for (const m of allMarks) {
      if (!m.isAbsent && m.marksObtained !== null) {
        byStudent.set(m.studentId, (byStudent.get(m.studentId) ?? 0) + Number(m.marksObtained));
      }
    }
    const sorted = Array.from(byStudent.values()).sort((a, b) => b - a);
    const rank   = sorted.findIndex(v => v <= totalObtained) + 1;

    const result: ReportCardResult = {
      studentId,
      studentName:  `${(student as any).firstName} ${(student as any).lastName}`,
      admissionNo:  (student as any).admissionNumber,
      rollNumber:   (student as any).rollNumber ?? null,
      className:    (student as any).section?.class?.name ?? '—',
      section:      (student as any).section?.name ?? '—',
      examName:     (exam as any).name,
      sessionName:  (exam as any).session?.name ?? sessionId,
      subjects,
      totalMax,
      totalObtained,
      percentage,
      grade,
      rank:          rank > 0 ? rank : sorted.length + 1,
      totalStudents: byStudent.size || 1,
      passed,
      attendancePercentage,
    };

    // Emit event
    this.emitter.emit(EVENTS.STUDENT_REPORT_CARD_GENERATED ?? 'student.report_card_generated', {
      tenantId,
      studentId,
      examId,
      grade,
      percentage,
    });

    return result;
  }

  // ── All students in a class ───────────────────────────────────────────────
  async getClassReportCards(
    tenantId:  string,
    examId:    string,
    classId:   string,
    sessionId: string,
  ): Promise<ReportCardResult[]> {
    // Find all students in the class sections
    const sections = await this.prisma.section.findMany({
      where:   { class: { id: classId, tenantId } } as any,
      include: { students: { select: { id: true } } } as any,
    });

    const studentIds = sections.flatMap((sec: any) =>
      (sec.students ?? []).map((s: any) => s.id)
    );

    if (studentIds.length === 0) return [];

    const results = await Promise.allSettled(
      studentIds.map((sid: string) =>
        this.getStudentReportCard(tenantId, examId, sid, sessionId)
      )
    );

    return results
      .filter((r): r is PromiseFulfilledResult<ReportCardResult> => r.status === 'fulfilled')
      .map(r => r.value)
      .sort((a, b) => a.rank - b.rank);
  }
}
