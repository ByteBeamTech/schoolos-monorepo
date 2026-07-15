import { Injectable } from '@nestjs/common';
import { PricingPlan, Prisma } from '@prisma/client';

import {
  PricingPlanListResponse,
  PricingPlanResponse,
} from '../interfaces/pricing-plan-response.interface';

@Injectable()
export class PricingPlanMapper {
  toResponse(
    plan: PricingPlan,
  ): PricingPlanResponse {
    return {
      id: plan.id,

      code: plan.code,

      name: plan.name,

      description: plan.description,

      category: plan.category,

      tier: plan.tier,

      model: plan.model,

      currency: plan.currency,

      region: plan.region,

      version: plan.version,

      baseFee:
        plan.baseFee == null
          ? null
          : Number(plan.baseFee),

      perStudentRate:
        plan.perStudentRate == null
          ? null
          : Number(plan.perStudentRate),

      billingCycleMonths:
        plan.billingCycleMonths,

      trialDays:
        plan.trialDays,

      studentLimit:
        plan.studentLimit,

      branchLimit:
        plan.branchLimit,

      staffLimit:
        plan.staffLimit,

      storageLimitGb:
        plan.storageLimitGb,

      overageEnabled:
        plan.overageEnabled,

      overageRate:
        plan.overageRate == null
          ? null
          : Number(plan.overageRate),

      prorateEnabled:
        plan.prorateEnabled,

      isActive:
        plan.isActive,

      isPublic:
        plan.isPublic,

      recommended:
        plan.recommended,

      displayOrder:
        plan.displayOrder,

      features:
        (plan.features ??
          {}) as Record<
          string,
          boolean
        >,

      metadata:
        (plan.metadata ??
          null) as Record<
          string,
          unknown
        > | null,

      effectiveFrom:
        plan.effectiveFrom,

      effectiveTo:
        plan.effectiveTo,

      createdAt:
        plan.createdAt,

      updatedAt:
        plan.updatedAt,
    };
  }

  toResponses(
    plans: PricingPlan[],
  ): PricingPlanResponse[] {
    return plans.map((plan) =>
      this.toResponse(plan),
    );
  }

  toPagedResponse(
    data: {
      items: PricingPlan[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    },
  ): PricingPlanListResponse {
    return {
      data: this.toResponses(
        data.items,
      ),

      total: data.total,

      page: data.page,

      limit: data.limit,

      totalPages:
        data.totalPages,
    };
  }
}
