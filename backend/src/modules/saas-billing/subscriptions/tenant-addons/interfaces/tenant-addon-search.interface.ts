import { TenantAddonFilter } from './tenant-addon-filter.interface';

export interface TenantAddonSearch {
  page?: number;

  limit?: number;

  search?: string;

  sortBy?: string;

  sortOrder?: 'asc' | 'desc';

  filters?: TenantAddonFilter;
}
