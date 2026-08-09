import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService }  from '../../../../core/compliance/audit.service';
import { CreateFeePlanDto, AssignFeePlanDto, CreateFeeItemDto, SupersedeFeeItemDto } from '../../dto/billing.dto';

@Injectable()
export class FeePlansService {
  private readonly logger = new Logger(FeePlansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit:  AuditService,
  ) {}

  async create(tenantId: string, branchId: string, dto: CreateFeePlanDto, actorId: string) {
    const existing = await this.prisma.feePlan.findFirst({
      where: { tenantId, branchId, name: dto.name, academicYear: dto.academicYear },
    });
    if (existing) throw new ConflictException(`Fee plan "${dto.name}" already exists.`);

    // Phase 2: no inline feeItems creation. A plan is created bare; its
    // items are each their own explicit step (createFeeItem, below)
    // against this plan's id, per the frozen design's "stop being the
    // thing that also defines fee items inline" decision.
    const plan = await this.prisma.feePlan.create({
      data: {
        tenantId,
	branchId,
        sessionId:    dto.sessionId,
        name:         dto.name,
        academicYear: dto.academicYear,
        description:  dto.description ?? null,
        grade:        dto.grade       ?? null,
        currency:     (dto.currency as any) ?? 'INR',
        isActive:     true,
      },
      include: { feeItems: { orderBy: { sortOrder: 'asc' } } },
    });

    await this.audit.logCreate({ tenantId, actorId, entityType: 'FeePlan', entityId: plan.id, after: { name: plan.name } });
    this.logger.log(`Fee plan created: ${plan.name} | tenant: ${tenantId}`);
    return plan;
  }

  /**
   * Phase 2: fee item creation is its own explicit step against an
   * existing plan, not inlined into plan creation. feeHeadId/billingRuleId
   * are required by the DTO itself (not just validated here) -- closes
   * the original FeeHead/FeeItem disconnection the gap analysis found.
   */
  async createFeeItem(tenantId: string, branchId: string, feePlanId: string, dto: CreateFeeItemDto, actorId: string) {
    const plan = await this.prisma.feePlan.findFirst({ where: { id: feePlanId, tenantId, branchId } });
    if (!plan) throw new NotFoundException(`Fee plan not found: ${feePlanId}`);

    // feeHeadId must share the target plan's branch (Phase 2's stated
    // validation rule) -- confirmed against a real branch-scoped row,
    // not assumed from the id alone.
    const feeHead = await this.prisma.feeHead.findFirst({ where: { id: dto.feeHeadId, tenantId, branchId } });
    if (!feeHead) throw new NotFoundException(`Fee head not found in this branch: ${dto.feeHeadId}`);

    const billingRule = await this.prisma.billingRule.findFirst({ where: { id: dto.billingRuleId, tenantId } });
    if (!billingRule) throw new NotFoundException(`Billing rule not found: ${dto.billingRuleId}`);

    const item = await this.prisma.feeItem.create({
      data: {
        feePlanId,
        name:       dto.name,
        amount:     dto.amount,
        feeHeadId:  dto.feeHeadId,
        billingRuleId: dto.billingRuleId,
        isOptional: dto.isOptional ?? false,
        dueDate:    dto.dueDate ? new Date(dto.dueDate) : null,
        gstRate:    dto.gstRate ?? null,
        gstCode:    dto.gstCode ?? null,
        sortOrder:  dto.sortOrder ?? 0,
        effectiveFrom: new Date(),
      },
    });

    await this.audit.logCreate({ tenantId, actorId, entityType: 'FeeItem', entityId: item.id, after: { name: item.name, feePlanId } });
    return item;
  }

