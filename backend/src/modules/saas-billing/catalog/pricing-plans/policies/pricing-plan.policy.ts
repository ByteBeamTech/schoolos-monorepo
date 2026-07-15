import { Injectable } from '@nestjs/common';

import { PricingPlan } from '@prisma/client';

@Injectable()
export class PricingPlanPolicy {
  canCreate(): boolean {
    return true;
  }

  canUpdate(plan: PricingPlan): boolean {
    return plan.deletedAt === null;
  }

  canArchive(plan: PricingPlan): boolean {
    return (
      plan.deletedAt === null &&
      plan.isActive
    );
  }

  canRestore(plan: PricingPlan): boolean {
    return (
      plan.deletedAt !== null
    );
  }

  canPublish(plan: PricingPlan): boolean {
    return (
      plan.deletedAt === null
    );
  }
}
