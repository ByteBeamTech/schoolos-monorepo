import { PricingModel } from '@prisma/client';

export const PricingPlanDefaults = {
  VERSION: 1,
  DISPLAY_ORDER: 0,
  TRIAL_DAYS: 30,

  PAGE: 1,
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  PUBLIC: true,
  ACTIVE: true,
  RECOMMENDED: false,
} as const;

export const PricingPlanLimits = {
  NAME_MIN_LENGTH: 3,
  NAME_MAX_LENGTH: 100,

  CODE_MIN_LENGTH: 2,
  CODE_MAX_LENGTH: 50,

  DESCRIPTION_MAX_LENGTH: 1000,

  MAX_BRANCH_LIMIT: 10000,
  MAX_STAFF_LIMIT: 100000,
  MAX_STORAGE_GB: 10240,
} as const;

export const PricingPlanErrors = {
  NOT_FOUND: 'Pricing plan not found.',
  CODE_EXISTS: 'Pricing plan code already exists.',
  NAME_EXISTS: 'Pricing plan name already exists.',

  PLAN_ARCHIVED: 'Pricing plan has been archived.',
  PLAN_ALREADY_ACTIVE: 'Pricing plan is already active.',
  PLAN_ALREADY_ARCHIVED: 'Pricing plan is already archived.',

  ACTIVE_SUBSCRIPTIONS:
    'Cannot archive a plan with active subscriptions.',

  PENDING_INVOICES:
    'Cannot archive a plan with pending invoices.',

  INVALID_EFFECTIVE_DATE:
    'Effective To must be greater than Effective From.',

  INVALID_PRICING_MODEL:
    'Invalid pricing model configuration.',
} as const;

export const PricingPlanEvents = {
  CREATED: 'commercial.pricing-plan.created',
  UPDATED: 'commercial.pricing-plan.updated',
  ARCHIVED: 'commercial.pricing-plan.archived',
  RESTORED: 'commercial.pricing-plan.restored',
  PUBLISHED: 'commercial.pricing-plan.published',
} as const;

export const PricingPlanCacheKeys = {
  ALL: 'commercial:plans:all',
  PUBLIC: 'commercial:plans:public',
} as const;

export const SupportedPricingModels: PricingModel[] = [
  PricingModel.FLAT_FEE,
  PricingModel.PER_STUDENT,
];

export const PricingPlanSorting = {
  DEFAULT_SORT_FIELD: 'displayOrder',
  DEFAULT_SORT_ORDER: 'asc',

  ALLOWED_SORT_FIELDS: [
    'displayOrder',
    'name',
    'code',
    'createdAt',
    'updatedAt',
  ] as const,
} as const;

export const PricingPlanSearch = {
  SEARCHABLE_FIELDS: [
    'name',
    'code',
    'description',
  ] as const,
} as const;
