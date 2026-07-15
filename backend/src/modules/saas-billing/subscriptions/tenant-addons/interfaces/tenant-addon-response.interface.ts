import { AddonStatus } from '@prisma/client';

export interface TenantAddonResponse {
  id: string;

  tenantId: string;

  subscriptionId: string;

  addonId: string;

  quantity: number;

  unitPrice: number;

  status: AddonStatus;

  startsAt: Date;

  endsAt?: Date | null;

  notes?: string | null;

  metadata?: Record<string, unknown> | null;

  createdAt: Date;

  updatedAt: Date;
}

export interface TenantAddonListResponse {
  data: TenantAddonResponse[];

  total: number;

  page: number;

  limit: number;

  totalPages: number;
}
