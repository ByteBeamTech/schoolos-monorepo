// backend/src/modules/student-billing/fee-heads/services/fee-head.service.ts
//
// M9 (redesigned roadmap): FeeHead catalog CRUD. No ledger write anywhere
// in this file, deliberately -- per the frozen milestone spec, "Events.
// None." This is configuration, not a financial fact.

import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '../../../../core/compliance/audit.service';
import { CreateFeeHeadDto, UpdateFeeHeadDto } from '../../dto/billing.dto';

@Injectable()
export class FeeHeadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit:  AuditService,
  ) {}

  async create(tenantId: string, branchId: string, dto: CreateFeeHeadDto, actorId: string) {
    const existing = await this.prisma.feeHead.findFirst({ where: { branchId, code: dto.code } });
    if (existing) throw new ConflictException(`A fee head with code "${dto.code}" already exists for this branch.`);

    if (dto.parentId) {
      const parent = await this.prisma.feeHead.findFirst({ where: { id: dto.parentId, tenantId, branchId } });
      if (!parent) throw new NotFoundException(`Parent fee head not found: ${dto.parentId}`);
      // C-1: depth capped at 2. If the intended parent ITSELF has a
      // parent, placing a new head under it would create a third level.
      // Postgres has no native way to express "self-reference depth <=2";
      // this check is the actual enforcement, not documentation of one.
      if (parent.parentId) {
        throw new BadRequestException('Fee head hierarchy is capped at 2 levels; the selected parent already has a parent.');
      }
    }

    const head = await this.prisma.feeHead.create({
      data: {
        tenantId, branchId,
        name: dto.name, code: dto.code,
        accountingNature: dto.accountingNature,
        parentId: dto.parentId ?? null,
        displayOrder: dto.displayOrder ?? 0,
      },
    });
    await this.audit.logCreate({ tenantId, actorId, entityType: 'FeeHead', entityId: head.id, after: head });
    return head;
  }

  async findAll(tenantId: string, branchId: string) {
    return this.prisma.feeHead.findMany({
      where:   { tenantId, branchId },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findById(tenantId: string, branchId: string, id: string) {
    const head = await this.prisma.feeHead.findFirst({ where: { id, tenantId, branchId } });
    if (!head) throw new NotFoundException(`Fee head not found: ${id}`);
    return head;
  }

  async update(tenantId: string, branchId: string, id: string, dto: UpdateFeeHeadDto, actorId: string) {
    const head = await this.findById(tenantId, branchId, id);

    if (dto.accountingNature && dto.accountingNature !== head.accountingNature) {
      // Invariant 19: accountingNature is immutable once this head has
      // been referenced by an ISSUED invoice -- issued meaning
      // status != 'DRAFT' (M8's own "issued" boundary: SENT and
      // everything after is a real, relied-upon fact; a DRAFT invoice
      // is still freely editable and was never shown to anyone).
      const referencedByIssued = await this.prisma.invoiceItem.findFirst({
        where: { feeHeadId: id, invoice: { status: { not: 'DRAFT' } } },
      });
      if (referencedByIssued) {
        throw new BadRequestException(
          'accountingNature cannot change once this fee head has been used on an issued invoice.',
        );
      }
    }

    const updated = await this.prisma.feeHead.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.accountingNature !== undefined && { accountingNature: dto.accountingNature }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
      },
    });
    await this.audit.logUpdate({ tenantId, actorId, entityType: 'FeeHead', entityId: id, before: head, after: updated });
    return updated;
  }
}
