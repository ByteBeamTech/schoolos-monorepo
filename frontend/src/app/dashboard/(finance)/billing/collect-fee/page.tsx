"use client";
// frontend/src/app/dashboard/(finance)/billing/collect-fee/page.tsx
//
// FDD Section 12 -- Collect Fee. Sprint 1 scope only: page shell, Search,
// Student Summary Card, Due/Upcoming/Paid sections, Fee Period Card.
// Payment Panel, Allocation Preview, and Receipt Detail are explicitly out
// of scope for this sprint (later sprints, per the phased plan) -- this
// page renders a selection summary and stops there; it does not attempt a
// partial Payment Panel.
//
// FDD Section 3.1 / FR-NAV-04 (Accountant login bypasses Dashboard,
// straight to this page) is a routing/auth-flow concern outside this
// sprint's component scope -- not implemented here.

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { StudentSearch } from "@/components/billing/StudentSearch";
import { StudentSummaryCard } from "@/components/billing/StudentSummaryCard";
import { DueUpcomingPaidSections } from "@/components/billing/DueUpcomingPaidSections";
import { useStudentBilling, type Student } from "@/lib/hooks";
import { groupFeePeriods, computeOutstandingSummary } from "@/lib/billing/fee-period";
import { fmt } from "@/lib/format";

export default function CollectFeePage() {
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { invoices, discounts, feePlans, loading } = useStudentBilling(student?.id);

  const grouped = useMemo(() => groupFeePeriods(invoices), [invoices]);

  // FDD Section 12.3.1's Last Payment: most recent successful payment
  // across the student's invoices, derived client-side from data already
  // fetched -- no separate endpoint needed for this one figure.
  const lastPayment = useMemo(() => {
    const all = invoices
      .flatMap((inv) => inv.payments ?? [])
      .filter((p) => p.status === "SUCCESS" && p.paidAt)
      .sort((a, b) => new Date(b.paidAt!).getTime() - new Date(a.paidAt!).getTime());
    return all[0] ? { amount: all[0].amount, date: all[0].paidAt! } : undefined;
  }, [invoices]);

  const outstanding = useMemo(
    () => computeOutstandingSummary(grouped, lastPayment),
    [grouped, lastPayment],
  );

  const selectedTotal = useMemo(() => {
    const all = [...grouped.due, ...grouped.upcoming];
    return all.filter((p) => selectedIds.has(p.invoiceId)).reduce((sum, p) => sum + p.remaining, 0);
  }, [grouped, selectedIds]);

  const handleSelectStudent = (s: Student) => {
    setStudent(s);
    setSelectedIds(new Set()); // FR-COLLECT-04: no default selection, ever -- including on a fresh student pick
  };

  const handleViewDetails = (invoiceId: string) => {
    // FDD Section 19 (Invoice Detail) is a later sprint's page. Sprint 1
    // does not yet have a route to send this to -- logged, not silently
    // swallowed, so this gap is visible during review rather than
    // discovered later as a dead button.
    console.warn(`Invoice Detail (Section 19) not yet implemented -- invoiceId=${invoiceId}`);
  };

  return (
    <div className="max-w-3xl mx-auto pb-24">
      <PageHeader title="Collect Fee" showBack={false} />

      <StudentSearch onSelect={handleSelectStudent} />

      {student && (
        <div className="mt-4 space-y-4">
          {loading ? (
            <CollectFeeLoadingSkeleton />
          ) : (
            <>
              <StudentSummaryCard
                student={student}
                outstanding={outstanding}
                discounts={discounts}
                feePlans={feePlans}
                onViewProfile={() => router.push(`/dashboard/billing/students/${student.id}`)}
              />

              <DueUpcomingPaidSections
                grouped={grouped}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                onViewDetails={handleViewDetails}
                // FDD Section 8.10 / Section 24 item 7: advance-payment
                // permission's backend mechanism is unverified -- false is
                // the conservative default until that's confirmed, not a
                // final product decision made by this sprint.
                advancePaymentAllowed={false}
              />

              {/* Sprint 1 stops here. Payment Panel (FDD Section 12.6),
                  Allocation Preview (12.5), and Receipt Detail (13) are
                  later-sprint work -- this is a plain summary, not a
                  partial implementation of any of those. */}
              {selectedIds.size > 0 && (
                <div
                  className="rounded-lg border bg-slate-50 px-4 py-3 text-sm flex items-center justify-between"
                  style={{ borderColor: "var(--border-light)" }}
                >
                  <span className="text-slate-500">
                    {selectedIds.size} {selectedIds.size === 1 ? "period" : "periods"} selected — {fmt(selectedTotal)}
                  </span>
                  <span className="text-xs text-slate-400">Payment Panel — Sprint 2</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CollectFeeLoadingSkeleton() {
  // FR-STATE-01: explicit skeleton for the student card and Due/Upcoming/
  // Paid sections during the post-search fetch window -- never a flash of
  // empty layout.
  return (
    <div className="space-y-4">
      <div className="h-24 rounded-lg bg-slate-100 animate-pulse" />
      <div className="h-64 rounded-lg bg-slate-100 animate-pulse" />
    </div>
  );
}