  /**
   * Phase 2: create-new-not-edit, matching LateFeeRule's own established
   * pattern -- reused here, not reinvented. Never mutates the existing
   * row's calculation fields; sets its effectiveUntil and inserts a new
   * row, both in one transaction.
   */
  async supersedeFeeItem(tenantId: string, branchId: string, feeItemId: string, dto: SupersedeFeeItemDto, actorId: string) {
    const existing = await this.prisma.feeItem.findFirst({
      where: { id: feeItemId, feePlan: { tenantId, branchId } },
    });
    if (!existing) throw new NotFoundException(`Fee item not found: ${feeItemId}`);

    // Supersede requires the same feeHeadId (Phase 2's stated validation
    // rule) -- a supersede changes amount/rule, not what the item
    // fundamentally represents; changing the head is a new item, not a
    // revision of this one.
    if (dto.feeHeadId !== existing.feeHeadId) {
      throw new ConflictException('Supersede must keep the same feeHeadId. Create a new fee item to change the fee head.');
    }
    const billingRule = await this.prisma.billingRule.findFirst({ where: { id: dto.billingRuleId, tenantId } });
    if (!billingRule) throw new NotFoundException(`Billing rule not found: ${dto.billingRuleId}`);

    const now = new Date();
    const [, superseded] = await this.prisma.$transaction([
      this.prisma.feeItem.update({
        where: { id: feeItemId },
        data:  { effectiveUntil: now },
      }),
      this.prisma.feeItem.create({
        data: {
          feePlanId:  existing.feePlanId,
          name:       dto.name,
          amount:     dto.amount,
          feeHeadId:  dto.feeHeadId,
          billingRuleId: dto.billingRuleId,
          isOptional: dto.isOptional ?? existing.isOptional,
          dueDate:    dto.dueDate ? new Date(dto.dueDate) : null,
          gstRate:    dto.gstRate ?? null,
          gstCode:    dto.gstCode ?? null,
          sortOrder:  dto.sortOrder ?? existing.sortOrder,
          effectiveFrom: now,
        },
      }),
    ]);

    await this.audit.logUpdate({
      tenantId, actorId, entityType: 'FeeItem', entityId: feeItemId,
      before: { name: existing.name, amount: existing.amount },
      after:  { name: superseded.name, amount: superseded.amount, supersededBy: superseded.id },
    });
    return superseded;
  }

  async findAll(tenantId: string, branchId: string, academicYear?: string) {
    return this.prisma.feePlan.findMany({
      where:   { tenantId, branchId, ...(academicYear && { academicYear }), isActive: true },
      include: { feeItems: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async findById(tenantId: string, branchId: string, id: string) {
    const plan = await this.prisma.feePlan.findFirst({
      where:   { id, tenantId, branchId },
      include: {
        feeItems:    { orderBy: { sortOrder: 'asc' } },
        assignments: { include: { student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } } } },
      },
    });
    if (!plan) throw new NotFoundException(`Fee plan not found: ${id}`);
    return plan;
  }

  async assign(tenantId: string, dto: AssignFeePlanDto, actorId: string) {
	  const student = await this.prisma.student.findFirst({
  where: {
    id: dto.studentId,
    tenantId,
  },
  select: {
    branchId: true,
  },
});

if (!student) {
  throw new NotFoundException('Student not found');
}
    const existing = await this.prisma.feeAssignment.findFirst({
      where: { tenantId, branchId: student.branchId, studentId: dto.studentId, feePlanId: dto.feePlanId, academicYear: dto.academicYear },
    });
    if (existing) throw new ConflictException('Fee plan already assigned to this student.');

    const assignment = await this.prisma.feeAssignment.create({
      data: { tenantId, branchId: student.branchId, studentId: dto.studentId, feePlanId: dto.feePlanId, academicYear: dto.academicYear, assignedBy: actorId },
      include: {
        student: { select: { firstName: true, lastName: true, admissionNumber: true } },
        feePlan: { select: { name: true } },
      },
    });

    await this.audit.logCreate({ tenantId, actorId, entityType: 'FeeAssignment', entityId: assignment.id, after: { studentId: dto.studentId, feePlanId: dto.feePlanId } });
    return assignment;
  }

  async getStudentFeePlans(tenantId: string, studentId: string) {
   
	  const student = await this.prisma.student.findFirst({
  where: {
    id: studentId,
    tenantId,
  },
  select: {
    branchId: true,
  },
});

if (!student) {
  throw new NotFoundException('Student not found');
}
	  return this.prisma.feeAssignment.findMany({
      where:   { tenantId, branchId: student.branchId, studentId },
      include: { feePlan: { include: { feeItems: { orderBy: { sortOrder: 'asc' } } } } },
      orderBy: { assignedAt: 'desc' },
    });
  }

  async getStudentFeeSummary(tenantId: string, studentId: string, academicYear: string) {
 
	  const student = await this.prisma.student.findFirst({
  where: {
    id: studentId,
    tenantId,
  },
  select: {
    branchId: true,
  },
});

if (!student) {
  throw new NotFoundException('Student not found');
}
      
	  const assignments = await this.prisma.feeAssignment.findMany({
      where:   { tenantId, branchId: student.branchId, studentId, academicYear },
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
