// frontend/src/lib/billing/allocation.ts
//
// FDD Section 8.8 (Allocation Order: oldest-first), Section 8.9 (Allocation
// Mechanism: system-computed, never manually typed per period), Section
// 12.5 (Allocation Preview). Also the basis for the sequential
// record-offline calls in the Collect Fee page (Section 8.13: one receipt
// per invoice, since the backend accepts exactly one invoiceId per call --
// this is where that fan-out is computed, once, and reused for both the
// preview and the actual submission so they can never disagree.

import type { FeePeriod } from "./fee-period";

export interface AllocationLine {
  invoiceId: string;
  invoiceNumber: string;
  label: string;
  periodRemaining: number;
  applied: number;
  /** True when `applied` fully covers this period's remaining amount. */
  fullyCovered: boolean;
}

export interface AllocationResult {
  lines: AllocationLine[];
  totalApplied: number;
  /** Amount left over after every selected period's remaining was fully
   *  covered -- should always be 0 in a valid submission (the Payment
   *  Panel caps input at the selected total, FR-PANEL-02), kept here so a
   *  caller can assert this rather than silently drop an overage. */
  unallocated: number;
}

/**
 * Applies `amount` across `periods` oldest-due-first, capping each line at
 * that period's own remaining balance -- the exact mechanism FDD 8.8/8.9
 * describe. `periods` is expected pre-sorted oldest-first (fee-period.ts's
 * groupFeePeriods already sorts this way); this function does not re-sort,
 * so a caller passing an unsorted selection would get an unsorted
 * allocation -- deliberately not defended against here, since the one
 * caller (the Collect Fee page) always passes an already-sorted subset.
 */
export function computeAllocation(periods: FeePeriod[], amount: number): AllocationResult {
  let remaining = Math.max(0, amount);
  const lines: AllocationLine[] = [];

  for (const period of periods) {
    if (remaining <= 0) {
      lines.push({
        invoiceId: period.invoiceId, invoiceNumber: period.invoiceNumber, label: period.label,
        periodRemaining: period.remaining, applied: 0, fullyCovered: false,
      });
      continue;
    }
    const applied = Math.min(remaining, period.remaining);
    lines.push({
      invoiceId: period.invoiceId, invoiceNumber: period.invoiceNumber, label: period.label,
      periodRemaining: period.remaining, applied,
      fullyCovered: applied >= period.remaining,
    });
    remaining -= applied;
  }

  return {
    lines,
    totalApplied: Math.max(0, amount) - remaining,
    unallocated: remaining,
  };
}

/** FR-PANEL-02 / FDD Section 8.4: the hard ceiling the Amount field must
 *  never exceed -- the sum of every selected period's own remaining. */
export function selectedTotal(periods: FeePeriod[]): number {
  return periods.reduce((sum, p) => sum + p.remaining, 0);
}
