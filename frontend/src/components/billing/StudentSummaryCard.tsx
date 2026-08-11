"use client";
// frontend/src/components/billing/StudentSummaryCard.tsx
//
// FDD Section 11 (Student Summary Card) + Section 12.3.1 (Outstanding
// Summary, rendered as a distinct region directly beneath this card, per
// the Collect Fee wireframe in Section 12.3).

import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { fmt, fmtDate } from "@/lib/format";
import type { Student, DiscountSummary, FeePlanSummary } from "@/lib/hooks";
import { useFeeHeads } from "@/lib/hooks";
import { useBillingRules, billingRuleLabel } from "@/lib/billing/fee-plan-config";
import type { OutstandingSummary } from "@/lib/billing/fee-period";

interface Sibling { id: string; firstName: string; lastName: string }

interface StudentSummaryCardProps {
  student: Student;
  outstanding: OutstandingSummary;
  discounts: DiscountSummary[];
  feePlans: FeePlanSummary[];
  /** FR-SUMMARY-02: siblings sharing a linked guardian, if any. Sprint 1
   *  renders the chip when this is provided; discovering siblings itself
   *  is not part of this sprint's data-fetch scope (see collect-fee page). */
  siblings?: Sibling[];
  onSelectSibling?: (studentId: string) => void;
  onViewProfile?: () => void;
  /** FR-SUMMARY-07: Transport is a stated requirement whose backend
   *  feasibility is unverified (FDD Section 24, item 12). Passed as an
   *  optional prop so this component never assumes the data exists --
   *  omitted entirely from render when undefined, not shown as an empty
   *  placeholder. */
  transportRoute?: string;
}

export function StudentSummaryCard({
  student, outstanding, discounts, feePlans, siblings, onSelectSibling, onViewProfile, transportRoute,
}: StudentSummaryCardProps) {
  const primaryGuardian =
    student.guardianLinks?.find((l) => l.isPrimary) ??
    student.guardianLinks?.find((l) => l.relation === "FATHER") ??
    student.guardianLinks?.[0];
  const father = student.guardianLinks?.find((l) => l.relation === "FATHER")?.guardian;
  const activeDiscount = discounts[0]; // FR-SUMMARY-06: compact indicator, first active/approved discount
  const currentPlan = feePlans[0]; // FR-SUMMARY-11
  // Purely for display -- FeeItem only carries feeHeadId/billingRuleId
  // (confirmed against the real response), so the head name and
  // frequency label are joined against these separately-fetched lists.
  // This is a UI-layer lookup, not fee-plan resolution -- which plan
  // applies, and which items belong to it, is entirely the backend's
  // answer (currentPlan itself), never recomputed here.
  const { data: feeHeads } = useFeeHeads();
  const { data: billingRules } = useBillingRules();
  const feeHeadName = (id?: string | null) => feeHeads?.find((h) => h.id === id)?.name ?? "—";
  const billingRuleName = (id?: string | null) => billingRuleLabel(billingRules?.find((r) => r.id === id));

  return (
    <div className="rounded-lg border bg-white" style={{ borderColor: "var(--border-light)" }}>
      {/* Identity row */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border-light)" }}>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
              {student.firstName} {student.lastName}
            </span>
            <span className="text-sm text-slate-400">
              · {student.admissionNumber}
              {student.section && ` · Class ${student.section.class.name}-${student.section.name}`}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 flex items-center gap-3 flex-wrap">
            {father && <span>Father: {father.firstName} {father.lastName}</span>}
            {primaryGuardian?.guardian.phone && <span>{primaryGuardian.guardian.phone}</span>}
            {transportRoute && <span>Transport: {transportRoute}</span>}
            {activeDiscount && (
              <Badge variant="purple" label={activeDiscount.category?.name ?? "Discount active"} />
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {siblings && siblings.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">Siblings:</span>
              {siblings.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onSelectSibling?.(s.id)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {s.firstName} {s.lastName} ›
                </button>
              ))}
            </div>
          )}
          {onViewProfile && (
            <button
              onClick={onViewProfile}
              className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-0.5 whitespace-nowrap"
            >
              View full profile <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* FDD Section 12.3.1: Outstanding Summary */}
      <div className="px-4 py-3 flex items-center gap-6 flex-wrap text-sm">
        <div>
          <span className="text-slate-400 text-xs uppercase tracking-wide mr-1.5">Current Due</span>
          <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{fmt(outstanding.currentDue)}</span>
        </div>
        <div>
          <span className="text-slate-400 text-xs uppercase tracking-wide mr-1.5">Overdue</span>
          <span className={`font-semibold ${outstanding.overdue > 0 ? "text-red-600" : ""}`}>
            {fmt(outstanding.overdue)}
          </span>
        </div>
        <div>
          <span className="text-slate-400 text-xs uppercase tracking-wide mr-1.5">Total Outstanding</span>
          <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{fmt(outstanding.totalOutstanding)}</span>
        </div>
        {outstanding.lastPaymentAmount != null && (
          <div className="text-xs text-slate-500">
            Last Payment: {fmt(outstanding.lastPaymentAmount)} on {fmtDate(outstanding.lastPaymentDate)}
          </div>
        )}
        {currentPlan && (
          <div className="text-xs text-slate-500 space-y-1">
            <div>
              <span className="text-slate-400">Applicable Fee Plan: </span>
              <span className="font-medium text-slate-700">{currentPlan.name}</span>
            </div>
            {/* "Derived from", never "assigned to student" -- there is no
                student-level FeePlan assignment (frozen architecture).
                Uses the student's own class/section (already on the
                Student object) purely as a label for what the backend
                already resolved -- not a second resolution. */}
            {student.section && (
              <div className="text-slate-400">
                Derived from: {student.section.class.name} → {student.section.name}
              </div>
            )}
            {currentPlan.feeItems && currentPlan.feeItems.length > 0 && (
              <div className="pt-1 space-y-0.5">
                {currentPlan.feeItems.map((item) => (
                  <div key={item.id} className="flex justify-between gap-3">
                    <span>{feeHeadName(item.feeHeadId)}</span>
                    <span className="text-slate-400">{billingRuleName(item.billingRuleId)}</span>
                    <span className="font-medium text-slate-700">{fmt(Number(item.amount))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* FDD FR-OUTSTANDING-05 / FR-SUMMARY: Advance Balance deliberately
            absent -- no held-balance concept exists in the backend. Not a
            zero placeholder; the field is simply not rendered. */}
      </div>
    </div>
  );
}
