// frontend/src/lib/billing/fee-plan-config.ts
//
// Types and API functions for BillingRule and FeePlanAssignment.
// Matches the real, current backend contract exactly -- confirmed
// directly against backend/src/modules/student-billing/billing-rules/
// and backend/src/modules/student-billing/plans/services/
// fee-plan-assignment.service.ts before writing this, not assumed.
// Follows lib/billing/billing-run.ts's established convention: no
// calculation or resolution logic here -- resolveForClassSection()
// stays entirely server-side (FeePlanAssignmentService); this file only
// ever calls the real endpoints and formats what they return.

import { apiClient } from "@/lib/api";
import { useApi } from "@/lib/hooks";

export type BillingFrequency = "ONE_TIME" | "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "ANNUAL" | "CUSTOM";
export type ProrationRule = "NO_PRORATION" | "DAILY" | "FULL_MONTH_IF_BEFORE_15TH" | "HALF_MONTH_AFTER_15TH";

export interface BillingRule {
  id: string;
  tenantId: string;
  branchId: string | null; // null = tenant-wide default, usable by every branch
  frequency: BillingFrequency;
  billingMonths: number[];
  dueDayOfMonth: number;
  prorationRule: ProrationRule;
  createdAt: string;
}

export interface CreateBillingRuleInput {
  frequency: BillingFrequency;
  billingMonths: number[];
  dueDayOfMonth: number;
  prorationRule?: ProrationRule;
  branchId?: string;
}

export async function listBillingRules(): Promise<BillingRule[]> {
  const res = await apiClient.get("/billing/billing-rules");
  return res.data;
}
export function useBillingRules() {
  return useApi<BillingRule[]>("/billing/billing-rules", []);
}

export async function createBillingRule(input: CreateBillingRuleInput): Promise<BillingRule> {
  const res = await apiClient.post("/billing/billing-rules", input);
  return res.data;
}

// Real, current label -- BillingRule has no name field (frozen Phase 2
// design, confirmed -- see billing-rule.service.ts's own header
// comment), so "Monthly"/"Annual" etc. is derived from frequency here,
// not stored anywhere. Pure presentation, not a resolution decision.
const FREQUENCY_LABELS: Record<BillingFrequency, string> = {
  ONE_TIME: "One-Time", MONTHLY: "Monthly", QUARTERLY: "Quarterly",
  HALF_YEARLY: "Half-Yearly", ANNUAL: "Annual", CUSTOM: "Custom",
};
export function billingRuleLabel(rule: BillingRule | undefined | null): string {
  return rule ? FREQUENCY_LABELS[rule.frequency] : "—";
}

// ── FeePlanAssignment ────────────────────────────────────────────────────

export interface FeePlanAssignment {
  id: string;
  tenantId: string;
  branchId: string;
  sessionId: string;
  feePlanId: string;
  classId: string;
  sectionId: string | null; // null = class-wide/default; set = section-specific override
  createdAt: string;
  createdById: string | null;
}

export interface CreateFeePlanAssignmentInput {
  sessionId: string;
  feePlanId: string;
  classId: string;
  sectionId?: string; // omit/undefined = class-wide
}

export async function listFeePlanAssignments(sessionId?: string): Promise<FeePlanAssignment[]> {
  const res = await apiClient.get(`/billing/fee-plans/assignments${sessionId ? `?sessionId=${sessionId}` : ""}`);
  return res.data;
}
export function useFeePlanAssignments(sessionId?: string) {
  return useApi<FeePlanAssignment[]>(
    `/billing/fee-plans/assignments${sessionId ? `?sessionId=${sessionId}` : ""}`,
    [sessionId],
  );
}

export async function createFeePlanAssignment(input: CreateFeePlanAssignmentInput): Promise<FeePlanAssignment> {
  const res = await apiClient.post("/billing/fee-plans/assignments", input);
  return res.data;
}

// ── FeeItem create / supersede ───────────────────────────────────────────
// Real DTOs, confirmed directly (backend/src/modules/student-billing/
// dto/billing.dto.ts) -- feeHeadId and billingRuleId are both required
// on write. No new fields invented.

export interface CreateFeeItemInput {
  name: string;
  amount: number;
  feeHeadId: string;
  billingRuleId: string;
  isOptional?: boolean;
  dueDate?: string;
  gstRate?: number;
  gstCode?: string;
  sortOrder?: number;
}

export async function createFeeItem(feePlanId: string, input: CreateFeeItemInput) {
  const res = await apiClient.post(`/billing/fee-plans/${feePlanId}/fee-items`, input);
  return res.data;
}

export interface SupersedeFeeItemInput {
  name: string;
  amount: number;
  feeHeadId: string; // must match the existing item's feeHeadId -- the
                      // backend rejects a mismatch (a supersede revises
                      // amount/rule, changing the head means a new item)
  billingRuleId: string;
  isOptional?: boolean;
  dueDate?: string;
  gstRate?: number;
  gstCode?: string;
  sortOrder?: number;
}

export async function supersedeFeeItem(feeItemId: string, input: SupersedeFeeItemInput) {
  const res = await apiClient.patch(`/billing/fee-plans/fee-items/${feeItemId}/supersede`, input);
  return res.data;
}

// ── Fee Plan create (bare -- no items) ───────────────────────────────────

export interface CreateFeePlanInput {
  name: string;
  sessionId: string;
  academicYear: string;
  description?: string;
  grade?: string;
  currency?: string;
}

export async function createFeePlan(input: CreateFeePlanInput) {
  const res = await apiClient.post("/billing/fee-plans", input);
  return res.data;
}
