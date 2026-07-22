// backend/src/modules/student-billing/discounts/services/discount.service.ts
// FULL REPLACEMENT
// P0 FIX: branchId was undefined in DiscountApproval.create() — derived from student now

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService }  from '../../../../core/compliance/audit.service';
import { CreateDiscountDto, ApproveDiscountDto, RejectDiscountDto } from '../../dto/billing.dto';

@Injectable()
export class DiscountService {
  private readonly logger = new Logger(DiscountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit:  AuditService,
  ) {}

  async create(tenantId: string, dto: CreateDiscountDto, actorId: string) {
    // P0 FIX: derive branchId from the student record
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, tenantId },
      select: { id: true, branchId: true },
    });
    if (!student) throw new NotFoundException(`Student not found: ${dto.studentId}`);

    if (dto.type === 'PERCENTAGE' && (dto.value < 0 || dto.value > 100)) {
      throw new BadRequestException('Percentage must be 0-100.');
    }

    const currentSession = await this.prisma.academicSession.findFirst({
      where: { tenantId, isCurrent: true },
      select: { id: true },
    });

    // FEE-1: resolve the branch's DiscountCategory row.
    //
    // dto.category is a CODE from the DiscountCategory enum in billing.dto.ts
    // ('SIBLING', 'MERIT', ...). Discount.categoryId is a foreign key to
    // DiscountCategory.id (a cuid). Previously the code string was assigned
    // straight to the FK column, so every discount creation failed on a
    // foreign-key violation.
    //
    // Categories are branch-managed CONFIGURATION, provisioned when a branch
    // is created (and backfilled for pre-existing branches). This resolves an
    // existing row and REJECTS when absent -- it must never create one:
    // financial master data is not created as a side effect of a transactional
    // write.
    const category = await this.prisma.discountCategory.findUnique({
      where: { branchId_code: { branchId: student.branchId, code: dto.category } },
      select: { id: true, isActive: true },
    });

    if (!category) {
      // Reaching this means the branch was never provisioned -- a
      // configuration gap, not a client error in the usual sense. Named
      // explicitly so the operator knows which branch and code to fix, and
      // pointed at the remedy.
      throw new BadRequestException(
        `Discount category '${dto.category}' is not configured for this branch. ` +
          `Run the discount-category backfill for branch ${student.branchId}, ` +
          `or create the category before issuing discounts.`,
      );
    }

    // BUSINESS RULE (explicit, not an implementation detail): a
    // DiscountCategory must BOTH exist AND be active for a discount to be
    // created against it. Either condition failing rejects the request.
    //
    // Do not relax this to a bare existence check. When category
    // administration lands (FEE-2), an administrator disabling a category
    // must actually stop new discounts from using it -- otherwise isActive is
    // a misleading no-op that shows "disabled" in the UI while discounts keep
    // being issued. Existing discounts already issued under a category are
    // unaffected: this rule governs creation only, never retroactive
    // invalidation of occurred facts (ADR-FEE-003 IMM-001).
    if (!category.isActive) {
      throw new BadRequestException(
        `Discount category '${dto.category}' is disabled for this branch and cannot be used for new discounts.`,
      );
    }

    const discount = await (this.prisma as any).discount.create({
      data: {
        tenantId,
        branchId:       student.branchId,           // P0 FIX: was undefined
        studentId:      dto.studentId,
        academicYearId: currentSession?.id ?? 'default',
        categoryId:     category.id,                // resolved FK, never the raw code
        type:           dto.type      as any,
        value:          dto.value,
        appliedAmount:  dto.value,                  // snapshot — will be recalculated on invoice generate
        source:         'USER',
        reason:         dto.reason    ?? null,
        validFrom:      new Date(dto.validFrom),
        validUntil:     dto.validUntil ? new Date(dto.validUntil) : null,
        approvalStatus: 'PENDING',
        createdById:    actorId,
      },
    });

    // P0 FIX: branchId now correctly populated
    await (this.prisma as any).discountApproval.create({
      data: {
        discountId:  discount.id,
        tenantId,
        branchId:    student.branchId,              // P0 FIX: was undefined → Prisma error
        requesterId: actorId,
        status:      'PENDING',
      },
    });

    await this.audit.logCreate({
      tenantId, actorId,
      entityType: 'Discount', entityId: discount.id,
      after: { studentId: dto.studentId, category: dto.category, value: dto.value },
    });
    this.logger.log(`Discount created: ${dto.category} ${dto.value} | student: ${dto.studentId}`);
    return discount;
  }

  async findAll(
    tenantId: string,
    filters: { studentId?: string; approvalStatus?: string } = {},
    // FEE-0: branch scoping per ADR-FEE-002 (null = tenant-wide, [] = nothing,
    // fail closed). Same contract as InvoiceService/PaymentService reads.
    authorizedBranchIds?: string[] | null,
  ) {
    return this.prisma.discount.findMany({
      where: {
        tenantId,
        ...(authorizedBranchIds != null && { branchId: { in: authorizedBranchIds } }),
        ...(filters.studentId      && { studentId:      filters.studentId }),
        ...(filters.approvalStatus && { approvalStatus: filters.approvalStatus as any }),
      },
      include: {
        student:   { select: { firstName: true, lastName: true, admissionNumber: true } },
        approvals: { include: { requester: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(
    tenantId: string,
    id: string,
    // FEE-0: out-of-branch discounts read as NotFound (anti-probing).
    authorizedBranchIds?: string[] | null,
  ) {
    const d = await this.prisma.discount.findFirst({
      where: {
        id,
        tenantId,
        ...(authorizedBranchIds != null && { branchId: { in: authorizedBranchIds } }),
      },
      include: {
        student:   { select: { firstName: true, lastName: true, admissionNumber: true } },
        approvals: {
          include: {
            requester: { select: { firstName: true, lastName: true } },
            approver:  { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!d) throw new NotFoundException(`Discount not found: ${id}`);
    return d;
  }

  async approve(tenantId: string, id: string, dto: ApproveDiscountDto, actorId: string) {
    const d = await this.findById(tenantId, id);
    if (d.approvalStatus !== 'PENDING') throw new BadRequestException(`Discount is already ${d.approvalStatus}.`);

    await this.prisma.discount.update({ where: { id }, data: { approvalStatus: 'APPROVED' } });
    await this.prisma.discountApproval.updateMany({
      where: { discountId: id, status: 'PENDING' },
      data:  { approverId: actorId, status: 'APPROVED', approvalNote: dto.approvalNote, decidedAt: new Date() },
    });
    await this.audit.logUpdate({
      tenantId, actorId, entityType: 'Discount', entityId: id,
      before: { approvalStatus: 'PENDING' }, after: { approvalStatus: 'APPROVED' },
    });
    this.logger.log(`Discount approved: ${id} by ${actorId}`);
    return this.findById(tenantId, id);
  }

  async reject(tenantId: string, id: string, dto: RejectDiscountDto, actorId: string) {
    const d = await this.findById(tenantId, id);
    if (d.approvalStatus !== 'PENDING') throw new BadRequestException(`Discount is already ${d.approvalStatus}.`);

    await this.prisma.discount.update({ where: { id }, data: { approvalStatus: 'REJECTED' } });
    await this.prisma.discountApproval.updateMany({
      where: { discountId: id, status: 'PENDING' },
      data:  { approverId: actorId, status: 'REJECTED', approvalNote: dto.rejectionNote, decidedAt: new Date() },
    });
    await this.audit.logUpdate({
      tenantId, actorId, entityType: 'Discount', entityId: id,
      before: { approvalStatus: 'PENDING' }, after: { approvalStatus: 'REJECTED' },
    });
    return this.findById(tenantId, id);
  }

  async getPendingApprovals(tenantId: string) {
    return this.prisma.discount.findMany({
      where:   { tenantId, approvalStatus: 'PENDING' },
      include: {
        student:   { select: { firstName: true, lastName: true, admissionNumber: true } },
        approvals: { include: { requester: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
