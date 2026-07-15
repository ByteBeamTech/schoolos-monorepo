import {
  Currency,
  PlanCategory,
  PricingModel,
  Region,
  SubscriptionTier,
} from '@prisma/client';

export interface PricingPlanFilter {
  category?: PlanCategory;

  tier?: SubscriptionTier;

  model?: PricingModel;

  currency?: Currency;

  region?: Region;

  activeOnly?: boolean;

  publicOnly?: boolean;

  recommendedOnly?: boolean;

  createdAfter?: Date;

  createdBefore?: Date;
}
