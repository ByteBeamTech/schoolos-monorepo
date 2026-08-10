// frontend/src/lib/billing/billing-run.ts
//
// Phase 4 (backend/src/modules/student-billing/billing-run/), plus the
// additive GET /billing/runs list endpoint. Types match the real
// BillingRun/BillingRunAttempt Prisma models and controller response
// shapes exactly -- read directly from the backend before writing this
// file, not assumed. No calculation logic here, matching
// late-fee-rule.ts's own convention -- trigger/execute/retry all just
// call the real backend endpoints.

import { apiClient } from "@/lib/api";

export type BillingRunStatus  = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "PARTIALLY_COMPLETED" | "FAILED";
export type BillingRunTrigger = "SCHEDULED" | "MANUAL";
export type AttemptStatus     = "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED";

export interface BillingRun {
  id: string;
  tenantId: string;
  branchId: string;
  periodLabel: string;
  status: BillingRunStatus;
  triggeredBy: BillingRunTrigger;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  createdById: string | null;
}

// GET /billing/runs/:id's own shape -- BillingRun plus attemptCounts,
// which findAll's list rows do NOT carry (confirmed against the real
// service: findAll returns bare BillingRun rows, only findById joins in
// the groupBy counts).
export interface BillingRunDetail extends BillingRun {
  attemptCounts: Partial<Record<AttemptStatus, number>>;
}

export interface BillingRunAttempt {
  id: string;
  tenantId: string;
  billingRunId: string;
  studentId: string;
  feePlanId: string | null;
  status: AttemptStatus;
  retryCount: number;
  errorMessage: string | null;
  invoiceId: string | null;
  completedAt: string | null;
}

export interface PaginatedBillingRuns {
  data: BillingRun[];
  meta: { total: number; page: number; limit: number; lastPage: number };
}

export interface TriggerBillingRunInput {
  periodMonth: number;
  periodYear: number;
}

export async function listBillingRuns(page = 1, limit = 20): Promise<PaginatedBillingRuns> {
  const res = await apiClient.get(`/billing/runs?page=${page}&limit=${limit}`);
  return res.data;
}

export async function getBillingRun(id: string): Promise<BillingRunDetail> {
  const res = await apiClient.get(`/billing/runs/${id}`);
  return res.data;
}

export async function getBillingRunAttempts(id: string, status?: AttemptStatus): Promise<BillingRunAttempt[]> {
  const res = await apiClient.get(`/billing/runs/${id}/attempts${status ? `?status=${status}` : ""}`);
  return res.data;
}

export async function triggerBillingRun(input: TriggerBillingRunInput): Promise<BillingRun> {
  const res = await apiClient.post("/billing/runs", input);
  return res.data;
}

export async function executeBillingRun(id: string): Promise<BillingRun> {
  const res = await apiClient.post(`/billing/runs/${id}/execute`);
  return res.data;
}

export async function retryFailedAttempts(id: string): Promise<BillingRun> {
  const res = await apiClient.post(`/billing/runs/${id}/retry-failed`);
  return res.data;
}

// ── Presentation helpers -- pure formatting, no business logic, matching
// late-fee-rule.ts's own separation (calculation stays server-side; this
// file only ever describes how to label what the server already returned).

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function monthOptions(): { value: number; label: string }[] {
  return MONTH_NAMES.map((label, i) => ({ value: i + 1, label }));
}

export function statusVariant(status: BillingRunStatus): "success" | "warning" | "error" | "info" | "neutral" {
  switch (status) {
    case "COMPLETED": return "success";
    case "PARTIALLY_COMPLETED": return "warning";
    case "FAILED": return "error";
    case "IN_PROGRESS": return "info";
    case "PENDING": default: return "neutral";
  }
}

export function attemptStatusVariant(status: AttemptStatus): "success" | "warning" | "error" | "info" | "neutral" {
  switch (status) {
    case "SUCCEEDED": return "success";
    case "FAILED": return "error";
    case "PROCESSING": return "info";
    case "PENDING": default: return "neutral";
  }
}
