export type PricingModel = 'PER_STUDENT' | 'SUBSCRIPTION' | 'HYBRID';
export type SubscriptionTier = 'STARTER' | 'GROWTH' | 'PRO' | 'ENTERPRISE';
export type Currency = 'USD' | 'INR' | 'GBP' | 'EUR' | 'AED';
export type Region = 'GLOBAL' | 'IN' | 'US' | 'EU' | 'UK';
export type BillingStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export interface CreatePricingPlanDto {
    name: string;
    tier: SubscriptionTier;
    model: PricingModel;
    currency: Currency;
    region: Region;
    billingCycleMonths: number;
    trialDays: number;
    prorateEnabled: boolean;
    overageEnabled: boolean;
    features: string[];
    perStudentRate?: number;
    baseFee?: number;
    studentCap?: number;
    overageRate?: number;
}
export interface UpdatePricingPlanDto extends Partial<CreatePricingPlanDto> {
}
export interface PricingPlan extends CreatePricingPlanDto {
    id: string;
    status: BillingStatus;
    createdAt: string;
    updatedAt: string;
}
export interface CalculateBillRequest {
    planId: string;
    studentCount: number;
    customPerStudentRate?: number;
    customBaseFee?: number;
}
export interface BillBreakdownItem {
    label: string;
    amount: number;
}
export interface CalculateBillResponse {
    planId: string;
    currency: Currency;
    breakdown: BillBreakdownItem[];
    total: number;
}
export interface ListPricingPlansRequest {
    model?: PricingModel;
    tier?: SubscriptionTier;
    region?: Region;
    status?: BillingStatus;
}
//# sourceMappingURL=pricing.d.ts.map