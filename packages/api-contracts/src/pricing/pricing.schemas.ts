import { z } from 'zod';

// --- Enums (mirror your Prisma enums exactly) --------------------------------

export const CurrencySchema = z.enum(['INR', 'USD', 'GBP', 'EUR', 'AED']);
export type Currency = z.infer<typeof CurrencySchema>;

export const RegionSchema = z.enum(['IN', 'US', 'EU', 'UK', 'GLOBAL']);
export type Region = z.infer<typeof RegionSchema>;

export const PricingModelSchema = z.enum(['PER_STUDENT', 'SUBSCRIPTION', 'HYBRID']);
export type PricingModel = z.infer<typeof PricingModelSchema>;

export const SubscriptionTierSchema = z.enum(['STARTER', 'GROWTH', 'PRO', 'ENTERPRISE']);
export type SubscriptionTier = z.infer<typeof SubscriptionTierSchema>;

export const SubscriptionStatusSchema = z.enum([
  'TRIAL',
  'ACTIVE',
  'PAST_DUE',
  'SUSPENDED',
  'CANCELLED',
]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

export const DunningStatusSchema = z.enum([
  'SCHEDULED',
  'SENT',
  'SUCCESS',
  'FAILED',
  'EXHAUSTED',
]);
export type DunningStatus = z.infer<typeof DunningStatusSchema>;

export const PaymentGatewayProviderSchema = z.enum(['RAZORPAY', 'STRIPE', 'PAYPAL']);
export type PaymentGatewayProvider = z.infer<typeof PaymentGatewayProviderSchema>;

// --- PricingPlan (mirrors your Prisma PricingPlan model) ---------------------

export const PricingPlanSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  tier: SubscriptionTierSchema,
  model: PricingModelSchema,
  currency: CurrencySchema,
  region: RegionSchema.default('GLOBAL'),
  perStudentRate: z.number().nonnegative().nullable().optional(),
  prorateEnabled: z.boolean().default(true),
  baseFee: z.number().nonnegative().nullable().optional(),
  studentLimit: z.number().int().positive().nullable().optional(),
  overageRate: z.number().nonnegative().nullable().optional(),
  overageEnabled: z.boolean().default(false),
  billingCycleMonths: z.number().int().positive().default(1), // 1=monthly, 12=annual
  trialDays: z.number().int().nonnegative().default(30),
  isActive: z.boolean().default(true),
  features: z.array(z.string()).default([]),
});
export type PricingPlan = z.infer<typeof PricingPlanSchema>;

// --- TenantSubscription (mirrors your Prisma TenantSubscription model) --------

export const TenantSubscriptionSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  planId: z.string(),
  model: PricingModelSchema,
  status: SubscriptionStatusSchema.default('TRIAL'),
  currency: CurrencySchema,
  currentPeriodStart: z.string().datetime(),
  currentPeriodEnd: z.string().datetime(),
  trialEndsAt: z.string().datetime().nullable().optional(),
  studentCountAtBilling: z.number().int().nonnegative().nullable().optional(),
  lastStudentCountDate: z.string().datetime().nullable().optional(),
  customPerStudentRate: z.number().nonnegative().nullable().optional(), // custom override
  customBaseFee: z.number().nonnegative().nullable().optional(),        // custom override
  gateway: PaymentGatewayProviderSchema.nullable().optional(),
  gatewayCustomerId: z.string().nullable().optional(),
  gatewaySubscriptionId: z.string().nullable().optional(),
  cancelledAt: z.string().datetime().nullable().optional(),
  cancelReason: z.string().nullable().optional(),
});
export type TenantSubscription = z.infer<typeof TenantSubscriptionSchema>;

// --- Billing cycle helpers ----------------------------------------------------

export type BillingCycleLabel = 'monthly' | 'annual' | 'custom';

export function getBillingCycleLabel(months: number): BillingCycleLabel {
  if (months === 1) return 'monthly';
  if (months === 12) return 'annual';
  return 'custom';
}

export function getAnnualDiscountRate(months: number): number {
  // Annual plans typically get ~15% discount vs monthly
  if (months === 12) return 0.15;
  return 0;
}

// --- Calculation Result -------------------------------------------------------

export const PricingCalculationResultSchema = z.object({
  model: PricingModelSchema,
  currency: CurrencySchema,
  billingCycleMonths: z.number().int().positive(),
  billingCycleLabel: z.enum(['monthly', 'annual', 'custom']),
  subtotal: z.number().nonnegative(),
  discountAmount: z.number().nonnegative(),
  taxAmount: z.number().nonnegative(),
  total: z.number().nonnegative(),
  breakdown: z.array(
    z.object({
      label: z.string(),
      amount: z.number(),
    }),
  ),
  studentCount: z.number().int().nonnegative().optional(),
  effectivePricePerStudent: z.number().nonnegative().optional(),
  isCustomRates: z.boolean().default(false),
});
export type PricingCalculationResult = z.infer<typeof PricingCalculationResultSchema>;

// --- DTOs ---------------------------------------------------------------------

export const CalculatePricingDtoSchema = z.object({
  planId: z.string(),
  studentCount: z.number().int().nonnegative(),
  taxPercent: z.number().min(0).max(100).optional().default(0),
  // Optional custom rate overrides (for ENTERPRISE / custom deals)
  customPerStudentRate: z.number().nonnegative().optional(),
  customBaseFee: z.number().nonnegative().optional(),
});
export type CalculatePricingDto = z.infer<typeof CalculatePricingDtoSchema>;

export const AssignPricingDtoSchema = z.object({
  tenantId: z.string(),
  planId: z.string(),
  gateway: PaymentGatewayProviderSchema,
  trialDays: z.number().int().nonnegative().optional(),
  customPerStudentRate: z.number().nonnegative().optional(),
  customBaseFee: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});
export type AssignPricingDto = z.infer<typeof AssignPricingDtoSchema>;

export const CreatePricingPlanDtoSchema = z.object({
  name: z.string().min(1),
  tier: SubscriptionTierSchema,
  model: PricingModelSchema,
  currency: CurrencySchema,
  region: RegionSchema.optional().default('GLOBAL'),
  perStudentRate: z.number().nonnegative().optional(),
  baseFee: z.number().nonnegative().optional(),
  studentLimit: z.number().int().positive().optional(),
  overageRate: z.number().nonnegative().optional(),
  overageEnabled: z.boolean().optional().default(false),
  billingCycleMonths: z.number().int().positive().default(1),
  trialDays: z.number().int().nonnegative().default(30),
  prorateEnabled: z.boolean().default(true),
  features: z.array(z.string()).default([]),
});
export type CreatePricingPlanDto = z.infer<typeof CreatePricingPlanDtoSchema>;