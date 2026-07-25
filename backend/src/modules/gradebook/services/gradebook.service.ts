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
        where:   { exam: { tenantId }, classId },
        include: { subject: true } as any,
      }),
      this.prisma.gradeBoundary.findMany({ where: { tenantId, sessionId }, orderBy: { minMark: 'desc' } }),
    ]);

    const scheduleIds = schedules.map((s: any) => s.id);
    const marks       = await this.prisma.mark.findMany({
      where:   { scheduleId: { in: scheduleIds } },
      include: { student: true } as any,
    });

    // Group by student
    const studentMap: Record<string, any> = {};
    for (const m of marks) {
      const sid = m.studentId;
      if (!studentMap[sid]) {
        studentMap[sid] = {
          studentId:     sid,
          studentName:   `${(m as any).student?.firstName} ${(m as any).student?.lastName}`,
          admissionNo:   (m as any).student?.admissionNumber,
          rollNumber:    (m as any).student?.rollNumber,
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
        studentMap[sid].subjects[(sch as any)?.subject?.name ?? m.scheduleId] = {
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
