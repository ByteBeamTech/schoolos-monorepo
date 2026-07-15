import { PricingAddonFilter } from './pricing-addon-filter.interface';

export interface PricingAddonSearch {
  page?: number;

  limit?: number;

  search?: string;

  sortBy?: string;

  sortOrder?: 'asc' | 'desc';

  filters?: PricingAddonFilter;
}
