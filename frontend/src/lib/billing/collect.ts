// frontend/src/lib/billing/collect.ts
//
// FDD Section 8.13 / FR-RECEIPT-04: one record-offline call per invoice --
// a direct, verified mechanical consequence of the backend accepting
// exactly one invoiceId per call, not a UI choice.
//
// Partial-failure handling below is not spelled out by an explicit FR-ID
// in the frozen FDD, but follows directly from its own principles (Section
// 7: "Safe" and "Honest, not simplified") and from a real constraint: the
// backend has no cross-invoice atomicity, so a multi-period collection is
// genuinely N independent transactions, not one. If the second of three
// calls fails, money has already moved for the first -- the UI must never
// imply otherwise. Calls run sequentially, not in parallel, specifically
// so a failure partway through leaves a clean, known boundary (which
// periods succeeded) rather than a race between concurrent requests
// against the same student.

import { apiClient } from "@/lib/api";
import type { AllocationLine } from "./allocation";
import type { OfflinePaymentMethod } from "./payment-method";

export interface CollectionInput {
  method: OfflinePaymentMethod;
  referenceNumber?: string;
  payerId?: string;
  payerName?: string;
  /** Display-only -- the resolved name shown on the receipt, whether from
   *  the guardian link or the free-text field. Distinct from payerId/
   *  payerName above, which are what's actually sent to the backend. */
  payerLabel?: string;
}

export interface CollectionLineResult {
  invoiceId: string;
  invoiceNumber: string;
  label: string;
  amount: number;
  method: string;
  payerLabel?: string;
  status: "success" | "failed";
  payment?: { id: string };
  receipt?: { id: string; receiptNumber: string; amount: number; createdAt: string };
  errorMessage?: string;
}

export interface CollectionResult {
  results: CollectionLineResult[];
  allSucceeded: boolean;
  anySucceeded: boolean;
}

function extractErrorMessage(err: unknown): string {
  const e = err as any;
  // Smoke test finding (Scenario 10): the backend's real 403 message is
  // internal-sounding ("Access denied. Required: X or Y. Your role: Z") --
  // functional, but not the human-readable translation FR-ERR-01 calls
  // for. Detected by status code, not by matching the message text, so
  // this doesn't silently break if the backend's wording changes.
  if (e?.response?.status === 403) {
    return "You don't have permission to collect this fee. Contact your administrator if you believe this is a mistake.";
  }
  return e?.response?.data?.message ?? e?.message ?? "Something went wrong. Please try again.";
}

/**
 * Submits one record-offline call per allocation line, in sequence.
 * Deliberately does not stop at the first failure and does not roll back
 * prior successes (there is nothing to roll back -- each call already
 * committed on the backend). Every line's outcome is reported individually
 * so the caller can render exactly what happened, never a false "all or
 * nothing" summary.
 */
export async function submitCollection(
  lines: AllocationLine[],
  input: CollectionInput,
): Promise<CollectionResult> {
  const results: CollectionLineResult[] = [];

  for (const line of lines) {
    if (line.applied <= 0) continue; // a period the allocation didn't reach (amount exhausted before it)

    try {
      const res = await apiClient.post("/billing/payments/record-offline", {
        invoiceId: line.invoiceId,
        amount: line.applied,
        paymentMethod: input.method,
        referenceNumber: input.referenceNumber || undefined,
        payerId: input.payerId || undefined,
        payerName: input.payerName || undefined,
      });
      results.push({
        invoiceId: line.invoiceId, invoiceNumber: line.invoiceNumber, label: line.label, amount: line.applied,
        method: input.method, payerLabel: input.payerLabel,
        status: "success", payment: res.data.payment, receipt: res.data.receipt,
      });
    } catch (err) {
      results.push({
        invoiceId: line.invoiceId, invoiceNumber: line.invoiceNumber, label: line.label, amount: line.applied,
        method: input.method, payerLabel: input.payerLabel,
        status: "failed", errorMessage: extractErrorMessage(err),
      });
    }
  }

  return {
    results,
    allSucceeded: results.length > 0 && results.every((r) => r.status === "success"),
    anySucceeded: results.some((r) => r.status === "success"),
  };
}
