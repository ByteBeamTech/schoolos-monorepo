import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { CreateGradeBoundaryDto } from '../dto/gradebook.dto';
import { computeGrade } from './grading.util';

@Injectable()
export class GradebookService {
  constructor(private readonly prisma: PrismaService) {}

  async getBoundaries(tenantId: string, sessionId: string) {
    return this.prisma.gradeBoundary.findMany({
      where:   { tenantId, sessionId },
      orderBy: { minMark: 'desc' },
    });
  }

  async createBoundary(tenantId: string, dto: CreateGradeBoundaryDto) {
    return this.prisma.gradeBoundary.create({
      data: { tenantId, ...dto },
    });
  }

  async deleteBoundary(tenantId: string, id: string) {
    const b = await this.prisma.gradeBoundary.findFirst({ where: { id, tenantId } });
    if (!b) throw new NotFoundException('Grade boundary not found');
    await this.prisma.gradeBoundary.delete({ where: { id } });
    return { deleted: true };
  }

  async getClassResults(tenantId: string, examId: string, classId: string, sessionId: string) {
    const [schedules, boundaries] = await Promise.all([
      this.prisma.examSchedule.findMany({
        where: { exam: { tenantId }, classId },
      }),
      this.prisma.gradeBoundary.findMany({ where: { tenantId, sessionId }, orderBy: { minMark: 'desc' } }),
    ]);

    // ExamSchedule has no `subject` relation (subjectId is a plain scalar
    // column) -- fetch subjects separately and join in memory, matching the
    // pattern already used in ExaminationsService.getClassResults.
    const subjectIds  = [...new Set(schedules.map((s: any) => s.subjectId))];
    const subjectRows = await this.prisma.subject.findMany({
      where:  { id: { in: subjectIds } },
      select: { id: true, name: true },
    });
    const subjectById = new Map(subjectRows.map((s: any) => [s.id, s]));

    const scheduleIds = schedules.map((s: any) => s.id);
    // Mark has no `student` relation (studentId is a plain scalar column) --
    // fetch students separately and join in memory, matching the pattern
    // already used in ExaminationsService.getClassResults.
    const marks = await this.prisma.mark.findMany({
      where: { scheduleId: { in: scheduleIds } },
    });
    const studentIds  = [...new Set(marks.map((m: any) => m.studentId))];
    const studentRows = await this.prisma.student.findMany({
      where:  { id: { in: studentIds } },
      select: { id: true, firstName: true, lastName: true, admissionNumber: true, rollNumber: true },
    });
    const studentById = new Map(studentRows.map((s: any) => [s.id, s]));

    // Group by student
    const studentMap: Record<string, any> = {};
    for (const m of marks) {
      const sid = m.studentId;
      if (!studentMap[sid]) {
        const student = studentById.get(sid) as any;
        studentMap[sid] = {
          studentId:     sid,
          studentName:   `${student?.firstName} ${student?.lastName}`,
          admissionNo:   student?.admissionNumber,
          rollNumber:    student?.rollNumber,
          subjects:      {},
          totalMarks:    0,
          totalMax:      0,
          percentage:    0,
          grade:         'N/A',
          rank:          0,
        };
      }
      if (!m.isAbsent && m.marksObtained !== null) {
        const sch = schedules.find((s: any) => s.id === m.scheduleId) as any;
        const subjectName = (subjectById.get(sch?.subjectId) as any)?.name ?? m.scheduleId;
        studentMap[sid].subjects[subjectName] = {
          obtained: Number(m.marksObtained),
          max:      sch?.maxMarks ?? 100,
          grade:    computeGrade(Number(m.marksObtained) / (Number((sch as any)?.maxMarks) || 100) * 100, boundaries),
        };
        studentMap[sid].totalMarks += Number(m.marksObtained);
        studentMap[sid].totalMax   += (Number((sch as any)?.maxMarks) || 100);
      }
    }

    // Calculate % and grade
    const results = Object.values(studentMap).map((s: any) => {
      s.percentage = s.totalMax > 0 ? Math.round(s.totalMarks / s.totalMax * 100 * 100) / 100 : 0;
      s.grade      = computeGrade(s.percentage, boundaries);
      return s;
    });

    // Assign ranks
    results.sort((a, b) => b.percentage - a.percentage);
    results.forEach((r, i) => { r.rank = i + 1; });

    return {
      examId, classId, sessionId,
      totalStudents: results.length,
      topper:        results[0] ?? null,
      results,
    };
  }
}
