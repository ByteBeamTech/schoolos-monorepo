import { AddonStatus } from '@prisma/client';

export const TenantAddonDefaults = {
  PAGE: 1,
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  DEFAULT_QUANTITY: 1,
} as const;

export const TenantAddonErrors = {
  NOT_FOUND: 'Tenant addon not found.',
  ALREADY_ACTIVE: 'Addon already active.',
  ALREADY_INACTIVE: 'Addon already inactive.',
  INVALID_QUANTITY: 'Quantity must be greater than zero.',
} as const;

export const TenantAddonEvents = {
  CREATED: 'commercial.tenant-addon.created',
  UPDATED: 'commercial.tenant-addon.updated',
  ACTIVATED: 'commercial.tenant-addon.activated',
  DEACTIVATED: 'commercial.tenant-addon.deactivated',
  REMOVED: 'commercial.tenant-addon.removed',
} as const;

export const ActiveAddonStatuses: AddonStatus[] = [
  AddonStatus.ACTIVE,
];

export const TenantAddonSearch = {
  SEARCHABLE_FIELDS: [
    'notes',
  ] as const,
} as const;

export const TenantAddonSorting = {
  DEFAULT_SORT_FIELD: 'createdAt',

  DEFAULT_SORT_ORDER: 'desc' as const,

  ALLOWED_FIELDS: [
    'createdAt',
    'updatedAt',
    'startsAt',
    'endsAt',
    'quantity',
    'status',
  ] as const,
} as const;
