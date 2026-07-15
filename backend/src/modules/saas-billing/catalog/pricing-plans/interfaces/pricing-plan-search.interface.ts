import { PricingPlanFilter } from './pricing-plan-filter.interface';

export interface PricingPlanSearch {
  page?: number;

  limit?: number;

  search?: string;

  sortBy?: string;

  sortOrder?: 'asc' | 'desc';

  filters?: PricingPlanFilter;
}
