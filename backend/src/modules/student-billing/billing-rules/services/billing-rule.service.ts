// backend/src/modules/student-billing/billing-rules/services/billing-rule.service.ts
//
// Phase 2 (PHASE_2_REVISED_REUSE_CLASSIFICATION.md, frozen). BillingRule is
// genuinely new -- no existing entity to refactor. Create-only, per the
// frozen business rule: a BillingRule referenced by an active FeePlan
// never changes. A permanent policy revision is expressed as a new
// FeePlan, never as an edit to an existing rule. Temporary concessions
// route through the existing LateFeeRule mechanism entirely, never
// through this model. No update(), no supersede() -- there is nothing
// for either to do.

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { CreateBillingRuleDto } from '../../dto/billing.dto';

@Injectable()
export class BillingRuleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateBillingRuleDto) {
    return this.prisma.billingRule.create({
      data: {
        tenantId,
        frequency:     dto.frequency,
        billingMonths: dto.billingMonths,
        dueDayOfMonth: dto.dueDayOfMonth,
        prorationRule: dto.prorationRule ?? 'NO_PRORATION',
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.billingRule.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(tenantId: string, id: string) {
    const rule = await this.prisma.billingRule.findFirst({ where: { id, tenantId } });
    if (!rule) throw new NotFoundException(`Billing rule not found: ${id}`);
    return rule;
  }
}
