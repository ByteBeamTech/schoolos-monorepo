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
}

interface ReceiptCardProps {
  receipt: ReceiptCardData;
  onViewInvoice: (invoiceId: string) => void;
  onPrint: (receiptId: string) => void;
  /** FR-RECEIPT-07: only rendered when the caller has adjacent receipts to
   *  navigate to -- this component never assumes a sequence exists. */
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

export function ReceiptCard({
  receipt, onViewInvoice, onPrint, onPrevious, onNext, hasPrevious, hasNext,
}: ReceiptCardProps) {
  const methodLabel = PAYMENT_METHODS.find((m) => m.value === receipt.method)?.label ?? receipt.method;

  return (
    <div className="rounded-lg border bg-white" style={{ borderColor: "var(--border-light)" }}>
      {(onPrevious || onNext) && (
        <div className="flex items-center justify-between px-4 py-2 border-b text-xs" style={{ borderColor: "var(--border-light)" }}>
          <button
            onClick={onPrevious}
            disabled={!hasPrevious}
            className="text-blue-600 hover:underline disabled:text-slate-300 disabled:no-underline"
          >
            ‹ Previous Receipt
          </button>
          <button
            onClick={onNext}
            disabled={!hasNext}
            className="text-blue-600 hover:underline disabled:text-slate-300 disabled:no-underline"
          >
            Next Receipt ›
          </button>
        </div>
      )}

      <div className="px-4 py-4 space-y-3">
        <div>
          <p className="font-semibold" style={{ color: "var(--text-primary)" }}>Receipt {receipt.receiptNumber}</p>
          <p className="text-sm text-slate-500 mt-0.5">
            {fmt(receipt.amount)}{methodLabel ? ` · ${methodLabel}` : ""} · {fmtDateTime(receipt.paidAt)}
          </p>
          {receipt.payerLabel && <p className="text-sm text-slate-500">Paid by: {receipt.payerLabel}</p>}
        </div>

        <div className="text-sm">
          <span className="text-slate-400">For: </span>
          <span style={{ color: "var(--text-primary)" }}>{receipt.periodLabel}</span>
          <button
            onClick={() => onViewInvoice(receipt.invoiceId)}
            className="ml-2 text-blue-600 hover:underline text-xs"
          >
            › View Invoice ({receipt.invoiceNumber})
          </button>
        </div>

        {/* FR-RECEIPT-08: creation only -- print/reprint events are not
            tracked by the backend today, so none are fabricated here. */}
        <div className="text-xs text-slate-400 border-t pt-2" style={{ borderColor: "var(--border-light)" }}>
          Created {fmtDateTime(receipt.paidAt)}
        </div>

        <button
          onClick={() => onPrint(receipt.receiptId)}
          className="text-sm text-blue-600 hover:underline"
        >
          Print
        </button>
        {/* FDD Section 25 / prior review: no receipt-PDF network route
            exists today (ReceiptService.getReceiptUrl() has no controller)
            -- Download is deliberately omitted rather than shown as a dead
            button. Print uses the browser's own print of this card. */}
      </div>
    </div>
  );
}
