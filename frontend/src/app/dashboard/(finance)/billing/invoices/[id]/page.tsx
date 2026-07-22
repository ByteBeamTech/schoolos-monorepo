"use client";
// frontend/src/app/dashboard/(finance)/billing/invoices/[id]/page.tsx
// Invoice detail — line items, payments, receipt, activity, cancel

import { use, useState }    from "react";
import { useRouter }         from "next/navigation";
import {
  ArrowLeft, Send, Printer, Download,
  XCircle, CreditCard, CheckCircle2,
  AlertTriangle, Clock, FileText, RefreshCw,
} from "lucide-react";
import { Badge }             from "@/components/ui/badge";
import { useApi }            from "@/lib/hooks";
import { apiClient }         from "@/lib/api";
import { useToast }          from "@/lib/use-toast";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number | string, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency, maximumFractionDigits: 2,
  }).format(Number(n));
}
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function statusVariant(s: string) {
  const m: Record<string, any> = {
    PAID: "success", SENT: "info", OVERDUE: "error",
    PARTIALLY_PAID: "warning", DRAFT: "neutral", CANCELLED: "neutral",
  };
  return m[s] ?? "neutral";
}
function paymentVariant(s: string) {
  const m: Record<string, any> = { SUCCESS: "success", PENDING: "warning", FAILED: "error", REFUNDED: "neutral" };
  return m[s] ?? "neutral";
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }   = use(params);
  const router   = useRouter();
  const { toast } = useToast();

  const { data: inv, loading, refetch } = useApi<any>(`/billing/invoices/${id}`, [id]);

  // Record payment state
  const [showPayForm, setShowPayForm] = useState(false);
  const [payForm, setPayForm]         = useState({ amount: "", paymentMethod: "CASH", referenceNumber: "" });
  const [savingPay, setSavingPay]     = useState(false);

  // Cancel state
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling]     = useState(false);

  const recordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPay(true);
    try {
      await apiClient.post("/billing/payments/record-offline", {
        invoiceId:       id,
        amount:          parseFloat(payForm.amount),
        paymentMethod:   payForm.paymentMethod,
        referenceNumber: payForm.referenceNumber || undefined,
      });
      setShowPayForm(false);
      setPayForm({ amount: "", paymentMethod: "CASH", referenceNumber: "" });
      refetch();
      toast.success("Payment recorded");
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to record payment");
    } finally { setSavingPay(false); }
  };

  const cancelInvoice = async () => {
    if (!cancelReason.trim()) { toast.error("Reason is required"); return; }
    setCancelling(true);
    try {
      await apiClient.patch(`/billing/invoices/${id}/cancel`, { reason: cancelReason });
      setShowCancel(false);
      setCancelReason("");
      refetch();
      toast.success("Invoice cancelled");
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to cancel");
    } finally { setCancelling(false); }
  };

  const sendInvoice = async () => {
    try {
      await apiClient.patch(`/billing/invoices/${id}/send`, {});
      refetch();
      toast.success("Invoice sent");
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to send");
    }
  };

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-48 bg-slate-100 rounded" />
      <div className="h-40 bg-slate-100 rounded-xl" />
      <div className="h-60 bg-slate-100 rounded-xl" />
    </div>
  );
  if (!inv) return <div className="text-slate-400 py-24 text-center">Invoice not found</div>;

  const canPay    = ["SENT","PARTIALLY_PAID","OVERDUE"].includes(inv.status);
  const canSend   = inv.status === "DRAFT";
  const canCancel = !["PAID","CANCELLED"].includes(inv.status);
  const dueAmt    = Number(inv.dueAmount);
  const totalAmt  = Number(inv.totalAmount);
  const paidAmt   = Number(inv.paidAmount);
  const cur       = inv.currency ?? "INR";

  // FEE-1: the invoice detail endpoint now returns `receipts` (an array, one
  // per payment) where it previously returned a single `receipt` object.
  // Defensive default so a cached/older API response cannot crash the page.
  const receipts: any[] = Array.isArray(inv.receipts) ? inv.receipts : [];
  const latestReceiptPdfUrl = receipts.find((r: any) => r?.pdfUrl)?.pdfUrl;

  return (
    <div className="max-w-4xl">
      {/* Back */}
      <button onClick={() => router.push("/dashboard/billing")}
        className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 text-sm mb-5 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Billing
      </button>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-slate-900 font-mono">{inv.invoiceNumber}</h1>
              <Badge label={inv.status.replace("_"," ")} variant={statusVariant(inv.status)} />
            </div>
            <p className="text-sm text-slate-500">
              {inv.student?.firstName} {inv.student?.lastName} · {inv.student?.admissionNumber}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Academic year: {inv.academicYear} · Due: {fmtDate(inv.dueDate)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-slate-900">{fmt(totalAmt, cur)}</p>
            {dueAmt > 0 && (
              <p className="text-sm font-semibold text-red-500 mt-0.5">{fmt(dueAmt, cur)} outstanding</p>
            )}
            {paidAmt > 0 && (
              <p className="text-sm text-emerald-600 mt-0.5">{fmt(paidAmt, cur)} paid</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-slate-100">
          {canPay && (
            <button onClick={() => { setShowPayForm(p => !p); setPayForm(p => ({ ...p, amount: String(dueAmt) })); }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg font-medium transition-colors">
              <CreditCard className="w-4 h-4" /> Record Payment
            </button>
          )}
          {canSend && (
            <button onClick={sendInvoice}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors">
              <Send className="w-4 h-4" /> Send Invoice
            </button>
          )}
          {/* FEE-1: an invoice now has many receipts (one per payment). The
              header action prints the most recent one that has a PDF; the
              sidebar lists them all. */}
          {latestReceiptPdfUrl && (
            <a href={latestReceiptPdfUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded-lg font-medium transition-colors">
              <Printer className="w-4 h-4" /> Print Receipt
            </a>
          )}
          {inv.pdfUrl && (
            <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded-lg font-medium transition-colors">
              <Download className="w-4 h-4" /> Download Invoice
            </a>
          )}
          {canCancel && (
            <button onClick={() => setShowCancel(p => !p)}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm rounded-lg font-medium transition-colors">
              <XCircle className="w-4 h-4" /> Cancel Invoice
            </button>
          )}
        </div>

        {/* Record payment form */}
        {showPayForm && (
          <form onSubmit={recordPayment} className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-sm font-semibold text-slate-700 mb-3">Record Payment</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Amount *</label>
                <input required type="number" min="1" step="0.01" value={payForm.amount}
                  onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Method *</label>
                <select value={payForm.paymentMethod} onChange={e => setPayForm(p => ({ ...p, paymentMethod: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  {["CASH","CHEQUE","NEFT","UPI","CARD"].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Reference No.</label>
                <input type="text" placeholder="UTR / Cheque / Txn"
                  value={payForm.referenceNumber} onChange={e => setPayForm(p => ({ ...p, referenceNumber: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button type="submit" disabled={savingPay}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors">
                {savingPay ? "Recording..." : "Record"}
              </button>
              <button type="button" onClick={() => setShowPayForm(false)}
                className="px-4 py-2 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 transition-colors">Cancel</button>
            </div>
          </form>
        )}

        {/* Cancel form */}
        {showCancel && (
          <div className="mt-4 pt-4 border-t border-red-100 bg-red-50/50 rounded-xl p-4">
            <p className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Cancel Invoice
            </p>
            <p className="text-xs text-red-500 mb-3">This cannot be undone. The invoice will be marked as CANCELLED.</p>
            <textarea rows={2} placeholder="Reason for cancellation (required)"
              value={cancelReason} onChange={e => setCancelReason(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 resize-none mb-3" />
            <div className="flex gap-2">
              <button onClick={cancelInvoice} disabled={cancelling || !cancelReason.trim()}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors">
                {cancelling ? "Cancelling..." : "Confirm Cancel"}
              </button>
              <button onClick={() => { setShowCancel(false); setCancelReason(""); }}
                className="px-4 py-2 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 transition-colors">Dismiss</button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Line items */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Fee Items</h2>
            <div className="space-y-2">
              {(inv.items ?? []).map((item: any) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm text-slate-800">{item.name}</p>
                    {item.chargeCategory && item.chargeCategory !== "ACADEMIC" && (
                      <span className="text-xs text-slate-400">{item.chargeCategory}</span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">{fmt(item.netAmount, cur)}</p>
                    {Number(item.gstAmount) > 0 && (
                      <p className="text-xs text-slate-400">incl. GST {fmt(item.gstAmount, cur)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-3 mt-2 border-t border-slate-100 space-y-1.5">
              <div className="flex justify-between text-sm text-slate-500"><span>Subtotal</span><span>{fmt(inv.subtotal, cur)}</span></div>
              {Number(inv.discountAmount) > 0 && (
                <div className="flex justify-between text-sm text-emerald-600"><span>Discount</span><span>−{fmt(inv.discountAmount, cur)}</span></div>
              )}
              {Number(inv.gstAmount) > 0 && (
                <div className="flex justify-between text-sm text-slate-500"><span>GST</span><span>{fmt(inv.gstAmount, cur)}</span></div>
              )}
              <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-100">
                <span>Total</span><span>{fmt(inv.totalAmount, cur)}</span>
              </div>
            </div>
          </div>

          {/* Payment history */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Payment History</h2>
            {!inv.payments?.length ? (
              <p className="text-sm text-slate-400 text-center py-6">No payments recorded yet</p>
            ) : (
              <div className="space-y-2">
                {inv.payments.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        p.status === "SUCCESS" ? "bg-emerald-100" : p.status === "FAILED" ? "bg-red-100" : "bg-amber-100"
                      }`}>
                        {p.status === "SUCCESS"  && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                        {p.status === "FAILED"   && <XCircle      className="w-4 h-4 text-red-500" />}
                        {p.status === "PENDING"  && <Clock        className="w-4 h-4 text-amber-500" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{p.paymentMethod ?? p.gateway}</p>
                        <p className="text-xs text-slate-400">
                          {p.gatewayPaymentId ?? "—"} · {fmtDate(p.paidAt ?? p.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">{fmt(p.amount, cur)}</p>
                      <Badge label={p.status} variant={paymentVariant(p.status)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar — late fees + receipt + notes */}
        <div className="space-y-5">
          {/* Receipt */}
          {receipts.length > 0 && (
            <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-semibold text-emerald-700">
                  {receipts.length === 1 ? "Receipt Issued" : `Receipts Issued (${receipts.length})`}
                </h3>
              </div>
              {receipts.map((r: any, i: number) => (
                <div key={r.id ?? r.receiptNumber}
                  className={i > 0 ? "mt-4 pt-4 border-t border-emerald-100" : ""}>
                  <p className="font-mono text-lg font-bold text-emerald-800">{r.receiptNumber}</p>
                  <p className="text-xs text-emerald-600 mt-1">{fmt(r.amount, cur)} · {fmtDate(r.createdAt)}</p>
                  {r.pdfUrl && (
                    <a href={r.pdfUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-900 font-medium mt-3 transition-colors">
                      <Download className="w-3.5 h-3.5" /> Download PDF
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Late fees */}
          {inv.lateFees?.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Late Fees</h3>
              {inv.lateFees.map((lf: any) => (
                <div key={lf.id} className="flex justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
                  <span className="text-slate-600">{lf.daysOverdue}d overdue</span>
                  <span className="font-semibold text-red-600">{fmt(lf.amount, cur)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          {inv.notes && (
            <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4">
              <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1.5">Notes</h3>
              <p className="text-sm text-amber-800">{inv.notes}</p>
            </div>
          )}

          {/* Summary box */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Summary</h3>
            {[
              { label: "Invoice date",    value: fmtDate(inv.issuedAt ?? inv.createdAt) },
              { label: "Due date",        value: fmtDate(inv.dueDate) },
              { label: "Academic year",   value: inv.academicYear },
              { label: "Currency",        value: inv.currency },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-xs">
                <span className="text-slate-500">{label}</span>
                <span className="text-slate-800 font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
