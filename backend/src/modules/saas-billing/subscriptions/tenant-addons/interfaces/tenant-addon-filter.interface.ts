import { AddonStatus } from '@prisma/client';

export interface TenantAddonFilter {
  status?: AddonStatus;
}
