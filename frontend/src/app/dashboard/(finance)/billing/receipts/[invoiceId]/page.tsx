"use client";
// frontend/src/app/dashboard/(finance)/billing/receipts/[invoiceId]/page.tsx
//
// FDD Section 13 -- Receipt Detail, standalone/durable entry point (as
// distinct from the immediate post-collect view on the Collect Fee page
// itself, which doesn't need a fetch since it already has everything in
// memory). Keyed by invoiceId, not receiptId: no GET /billing/receipts/:id
// endpoint exists on the backend (confirmed by search, no controller at
// all) -- GET /billing/invoices/:id is the only real, fetchable anchor
// that includes receipt data.

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { ReceiptCard, type ReceiptCardData } from "@/components/billing/ReceiptCard";
import { useInvoice, useInvoices } from "@/lib/hooks";
import { deriveLabel } from "@/lib/billing/fee-period";

export default function ReceiptDetailPage() {
  const params = useParams<{ invoiceId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const requestedReceiptId = searchParams.get("receipt") ?? undefined;

  const { data: invoice, loading } = useInvoice(params.invoiceId);
  // For Previous/Next (FR-RECEIPT-07): the student's other invoices, only
  // fetched once we know who the student is. A student with many invoices
  // pays a second round trip here -- accepted for Sprint 3; a future
  // sprint could avoid it if this page is reached with student context
  // already in memory (e.g. from Collect Fee), but a standalone/refreshed
  // visit has no such context to rely on.
  const { data: siblingInvoices } = useInvoices({ studentId: invoice?.student.id });

  const allReceipts: ReceiptCardData[] = useMemo(() => {
    const source = siblingInvoices ?? (invoice ? [invoice] : []);
    return source
      .flatMap((inv) =>
        (inv.receipts ?? []).map((r) => {
          const payment = inv.payments?.find((p) => p.id === r.paymentId);
          return {
            receiptId: r.id,
            receiptNumber: r.receiptNumber,
            amount: r.amount,
            method: payment?.paymentMethod,
            paidAt: payment?.paidAt ?? r.createdAt,
            // Honest fallback: a free-text payer name is shown directly;
            // a guardian-linked payment has no resolvable name from this
            // fetch alone (Invoice.student doesn't include guardianLinks)
            // -- "Guardian" is a deliberate, generic placeholder, not a
            // fabricated name.
            payerLabel: payment?.payerName ?? (payment?.payerId ? "Guardian" : undefined),
            periodLabel: deriveLabel(inv),
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
          };
        }),
      )
      .sort((a, b) => new Date(b.paidAt ?? 0).getTime() - new Date(a.paidAt ?? 0).getTime());
  }, [siblingInvoices, invoice]);

  const currentIndex = useMemo(() => {
    if (requestedReceiptId) {
      const idx = allReceipts.findIndex((r) => r.receiptId === requestedReceiptId);
      if (idx >= 0) return idx;
    }
    // Default: the most recent receipt on THIS invoice specifically.
    return allReceipts.findIndex((r) => r.invoiceId === params.invoiceId);
  }, [allReceipts, requestedReceiptId, params.invoiceId]);

  const current = currentIndex >= 0 ? allReceipts[currentIndex] : undefined;

  const navigateTo = (index: number) => {
    const target = allReceipts[index];
    if (!target) return;
    router.push(`/dashboard/billing/receipts/${target.invoiceId}?receipt=${target.receiptId}`);
  };

  return (
    <div className="max-w-xl mx-auto">
      <PageHeader title="Receipt" />
      {loading ? (
        <div className="h-48 rounded-lg bg-slate-100 animate-pulse" />
      ) : !current ? (
        <p className="text-sm text-slate-400 text-center py-12">Receipt not found.</p>
      ) : (
        <ReceiptCard
          receipt={current}
          onViewInvoice={(id) => router.push(`/dashboard/billing/invoices/${id}`)}
          onViewProfile={() => invoice && router.push(`/dashboard/billing/students/${invoice.student.id}`)}
          onPrint={() => window.print()}
          onPrevious={currentIndex > 0 ? () => navigateTo(currentIndex - 1) : undefined}
          onNext={currentIndex < allReceipts.length - 1 ? () => navigateTo(currentIndex + 1) : undefined}
          hasPrevious={currentIndex > 0}
          hasNext={currentIndex < allReceipts.length - 1}
        />
      )}
    </div>
  );
}
