"use client";
// frontend/src/components/billing/AllocationPreview.tsx
//
// FDD Section 12.5 -- Allocation Preview. FR-ALLOC-01: appears once two or
// more periods are selected. FR-ALLOC-02: oldest-first application shown
// explicitly.

import { fmt } from "@/lib/format";
import type { AllocationResult } from "@/lib/billing/allocation";

export function AllocationPreview({ allocation }: { allocation: AllocationResult }) {
  const lines = allocation.lines.filter((l) => l.applied > 0);
  if (lines.length < 2) return null; // FR-ALLOC-01: only when 2+ periods actually received money

  return (
    <div className="rounded-lg border bg-slate-50 px-4 py-3" style={{ borderColor: "var(--border-light)" }}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Allocation Preview</p>
      <div className="space-y-1 text-sm">
        {lines.map((line) => (
          <div key={line.invoiceId} className="flex justify-between">
            <span style={{ color: "var(--text-primary)" }}>{line.label}</span>
            <span className={line.fullyCovered ? "text-slate-600" : "text-amber-600 font-medium"}>
              {fmt(line.applied)} of {fmt(line.periodRemaining)}
              {!line.fullyCovered && " (partial — " + fmt(line.periodRemaining - line.applied) + " remaining)"}
              {line.fullyCovered && " (paid in full)"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
