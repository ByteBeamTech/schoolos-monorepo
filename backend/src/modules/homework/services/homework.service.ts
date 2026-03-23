import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infra/database/prisma.service';
import { CreateHomeworkDto } from '../dto/homework.dto';

@Injectable()
export class HomeworkService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, filters: { classId?: string; subjectId?: string; teacherId?: string } = {}) {
    const where: any = { tenantId, isActive: true };
    if (filters.classId)   where.classId   = filters.classId;
    if (filters.subjectId) where.subjectId = filters.subjectId;
    if (filters.teacherId) where.teacherId = filters.teacherId;

    return this.prisma.homework.findMany({
      where,
      include: {
        _count: { select: { submissions: true } },
      },
      orderBy: { dueDate: 'desc' },
      take:    100,
    });
  }

  async create(tenantId: string, dto: CreateHomeworkDto, teacherId: string) {
    return this.prisma.homework.create({
      data: {
        tenantId,
        sessionId:   dto.sessionId,
        classId:     dto.classId,
        sectionId:   dto.sectionId   ?? null,
        subjectId:   dto.subjectId,
        teacherId,
        title:       dto.title,
        dueDate:     new Date(dto.dueDate),
        description: dto.description ?? null,
        maxMarks:    dto.maxMarks    ?? null,
      },
    });
  }

  async getSubmissions(tenantId: string, homeworkId: string) {
    const hw = await this.prisma.homework.findFirst({ where: { id: homeworkId, tenantId } });
    if (!hw) throw new NotFoundException('Homework not found');

    return this.prisma.homeworkSubmission.findMany({
      where:   { homeworkId, tenantId },
      include: { student: { select: { firstName: true, lastName: true, admissionNumber: true } } } as any,
      orderBy: { submittedAt: 'desc' },
    });
  }

  async markSubmitted(tenantId: string, homeworkId: string, studentId: string) {
    const hw = await this.prisma.homework.findFirst({ where: { id: homeworkId, tenantId } });
    if (!hw) throw new NotFoundException('Homework not found');
    const isLate = new Date() > new Date(hw.dueDate);

    return this.prisma.homeworkSubmission.upsert({
      where:  { homeworkId_studentId: { homeworkId, studentId } },
      create: { tenantId, homeworkId, studentId, submittedAt: new Date(), status: isLate ? 'LATE' : 'SUBMITTED' },
      update: { submittedAt: new Date(), status: isLate ? 'LATE' : 'SUBMITTED' },
    });
  }

  async gradeSubmission(tenantId: string, homeworkId: string, studentId: string, marks: number, remarks?: string) {
    return this.prisma.homeworkSubmission.upsert({
      where:  { homeworkId_studentId: { homeworkId, studentId } },
      create: { tenantId, homeworkId, studentId, marksGiven: marks, remarks: remarks ?? null, status: 'GRADED' },
      update: { marksGiven: marks, remarks: remarks ?? null, status: 'GRADED' },
    });
  }

  async stats(tenantId: string) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const [total, due, submitted] = await Promise.all([
      this.prisma.homework.count({ where: { tenantId, isActive: true } }),
      this.prisma.homework.count({ where: { tenantId, isActive: true, dueDate: { gte: today } } }),
      this.prisma.homeworkSubmission.count({ where: { tenantId, status: { in: ['SUBMITTED', 'GRADED', 'LATE'] } } }),
    ]);
    return { total, dueSoon: due, submitted };
  }
}
