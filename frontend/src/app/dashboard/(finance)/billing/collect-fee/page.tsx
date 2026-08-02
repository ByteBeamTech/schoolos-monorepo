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
import { PaymentPanel } from "@/components/billing/PaymentPanel";
import { useStudentBilling, type Student } from "@/lib/hooks";
import { groupFeePeriods, computeOutstandingSummary, type FeePeriod } from "@/lib/billing/fee-period";
import { submitCollection, type CollectionInput, type CollectionResult } from "@/lib/billing/collect";
import type { AllocationLine } from "@/lib/billing/allocation";
import { fmt, fmtDateTime } from "@/lib/format";
import { useToast } from "@/lib/use-toast";
import { CheckCircle2, XCircle } from "lucide-react";

export default function CollectFeePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [student, setStudent] = useState<Student | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<CollectionResult | null>(null);

  const { invoices, discounts, feePlans, loading, refetch } = useStudentBilling(student?.id);

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

  const selectedPeriods: FeePeriod[] = useMemo(() => {
    const all = [...grouped.due, ...grouped.upcoming];
    // FDD Section 8.8: oldest-first -- the arrays being concatenated from
    // are each already sorted that way (fee-period.ts), and Due always
    // precedes Upcoming in application order (a Due period is, by
    // definition, older than any Upcoming one).
    return all.filter((p) => selectedIds.has(p.invoiceId));
  }, [grouped, selectedIds]);

  const handleSelectStudent = (s: Student) => {
    setStudent(s);
    setSelectedIds(new Set()); // FR-COLLECT-04: no default selection, ever -- including on a fresh student pick
    setLastResult(null);
  };

  const handleViewDetails = (invoiceId: string) => {
    // FDD Section 19 (Invoice Detail) is a later sprint's page. Logged,
    // not silently swallowed, so this gap is visible during review.
    console.warn(`Invoice Detail (Section 19) not yet implemented -- invoiceId=${invoiceId}`);
  };

  const handleCollect = async (input: CollectionInput, lines: AllocationLine[]) => {
    setSubmitting(true);
    try {
      const result = await submitCollection(lines, input);
      setLastResult(result);
      if (result.allSucceeded) {
        toast.success(
          result.results.length === 1
            ? `Payment collected — Receipt ${result.results[0].receipt?.receiptNumber}`
            : `Payment collected — ${result.results.length} receipts created`,
        );
        setSelectedIds(new Set());
      } else if (result.anySucceeded) {
        // FDD Section 7 ("Safe", "Honest"): a genuine partial-failure case
        // -- some money already moved, some didn't. Never a generic
        // success or generic failure toast here.
        toast.error(
          `${result.results.filter((r) => r.status === "success").length} of ${result.results.length} collected. See details below for what needs retrying.`,
        );
        setSelectedIds(new Set(
          result.results.filter((r) => r.status === "failed").map((r) => r.invoiceId),
        ));
      } else {
        toast.error("Payment could not be collected. No amount was recorded.");
      }
      refetch();
    } finally {
      setSubmitting(false);
    }
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
              {lastResult && <CollectionOutcome result={lastResult} />}

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

              <PaymentPanel
                selectedPeriods={selectedPeriods}
                student={student}
                submitting={submitting}
                onCollect={handleCollect}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Interim outcome display for Sprint 2. FDD Section 13 (Receipt Detail) is
 * explicitly a later sprint's own page -- this is not that page, and does
 * not attempt its print/download/Collect-for-another affordances. It
 * exists because "the Collect action" is not meaningfully complete with
 * zero visible outcome; Sprint 3 replaces this block with the real thing.
 */
function CollectionOutcome({ result }: { result: CollectionResult }) {
  return (
    <div className="rounded-lg border bg-white px-4 py-3 space-y-2" style={{ borderColor: "var(--border-light)" }}>
      {result.results.map((r) => (
        <div key={r.invoiceId} className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            {r.status === "success"
              ? <CheckCircle2 className="w-4 h-4 text-green-600" />
              : <XCircle className="w-4 h-4 text-red-600" />}
            {r.label}
          </span>
          {r.status === "success" ? (
            <span className="text-slate-500">
              {r.receipt?.receiptNumber} · {fmt(r.amount)} · {fmtDateTime(r.receipt?.createdAt)}
            </span>
          ) : (
            <span className="text-red-600">{r.errorMessage}</span>
          )}
        </div>
      ))}
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
