import {
  AddonCategory,
  BillingType,
  Currency,
} from '@prisma/client';

export interface PricingAddonResponse {
  id: string;

  code: string;

  name: string;

  description?: string | null;

  category: AddonCategory;

  billingType: BillingType;

  amount: number;

  currency: Currency;

  isActive: boolean;

  metadata?: Record<
    string,
    unknown
  > | null;

  createdAt: Date;

  updatedAt: Date;
}

export interface PricingAddonListResponse {
  data: PricingAddonResponse[];

  total: number;

  page: number;

  limit: number;

  totalPages: number;
}
