"use client";
// frontend/src/components/billing/ReceiptCard.tsx
//
// FDD Section 13.3/13.4 (wireframes), 13.6 (header/student/invoice
// links/event history). Reused by both the immediate post-collect outcome
// (Collect Fee page) and the standalone Receipt Detail route -- one
// component, two entry points, so the visual treatment can never drift
// between "just collected" and "viewed later."

import { fmt, fmtDateTime } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/billing/payment-method";

export interface ReceiptCardData {
  receiptId: string;
  receiptNumber: string;
  amount: number;
  method?: string;
  paidAt?: string;
  payerLabel?: string;
  periodLabel: string;
  invoiceId: string;
  invoiceNumber: string;
  studentName?: string;
  admissionNumber?: string;
  className?: string;
  academicYear?: string;
}

interface ReceiptCardProps {
  receipt: ReceiptCardData;
  onViewInvoice: (invoiceId: string) => void;
  onPrint: (receiptId: string) => void;
  /** Smoke test finding (Scenario 9): no path existed from Receipt Detail
   *  back to the Student Financial Profile. Optional so a caller without a
   *  resolvable student id (none currently) can omit it cleanly rather
   *  than render a dead link. */
  onViewProfile?: () => void;
  /** FR-RECEIPT-07: only rendered when the caller has adjacent receipts to
   *  navigate to -- this component never assumes a sequence exists. */
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

export function ReceiptCard({
  receipt, onViewInvoice, onPrint, onViewProfile, onPrevious, onNext, hasPrevious, hasNext,
}: ReceiptCardProps) {
  const methodLabel = PAYMENT_METHODS.find((m) => m.value === receipt.method)?.label ?? receipt.method;

  return (
    <article className="receipt-card overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:rounded-none print:border-slate-300 print:shadow-none">
      {(onPrevious || onNext) && (
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-2.5 text-xs">
          <button
            onClick={onPrevious}
            disabled={!hasPrevious}
            className="print:hidden text-blue-600 hover:underline disabled:text-slate-300 disabled:no-underline"
          >
            ‹ Previous Receipt
          </button>
          <button
            onClick={onNext}
            disabled={!hasNext}
            className="print:hidden text-blue-600 hover:underline disabled:text-slate-300 disabled:no-underline"
          >
            Next Receipt ›
          </button>
        </div>
      )}

      <div className="receipt-content">
        <header className="relative overflow-hidden bg-slate-950 px-6 py-6 text-white print:bg-slate-950">
          <div className="absolute -right-10 -top-16 h-40 w-40 rounded-full bg-blue-500/20" />
          <div className="relative flex items-start justify-between gap-6">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500 text-lg font-bold">S</span>
                <div>
                  <p className="text-lg font-bold tracking-tight">SchoolOS</p>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">School management platform</p>
                </div>
              </div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-blue-300">Official fee receipt</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-lg font-bold">{receipt.receiptNumber}</p>
              <p className="mt-1 text-xs text-slate-400">{fmtDateTime(receipt.paidAt)}</p>
            </div>
          </div>
        </header>

        <div className="space-y-5 px-6 py-6">
          <div className="flex items-end justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Amount received</p>
              <p className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{fmt(receipt.amount)}</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              ✓ Payment successful
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <ReceiptField label="Student" value={receipt.studentName ?? "Student"} />
            <ReceiptField label="Admission no." value={receipt.admissionNumber ?? "—"} />
            <ReceiptField label="Fee period" value={receipt.periodLabel} />
            <ReceiptField label="Academic year" value={receipt.academicYear ?? "—"} />
            <ReceiptField label="Payment method" value={methodLabel ?? "—"} />
            <ReceiptField label="Invoice" value={receipt.invoiceNumber} />
          </div>

          {receipt.payerLabel && (
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
              <span className="text-xs text-slate-400">Paid by</span>
              <p className="mt-0.5 font-medium text-slate-800">{receipt.payerLabel}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 print:hidden">
            <button onClick={() => onViewInvoice(receipt.invoiceId)} className="text-xs font-medium text-blue-600 hover:underline">
              View invoice →
            </button>
            {onViewProfile && (
              <button onClick={onViewProfile} className="text-xs font-medium text-blue-600 hover:underline">
                Student profile →
              </button>
            )}
          </div>
        </div>

        <footer className="border-t border-dashed border-slate-200 bg-slate-50 px-6 py-4 text-xs text-slate-500">
          <div className="flex items-center justify-between gap-4">
            <span>This is a computer-generated receipt.</span>
            <span className="font-mono text-[10px] text-slate-400">ID {receipt.receiptId}</span>
          </div>
        </footer>

        <button
          onClick={() => onPrint(receipt.receiptId)}
          className="print:hidden mx-6 mb-5 text-sm font-medium text-blue-600 hover:underline"
        >
          Print receipt
        </button>
        {/* FDD Section 25 / prior review: no receipt-PDF network route
            exists today (ReceiptService.getReceiptUrl() has no controller)
            -- Download is deliberately omitted rather than shown as a dead
            button. Print uses the browser's own print of this card. */}
      </div>
    </article>
  );
}

function ReceiptField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 font-medium text-slate-800">{value}</p>
    </div>
  );
}
