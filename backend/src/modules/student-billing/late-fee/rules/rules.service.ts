// backend/src/modules/student-billing/late-fee/rules/rules.service.ts
//
// Late Fee Module FDD v2 Section 6.2 / Implementation Roadmap v2 Sprint 3.
//
// LateFeeRule is a distinct resource with its own lifecycle -- a new
// subfolder (rules/controllers, rules/services would match fee-heads'
// split exactly; a single services/controllers pair is used here since
// this resource is smaller), not an extension of late-fee.service.ts's
// existing assessment/waiver logic. Structural template is
// fee-head.service.ts: constructor shape, audit logging calls,
// NotFoundException handling, and the dto.field !== undefined spread
// pattern for partial updates are all copied from there deliberately,
// not reinvented.

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '../../../../core/compliance/audit.service';
import { CreateLateFeeRuleDto, DeactivateLateFeeRuleDto } from '../../dto/billing.dto';

@Injectable()
export class RulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * FDD Section 6.2: create-new-not-edit. There is no update() for
   * calculation fields anywhere in this service -- deactivate() below is
   * the only mutation this resource allows, matching the same
   * historical-integrity reasoning already applied to Fee Plans
   * (FDD Section 8.6).
   */
  async create(tenantId: string, dto: CreateLateFeeRuleDto, actorId: string) {
    if (dto.feePlanId && !dto.branchId) {
      // FDD Section 2.2: a Fee-Plan-scoped rule is, by definition, also
      // branch-scoped -- the resolver's selectMostSpecific() matches on
      // (branchId, feePlanId) together. A feePlanId with no branchId
      // would be a rule the resolver could never actually select.
      throw new BadRequestException('feePlanId requires branchId to also be set.');
    }

    if (dto.branchId) {
      const branch = await (this.prisma as any).branch.findFirst({ where: { id: dto.branchId, tenantId } });
      if (!branch) throw new NotFoundException(`Branch not found: ${dto.branchId}`);
    }
    if (dto.feePlanId) {
      const feePlan = await (this.prisma as any).feePlan.findFirst({ where: { id: dto.feePlanId, tenantId } });
      if (!feePlan) throw new NotFoundException(`Fee plan not found: ${dto.feePlanId}`);
    }

    const rule = await (this.prisma.lateFeeRule as any).create({
      data: {
        tenantId,
        branchId: dto.branchId ?? null,
        feePlanId: dto.feePlanId ?? null,
        calculationMethod: dto.calculationMethod,
        penaltyType: dto.penaltyType,
        penaltyValue: dto.penaltyValue,
        gracePeriodDays: dto.gracePeriodDays,
        maxPenalty: dto.maxPenalty ?? null,
        compoundDaily: dto.compoundDaily ?? false,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date(),
        isActive: true,
        createdById: actorId,
      },
    });
    await this.audit.logCreate({ tenantId, actorId, entityType: 'LateFeeRule', entityId: rule.id, after: rule });
    return rule;
  }

  async findAll(tenantId: string, branchId?: string, feePlanId?: string) {
    return (this.prisma.lateFeeRule as any).findMany({
      where: {
        tenantId,
        ...(branchId !== undefined && { branchId }),
        ...(feePlanId !== undefined && { feePlanId }),
      },
      orderBy: [{ isActive: 'desc' }, { effectiveFrom: 'desc' }],
    });
  }

  /**
   * Deactivate/supersede only -- effectiveUntil and isActive. No
   * calculation field is ever accepted here, per DeactivateLateFeeRuleDto's
   * own shape (FDD 6.2's "never a true update", enforced by what the DTO
   * can even carry, not just by this method choosing not to read fields
   * off a broader one).
   */
  async deactivate(tenantId: string, id: string, dto: DeactivateLateFeeRuleDto, actorId: string) {
    const rule = await (this.prisma.lateFeeRule as any).findFirst({ where: { id, tenantId } });
    if (!rule) throw new NotFoundException(`Late fee rule not found: ${id}`);

    const updated = await (this.prisma.lateFeeRule as any).update({
      where: { id },
      data: {
        isActive: false,
        effectiveUntil: dto.effectiveUntil ? new Date(dto.effectiveUntil) : new Date(),
      },
    });
    await this.audit.logUpdate({ tenantId, actorId, entityType: 'LateFeeRule', entityId: id, before: rule, after: updated });
    return updated;
  }
}
