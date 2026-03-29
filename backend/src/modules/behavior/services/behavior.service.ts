// backend/src/modules/behavior/services/behavior.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/database/prisma.service';
import { CreateBehaviorRecordDto } from '../dto/behavior.dto';

@Injectable()
export class BehaviorService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, params: {
    studentId?: string;
    type?:      string;
    from?:      string;
    to?:        string;
    page?:      number;
    limit?:     number;
  }) {
    const page  = params.page  ?? 1;
    const limit = params.limit ?? 20;
    const where: any = { tenantId };

    if (params.studentId) where.studentId   = params.studentId;
    if (params.type)      where.type        = params.type;
    if (params.from || params.to) {
      where.incidentDate = {};
      if (params.from) where.incidentDate.gte = new Date(params.from);
      if (params.to)   where.incidentDate.lte = new Date(params.to);
    }

    const [data, total] = await Promise.all([
      this.prisma.behaviorRecord.findMany({
        where,
        orderBy: { incidentDate: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      this.prisma.behaviorRecord.count({ where }),
    ]);

    return { data, meta: { total, page, limit, lastPage: Math.ceil(total / limit) } };
  }

  async getById(tenantId: string, id: string) {
    return this.prisma.behaviorRecord.findFirstOrThrow({
      where: { id, tenantId },
    });
  }

  async getByStudent(tenantId: string, studentId: string) {
    return this.prisma.behaviorRecord.findMany({
      where:   { tenantId, studentId },
      orderBy: { incidentDate: 'desc' },
    });
  }

  async getStudentSummary(tenantId: string, studentId: string) {
    const records = await this.prisma.behaviorRecord.findMany({
      where: { tenantId, studentId },
      select: { type: true, points: true, severity: true, status: true },
    });

    const total    = records.length;
    const positive = records.filter(r => r.type === 'POSITIVE').length;
    const negative = records.filter(r => r.type === 'NEGATIVE').length;
    const neutral  = records.filter(r => r.type === 'NEUTRAL').length;
    const totalPoints = records.reduce((sum, r) => sum + (r.points ?? 0), 0);
    const open     = records.filter(r => r.status === 'OPEN').length;
    const critical = records.filter(r => r.severity === 'CRITICAL' || r.severity === 'HIGH').length;

    return { total, positive, negative, neutral, totalPoints, open, critical };
  }

  async create(tenantId: string, dto: CreateBehaviorRecordDto, reportedBy: string) {
    return this.prisma.behaviorRecord.create({
      data: {
        tenantId,
        studentId:        dto.studentId,
        type:             dto.type             as any,
        category:         dto.category,
        title:            dto.title            ?? null,
        description:      dto.description      ?? null,
        severity:         dto.severity         as any ?? 'MEDIUM',
        actionTaken:      dto.actionTaken      ?? null,
        points:           dto.points           ?? 0,
        parentNotified:   dto.parentNotified   ?? false,
        followUpRequired: dto.followUpRequired ?? false,
        reportedBy,
        incidentDate:     new Date(dto.incidentDate),
        status:           'OPEN' as any,
      },
    });
  }

  async resolve(tenantId: string, id: string, resolvedBy: string, resolutionNote?: string) {
    return this.prisma.behaviorRecord.update({
      where: { id },
      data: {
        status:         'RESOLVED' as any,
        resolvedAt:     new Date(),
        resolvedBy,
        resolutionNote: resolutionNote ?? null,
      },
    });
  }

  async delete(tenantId: string, id: string) {
    return this.prisma.behaviorRecord.delete({ where: { id } });
  }
}
