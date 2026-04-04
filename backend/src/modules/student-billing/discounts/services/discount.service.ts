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
    const student = await this.prisma.student.findFirst({ where: { id: dto.studentId, tenantId } });
    if (!student) throw new NotFoundException(`Student not found: ${dto.studentId}`);
    if (dto.type === 'PERCENTAGE' && (dto.value < 0 || dto.value > 100)) {
      throw new BadRequestException('Percentage must be 0-100.');
    }
    const discount = await this.prisma.discount.create({
      data: {
        tenantId,
        studentId:      dto.studentId,
        category:       dto.category  as any,
        type:           dto.type      as any,
        value:          dto.value,
        validFrom:      new Date(dto.validFrom),
        validUntil:     dto.validUntil ? new Date(dto.validUntil) : null,
        reason:         dto.reason    ?? null,
        notes:          dto.notes     ?? null,
        approvalStatus: 'PENDING',
      },
    });
    await this.prisma.discountApproval.create({
      data: { discountId: discount.id, requesterId: actorId, status: 'PENDING' },
    });
    await this.audit.logCreate({
      tenantId, actorId,
      entityType: 'Discount', entityId: discount.id,
      after: { studentId: dto.studentId, category: dto.category, value: dto.value },
    });
    this.logger.log(`Discount created: ${dto.category} ${dto.value} | student: ${dto.studentId}`);
    return discount;
  }

  async findAll(tenantId: string, filters: { studentId?: string; approvalStatus?: string } = {}) {
    return this.prisma.discount.findMany({
      where: {
        tenantId,
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

  async findById(tenantId: string, id: string) {
    const d = await this.prisma.discount.findFirst({
      where:   { id, tenantId },
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
    if (d.approvalStatus !== 'PENDING') {
      throw new BadRequestException(`Discount is already ${d.approvalStatus}.`);
    }
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
    if (d.approvalStatus !== 'PENDING') {
      throw new BadRequestException(`Discount is already ${d.approvalStatus}.`);
    }
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
