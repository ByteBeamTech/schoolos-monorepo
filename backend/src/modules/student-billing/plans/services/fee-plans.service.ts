import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService }  from '../../../../core/compliance/audit.service';
import { CreateFeePlanDto, AssignFeePlanDto } from '../../dto/billing.dto';

@Injectable()
export class FeePlansService {
  private readonly logger = new Logger(FeePlansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit:  AuditService,
  ) {}

  async create(tenantId: string, dto: CreateFeePlanDto, actorId: string) {
    const existing = await this.prisma.feePlan.findFirst({
      where: { tenantId, name: dto.name, academicYear: dto.academicYear },
    });
    if (existing) throw new ConflictException(`Fee plan "${dto.name}" already exists.`);

    const plan = await this.prisma.feePlan.create({
      data: {
        tenantId,
        sessionId:    dto.sessionId,
        name:         dto.name,
        academicYear: dto.academicYear,
        description:  dto.description ?? null,
        grade:        dto.grade       ?? null,
        currency:     (dto.currency as any) ?? 'INR',
        isActive:     true,
        feeItems: dto.feeItems?.length ? {
          create: dto.feeItems.map((item, i) => ({
            name:       item.name,
            amount:     item.amount,
            isOptional: item.isOptional ?? false,
            dueDate:    item.dueDate ? new Date(item.dueDate) : null,
            gstRate:    item.gstRate  ?? null,
            gstCode:    item.gstCode  ?? null,
            sortOrder:  item.sortOrder ?? i,
          })),
        } : undefined,
      },
      include: { feeItems: { orderBy: { sortOrder: 'asc' } } },
    });

    await this.audit.logCreate({ tenantId, actorId, entityType: 'FeePlan', entityId: plan.id, after: { name: plan.name } });
    this.logger.log(`Fee plan created: ${plan.name} | tenant: ${tenantId}`);
    return plan;
  }

  async findAll(tenantId: string, academicYear?: string) {
    return this.prisma.feePlan.findMany({
      where:   { tenantId, ...(academicYear && { academicYear }), isActive: true },
      include: { feeItems: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async findById(tenantId: string, id: string) {
    const plan = await this.prisma.feePlan.findFirst({
      where:   { id, tenantId },
      include: {
        feeItems:    { orderBy: { sortOrder: 'asc' } },
        assignments: { include: { student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } } } },
      },
    });
    if (!plan) throw new NotFoundException(`Fee plan not found: ${id}`);
    return plan;
  }

  async assign(tenantId: string, dto: AssignFeePlanDto, actorId: string) {
    const existing = await this.prisma.feeAssignment.findFirst({
      where: { studentId: dto.studentId, feePlanId: dto.feePlanId, academicYear: dto.academicYear },
    });
    if (existing) throw new ConflictException('Fee plan already assigned to this student.');

    const assignment = await this.prisma.feeAssignment.create({
      data: { tenantId, studentId: dto.studentId, feePlanId: dto.feePlanId, academicYear: dto.academicYear, assignedBy: actorId },
      include: {
        student: { select: { firstName: true, lastName: true, admissionNumber: true } },
        feePlan: { select: { name: true } },
      },
    });

    await this.audit.logCreate({ tenantId, actorId, entityType: 'FeeAssignment', entityId: assignment.id, after: { studentId: dto.studentId, feePlanId: dto.feePlanId } });
    return assignment;
  }

  async getStudentFeePlans(tenantId: string, studentId: string) {
    return this.prisma.feeAssignment.findMany({
      where:   { tenantId, studentId },
      include: { feePlan: { include: { feeItems: { orderBy: { sortOrder: 'asc' } } } } },
      orderBy: { assignedAt: 'desc' },
    });
  }

  async getStudentFeeSummary(tenantId: string, studentId: string, academicYear: string) {
    const assignments = await this.prisma.feeAssignment.findMany({
      where:   { tenantId, studentId, academicYear },
      include: { feePlan: { include: { feeItems: true } } },
    });
    let totalFees = 0;
    const breakdown: any[] = [];
    for (const a of assignments) {
      const items = a.feePlan.feeItems.map((i: any) => ({ name: i.name, amount: Number(i.amount) }));
      totalFees += items.reduce((s: number, i: any) => s + i.amount, 0);
      breakdown.push({ planName: a.feePlan.name, items });
    }
    return { studentId, academicYear, totalFees, breakdown };
  }
}
