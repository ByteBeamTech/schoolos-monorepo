// frontend/src/lib/billing/late-fee-rule.ts
//
// Late Fee Module FDD v2 Section 6.2 / Implementation Roadmap v2 Sprint 4.
//
// Deliberately contains NO calculation logic. The live "what would this
// charge" preview calls POST /billing/late-fees/rules/preview directly --
// the roadmap's own redesign, closing the exact drift-risk finding from
// its review: v1 of this plan would have mirrored calculateLateFee()'s
// formula in TypeScript on the client, a second implementation of the
// same math that could silently disagree with the real one over time.
// There is exactly one implementation of this formula anywhere in the
// system (backend/src/modules/student-billing/late-fee/late-fee.service.ts's
// calculateLateFee()) -- this file only ever calls it over the network.

import { apiClient } from "@/lib/api";

export type LateFeeCalculationMethod = "FLAT" | "PERCENTAGE" | "SLAB";
export type LateFeePenaltyType = "FLAT" | "PERCENTAGE";

export interface LateFeeRule {
  id: string;
  tenantId: string;
  branchId: string | null;
  feePlanId: string | null;
  calculationMethod: LateFeeCalculationMethod;
  penaltyType: LateFeePenaltyType;
  penaltyValue: number;
  gracePeriodDays: number;
  maxPenalty: number | null;
  compoundDaily: boolean;
  effectiveFrom: string;
  effectiveUntil: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateLateFeeRuleInput {
  branchId?: string;
  feePlanId?: string;
  calculationMethod: LateFeeCalculationMethod;
  penaltyType: LateFeePenaltyType;
  penaltyValue: number;
  gracePeriodDays: number;
  maxPenalty?: number;
  compoundDaily?: boolean;
}

export interface PreviewLateFeeInput {
  penaltyType: LateFeePenaltyType;
  penaltyValue: number;
  gracePeriodDays: number;
  maxPenalty?: number;
  compoundDaily?: boolean;
  dueAmount: number;
  daysOverdue: number;
}

export interface PreviewLateFeeResult {
  lateFee: number;
  daysOverdue: number;
}

/**
 * FDD Section 6.2: computed server-side, via the real calculateLateFee(),
 * every time -- never cached client-side across different input values,
 * so what a school sees while configuring a rule always matches exactly
 * what the engine will actually charge.
 */
export async function previewLateFeeRule(input: PreviewLateFeeInput): Promise<PreviewLateFeeResult> {
  const res = await apiClient.post("/billing/late-fees/rules/preview", input);
  return res.data;
}

export interface LateFeeWaiver {
  id: string;
  lateFeeId: string;
  amount: number;
  waivedById: string;
  waivedAt: string;
  reason: string;
}
