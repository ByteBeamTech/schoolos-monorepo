"use client";
// frontend/src/app/dashboard/(finance)/billing/collect-fee/page.tsx
//
// FDD Section 12 (Collect Fee) + Section 13 (Receipt Detail, immediate
// post-collect entry point). Sprint 3 adds the real outcome experience,
// replacing Sprint 2's minimal interim display.

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { StudentSearch } from "@/components/billing/StudentSearch";
import { StudentSummaryCard } from "@/components/billing/StudentSummaryCard";
import { DueUpcomingPaidSections } from "@/components/billing/DueUpcomingPaidSections";
import { PaymentPanel } from "@/components/billing/PaymentPanel";
import { ReceiptCard, type ReceiptCardData } from "@/components/billing/ReceiptCard";
import { useStudentBilling, useStudent, type Student } from "@/lib/hooks";
import { groupFeePeriods, computeOutstandingSummary, type FeePeriod } from "@/lib/billing/fee-period";
import { submitCollection, type CollectionInput, type CollectionResult } from "@/lib/billing/collect";
import type { AllocationLine } from "@/lib/billing/allocation";
import { useToast } from "@/lib/use-toast";

export default function CollectFeePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [student, setStudent] = useState<Student | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<CollectionResult | null>(null);

  // FDD Section 14.4: the Profile page's "Collect Fee" action jumps here
  // pre-loaded with a specific student, via ?studentId=. Fetched through
  // useStudent (GET /students/:id, now correctly ACCOUNTANT-accessible)
  // rather than re-running a search -- the student is already known.
  const preloadStudentId = searchParams.get("studentId") ?? undefined;
  const { data: preloadedStudent } = useStudent(student ? undefined : preloadStudentId);
  useEffect(() => {
    if (preloadedStudent && !student) {
      setStudent(preloadedStudent);
      setSelectedIds(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preloadedStudent]);

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
    router.push(`/dashboard/billing/invoices/${invoiceId}`);
  };

  const handleCollect = async (input: CollectionInput, lines: AllocationLine[]) => {
    setSubmitting(true);
    try {
      const result = await submitCollection(lines, input);
      setLastResult(result);
      if (result.allSucceeded) {
        setSelectedIds(new Set());
        refetch();
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
        refetch();
      } else {
        toast.error("Payment could not be collected. No amount was recorded.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCollectAnother = () => {
    setLastResult(null);
    setStudent(null);
    setSelectedIds(new Set());
    // FR-SEARCH-05 / FR-RECEIPT-06: StudentSearch's own autoFocus handles
    // refocus on remount -- unmounting/remounting via `student=null` above
    // is what triggers that remount.
  };

  return (
    <div className="max-w-3xl mx-auto pb-24">
      <PageHeader title="Collect Fee" showBack={false} />

      {/* FDD Section 13.3/13.4: the immediate post-collect outcome. Takes
          over the workspace rather than sitting above it -- the rest of
          the page (search, summary, sections, panel) is hidden, not just
          visually de-emphasized, matching Receipt Detail being its own
          distinct moment per the FDD, not a banner bolted onto Collect Fee. */}
      {lastResult && lastResult.anySucceeded ? (
        <CollectionOutcome
          result={lastResult}
          onViewInvoice={(id) => router.push(`/dashboard/billing/invoices/${id}`)}
          onViewProfile={() => student && router.push(`/dashboard/billing/students/${student.id}`)}
          onCollectAnother={handleCollectAnother}
        />
      ) : (
        <>
          <StudentSearch onSelect={handleSelectStudent} />

          {student && (
            <div className="mt-4 space-y-4">
              {loading ? (
                <CollectFeeLoadingSkeleton />
              ) : (
                <>
                  {lastResult && !lastResult.anySucceeded && (
                    <FailedCollectionNotice result={lastResult} />
                  )}

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
                    // permission's backend mechanism is unverified -- false
                    // is the conservative default until that's confirmed,
                    // not a final product decision made by this sprint.
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
        </>
      )}
    </div>
  );
}

/**
 * FDD Section 13.3/13.4 -- Payment Completed / N Receipt(s) Created.
 * FR-RECEIPT-04: honest about count, never disguises multiple receipts as
 * one. FR-RECEIPT-05: Print All prints every receipt card together as one
 * physical output -- print:hidden below scopes the browser's native print
 * to just this block, not the rest of the app shell.
 */
function CollectionOutcome({
  result, onViewInvoice, onViewProfile, onCollectAnother,
}: {
  result: CollectionResult;
  onViewInvoice: (invoiceId: string) => void;
  onViewProfile: () => void;
  onCollectAnother: () => void;
}) {
  const successes = result.results.filter((r) => r.status === "success");
  const receipts: ReceiptCardData[] = successes.map((r) => ({
    receiptId: r.receipt!.id,
    receiptNumber: r.receipt!.receiptNumber,
    amount: r.receipt!.amount,
    method: r.method,
    paidAt: r.receipt!.createdAt,
    payerLabel: r.payerLabel,
    periodLabel: r.label,
    invoiceId: r.invoiceId,
    invoiceNumber: r.invoiceNumber,
  }));
  const failures = result.results.filter((r) => r.status === "failed");

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Payment Completed
        </p>
        <p className="text-sm text-slate-500">
          {receipts.length === 1 ? "Receipt Created" : `${receipts.length} Receipts Created`}
        </p>
      </div>

      <div id="receipt-print-area" className="space-y-3">
        {receipts.map((r) => (
          <ReceiptCard key={r.receiptId} receipt={r} onViewInvoice={onViewInvoice} onViewProfile={onViewProfile} onPrint={() => window.print()} />
        ))}
      </div>

      {failures.length > 0 && (
        <div className="print:hidden rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {failures.length} {failures.length === 1 ? "period" : "periods"} could not be collected — reselect and retry: {failures.map((f) => f.label).join(", ")}
        </div>
      )}

      <div className="print:hidden flex gap-2">
        <button
          onClick={() => window.print()}
          className="px-3 py-1.5 rounded-md text-sm border hover:bg-slate-50"
          style={{ borderColor: "var(--border-light)" }}
        >
          {receipts.length === 1 ? "Print" : "Print All"}
        </button>
        <button
          onClick={onCollectAnother}
          className="px-3 py-1.5 rounded-md text-sm bg-blue-600 text-white hover:bg-blue-700"
        >
          Collect for another
        </button>
      </div>
    </div>
  );
}

/**
 * A total failure (zero lines succeeded) doesn't take over the workspace
 * the way a success does -- the selection and student context are still
 * live and worth keeping, since nothing was collected. Shown inline,
 * above the still-usable Payment Panel, not as a separate takeover screen.
 */
function FailedCollectionNotice({ result }: { result: CollectionResult }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      Payment could not be collected: {result.results[0]?.errorMessage ?? "Something went wrong. Please try again."}
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
