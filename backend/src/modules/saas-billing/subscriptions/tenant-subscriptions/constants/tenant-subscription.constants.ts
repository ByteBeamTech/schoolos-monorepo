import { SubscriptionStatus } from '@prisma/client';

export const TenantSubscriptionDefaults = {
  PAGE: 1,

  PAGE_SIZE: 20,

  MAX_PAGE_SIZE: 100,

  AUTO_RENEW: true,

  CURRENT: true,
} as const;

export const TenantSubscriptionLimits = {
  MAX_NOTES_LENGTH: 2000,

  MAX_CANCEL_REASON_LENGTH: 500,
} as const;

export const TenantSubscriptionErrors = {
  NOT_FOUND:
    'Subscription not found.',

  CURRENT_NOT_FOUND:
    'Current subscription not found.',

  ALREADY_CANCELLED:
    'Subscription already cancelled.',

  AUTO_RENEW_DISABLED:
    'Auto renewal is disabled.',

  TRIAL_EXPIRED:
    'Trial period has expired.',

  CANNOT_UPGRADE_CANCELLED:
    'Cancelled subscriptions cannot be upgraded.',

  CANNOT_DOWNGRADE_CANCELLED:
    'Cancelled subscriptions cannot be downgraded.',
} as const;

export const TenantSubscriptionEvents = {
  CREATED:
    'commercial.subscription.created',

  UPDATED:
    'commercial.subscription.updated',

  CANCELLED:
    'commercial.subscription.cancelled',

  RENEWED:
    'commercial.subscription.renewed',

  UPGRADED:
    'commercial.subscription.upgraded',

  DOWNGRADED:
    'commercial.subscription.downgraded',

  AUTO_RENEW_ENABLED:
    'commercial.subscription.auto-renew.enabled',

  AUTO_RENEW_DISABLED:
    'commercial.subscription.auto-renew.disabled',
} as const;

export const TenantSubscriptionCacheKeys = {
  CURRENT:
    'commercial:subscription:current',

  LIST:
    'commercial:subscription:list',
} as const;

export const ActiveSubscriptionStatuses: SubscriptionStatus[] = [
  SubscriptionStatus.TRIAL,
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.PAST_DUE,
];

export const TenantSubscriptionSearch = {
  SEARCHABLE_FIELDS: [
    'billingEmail',
    'gatewayCustomerId',
    'gatewaySubscriptionId',
  ] as const,
} as const;

export const TenantSubscriptionSorting = {
  DEFAULT_SORT_FIELD:
    'createdAt',

  DEFAULT_SORT_ORDER:
    'desc' as const,

  ALLOWED_FIELDS: [
    'createdAt',
    'updatedAt',
    'renewalDate',
    'currentPeriodEnd',
    'status',
  ] as const,
} as const;
