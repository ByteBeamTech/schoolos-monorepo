import {
  AddonCategory,
  BillingType,
  Currency,
} from '@prisma/client';

export interface PricingAddonFilter {
  category?: AddonCategory;

  billingType?: BillingType;

  currency?: Currency;

  activeOnly?: boolean;
}
