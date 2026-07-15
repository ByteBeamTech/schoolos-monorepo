import {
  Currency,
  PlanCategory,
  PricingModel,
  Region,
  SubscriptionTier,
} from '@prisma/client';

export interface PricingPlanResponse {
  id: string;

  code: string;

  name: string;

  description?: string | null;

  category: PlanCategory;

  tier: SubscriptionTier;

  model: PricingModel;

  currency: Currency;

  region: Region;

  version: number;

  baseFee?: number | null;

  perStudentRate?: number | null;

  billingCycleMonths: number;

  trialDays: number;

  studentLimit?: number | null;

  branchLimit?: number | null;

  staffLimit?: number | null;

  storageLimitGb?: number | null;

  overageEnabled: boolean;

  overageRate?: number | null;

  prorateEnabled: boolean;

  isActive: boolean;

  isPublic: boolean;

  recommended: boolean;

  displayOrder: number;

  features: Record<string, boolean>;

  metadata?: Record<string, unknown> | null;

  effectiveFrom: Date;

  effectiveTo?: Date | null;

  createdAt: Date;

  updatedAt: Date;
}

export interface PricingPlanListResponse {
  data: PricingPlanResponse[];

  total: number;

  page: number;

  limit: number;

  totalPages: number;
}
