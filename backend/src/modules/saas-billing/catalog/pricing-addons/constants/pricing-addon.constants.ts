import { BillingType } from '@prisma/client';

export const PricingAddonDefaults = {
  PAGE: 1,
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  ACTIVE: true,

  QUANTITY: 1,
} as const;

export const PricingAddonLimits = {
  NAME_MIN_LENGTH: 3,
  NAME_MAX_LENGTH: 100,

  CODE_MIN_LENGTH: 2,
  CODE_MAX_LENGTH: 50,

  DESCRIPTION_MAX_LENGTH: 1000,

  MAX_AMOUNT: 99999999,
} as const;

export const PricingAddonErrors = {
  NOT_FOUND: 'Pricing addon not found.',

  CODE_EXISTS: 'Pricing addon code already exists.',

  ALREADY_ARCHIVED:
    'Pricing addon already archived.',

  ALREADY_ACTIVE:
    'Pricing addon already active.',

  INVALID_AMOUNT:
    'Amount must be greater than zero.',

  ACTIVE_SUBSCRIPTIONS:
    'Pricing addon is attached to active subscriptions.',
} as const;

export const PricingAddonEvents = {
  CREATED: 'commercial.pricing-addon.created',

  UPDATED: 'commercial.pricing-addon.updated',

  ARCHIVED: 'commercial.pricing-addon.archived',

  RESTORED: 'commercial.pricing-addon.restored',
} as const;


export const SupportedBillingTypes: BillingType[] = [
  BillingType.ONE_TIME,
  BillingType.RECURRING,
];


export const PricingAddonSearch = {
  SEARCHABLE_FIELDS: [
    'code',
    'name',
    'description',
  ] as const,
} as const;

export const PricingAddonSorting = {
  DEFAULT_SORT_FIELD: 'createdAt',

  DEFAULT_SORT_ORDER: 'desc' as const,

  ALLOWED_FIELDS: [
    'name',
    'code',
    'amount',
    'billingType',
    'category',
    'createdAt',
    'updatedAt',
  ] as const,
} as const;
