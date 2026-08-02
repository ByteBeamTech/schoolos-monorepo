"use client";
// frontend/src/app/dashboard/(finance)/billing/students/[studentId]/page.tsx
//
// FDD Section 14 -- Student Financial Profile. Replaces the legacy
// StudentLedgerPage (pre-FDD, its own copies of fmt/fmtDate/status-variant
// logic, a broken inline "Record Payment" form offering payment methods
// the backend no longer accepts) -- retirement of that legacy form was
// flagged during the Sprint 1 reuse audit as something to do once this
// page existed; this commit is that replacement.

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { StudentSummaryCard } from "@/components/billing/StudentSummaryCard";
import { useStudent, useStudentBilling } from "@/lib/hooks";
import { groupFeePeriods, computeOutstandingSummary, deriveLabel } from "@/lib/billing/fee-period";
import { feePeriodStatusVariant, feePeriodStatusIcon, feePeriodStatusLabel } from "@/lib/billing/status-badge";
import { buildTimeline, TIMELINE_ICONS, timelineEventDescription } from "@/lib/billing/timeline";
import { fmt, fmtDateTime } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/billing/payment-method";
import { DISCOUNT_CATEGORIES, DISCOUNT_TYPES } from "@/lib/billing/discount-options";
import { apiClient } from "@/lib/api";
import { useToast } from "@/lib/use-toast";

export default function StudentFinancialProfilePage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = use(params);
  const router = useRouter();

  const { data: student, loading: studentLoading } = useStudent(studentId);
  const { invoices, discounts, feePlans, loading: billingLoading, refetch: refetchBilling } = useStudentBilling(studentId);

  const grouped = useMemo(() => groupFeePeriods(invoices), [invoices]);
  const lastPayment = useMemo(() => {
    const all = invoices
      .flatMap((inv) => inv.payments ?? [])
      .filter((p) => p.status === "SUCCESS" && p.paidAt)
      .sort((a, b) => new Date(b.paidAt!).getTime() - new Date(a.paidAt!).getTime());
    return all[0] ? { amount: all[0].amount, date: all[0].paidAt! } : undefined;
  }, [invoices]);
  const outstanding = useMemo(() => computeOutstandingSummary(grouped, lastPayment), [grouped, lastPayment]);

  const loading = studentLoading || billingLoading;

  if (loading || !student) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="h-8 w-32 rounded bg-slate-100 animate-pulse" />
        <div className="h-24 rounded-lg bg-slate-100 animate-pulse" />
        <div className="h-64 rounded-lg bg-slate-100 animate-pulse" />
      </div>
    );
  }

  const transportRoute = student.transportAssignment?.route?.name;

  return (
    <div className="max-w-4xl mx-auto">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 text-sm mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
          <TabsTrigger value="refunds">Refunds</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        {/* FR-PROFILE-04: same fields Section 11.2/12.3.1 already define,
            shown identically here -- no new figures introduced. */}
        <TabsContent value="overview">
          <div className="space-y-3">
            <StudentSummaryCard
              student={student}
              outstanding={outstanding}
              discounts={discounts}
              feePlans={feePlans}
              transportRoute={transportRoute}
            />
            <div className="flex gap-2">
              <button
                onClick={() => router.push(`/dashboard/billing/collect-fee?studentId=${studentId}`)}
                className="px-3 py-1.5 rounded-md text-sm bg-blue-600 text-white hover:bg-blue-700"
              >
                Collect Fee
              </button>
              <RequestDiscountButton studentId={studentId} onCreated={refetchBilling} />
            </div>
          </div>
        </TabsContent>

        {/* FDD Section 14.4: full list, ALL statuses -- deliberately
            broader than Collect Fee's Due/Upcoming/Paid, which excludes
            Draft/Cancelled by design (FDD Section 12.4). */}
        <TabsContent value="invoices">
          <InvoicesTab invoices={invoices} onViewDetails={(id) => router.push(`/dashboard/billing/invoices/${id}`)} />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentsTab invoices={invoices} />
        </TabsContent>

        <TabsContent value="receipts">
          <ReceiptsTab invoices={invoices} onView={(invoiceId, receiptId) =>
            router.push(`/dashboard/billing/receipts/${invoiceId}?receipt=${receiptId}`)
          } />
        </TabsContent>

        {/* FR-PROFILE-02: labeled as incomplete, not presented as a
            complete independent record -- no refund read endpoint exists
            on the backend at all (Section 24 item 2). */}
        <TabsContent value="refunds">
          <RefundsTab invoices={invoices} />
        </TabsContent>

        <TabsContent value="timeline">
          <TimelineTab invoices={invoices} discounts={discounts} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InvoicesTab({ invoices, onViewDetails }: { invoices: any[]; onViewDetails: (id: string) => void }) {
  if (invoices.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-12">No invoices for this student yet.</p>;
  }
  return (
    <div className="rounded-lg border bg-white divide-y" style={{ borderColor: "var(--border-light)" }}>
      {invoices.map((inv) => {
        const isFeePeriodRelevant = inv.status !== "DRAFT" && inv.status !== "CANCELLED";
        const label = isFeePeriodRelevant ? deriveLabel(inv) : inv.invoiceNumber;
        return (
          <div key={inv.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</p>
              <p className="text-xs text-slate-400">{inv.invoiceNumber} · Due {fmtDateTime(inv.dueDate)}</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge label={inv.status} variant={inv.status === "PAID" ? "success" : inv.status === "CANCELLED" ? "neutral" : "info"} />
              <span className="text-sm font-medium">{fmt(inv.dueAmount)} due</span>
              <button onClick={() => onViewDetails(inv.id)} className="text-xs text-blue-600 hover:underline">
                View Details
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PaymentsTab({ invoices }: { invoices: any[] }) {
  const payments = invoices
    .flatMap((inv) => (inv.payments ?? []).map((p: any) => ({ ...p, invoiceNumber: inv.invoiceNumber })))
    .sort((a, b) => new Date(b.paidAt ?? 0).getTime() - new Date(a.paidAt ?? 0).getTime());

  if (payments.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-12">No payments recorded for this student yet.</p>;
  }
  return (
    <div className="rounded-lg border bg-white divide-y" style={{ borderColor: "var(--border-light)" }}>
      {payments.map((p) => (
        <div key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
          <div>
            <span style={{ color: "var(--text-primary)" }}>{fmt(p.amount)}</span>
            <span className="text-slate-400 ml-2">
              {PAYMENT_METHODS.find((m) => m.value === p.paymentMethod)?.label ?? p.paymentMethod} · {p.invoiceNumber}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {p.refundState && p.refundState !== "NONE" && (
              <Badge label={p.refundState === "FULL" ? "Refunded" : "Partially Refunded"} variant="warning" />
            )}
            <span className="text-xs text-slate-400">{fmtDateTime(p.paidAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReceiptsTab({ invoices, onView }: { invoices: any[]; onView: (invoiceId: string, receiptId: string) => void }) {
  const receipts = invoices
    .flatMap((inv) => (inv.receipts ?? []).map((r: any) => ({ ...r, invoiceId: inv.id, invoiceNumber: inv.invoiceNumber })))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (receipts.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-12">No receipts for this student yet.</p>;
  }
  return (
    <div className="rounded-lg border bg-white divide-y" style={{ borderColor: "var(--border-light)" }}>
      {receipts.map((r) => (
        <div key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
          <div>
            <span style={{ color: "var(--text-primary)" }}>{r.receiptNumber}</span>
            <span className="text-slate-400 ml-2">{fmt(r.amount)} · {r.invoiceNumber}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">{fmtDateTime(r.createdAt)}</span>
            <button onClick={() => onView(r.invoiceId, r.id)} className="text-xs text-blue-600 hover:underline">
              View / Print
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * FR-PROFILE-02 / FDD Section 24 item 2: no refund read endpoint exists on
 * the backend at all. This tab shows only what's incidentally derivable
 * from payment.refundState -- never claims to be a complete refund
 * record, and says so plainly rather than implying more than it can back up.
 */
function RefundsTab({ invoices }: { invoices: any[] }) {
  const refundedPayments = invoices
    .flatMap((inv) => (inv.payments ?? []).map((p: any) => ({ ...p, invoiceNumber: inv.invoiceNumber })))
    .filter((p) => p.refundState && p.refundState !== "NONE");

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        This view is derived from payment records only — the backend has no dedicated refund record or refund history endpoint. It may not reflect every refund for this student.
      </div>
      {refundedPayments.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">No refund activity found in this student's payment history.</p>
      ) : (
        <div className="rounded-lg border bg-white divide-y" style={{ borderColor: "var(--border-light)" }}>
          {refundedPayments.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span>{fmt(p.amount)} · {p.invoiceNumber}</span>
              <Badge label={p.refundState === "FULL" ? "Fully Refunded" : "Partially Refunded"} variant="warning" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TimelineTab({ invoices, discounts }: { invoices: any[]; discounts: any[] }) {
  const events = buildTimeline(invoices, discounts);
  if (events.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-12">No activity recorded for this student yet.</p>;
  }
  return (
    <div className="rounded-lg border bg-white divide-y" style={{ borderColor: "var(--border-light)" }}>
      {events.map((e, i) => {
        const Icon = TIMELINE_ICONS[e.type];
        return (
          <div key={i} className="flex items-center gap-3 px-4 py-3 text-sm">
            <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="flex-1" style={{ color: "var(--text-primary)" }}>{timelineEventDescription(e)}</span>
            <span className="text-xs text-slate-400">{fmtDateTime(e.date)}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * FDD FR-DISC-02: discount creation happens on a student's Profile, never
 * as a form on the Discounts page (which is for review, not origination).
 * studentId is fixed to this page's student -- no picker needed, unlike
 * the retired Discounts-page version of this form, which had to select a
 * student since it wasn't already scoped to one.
 */
function RequestDiscountButton({ studentId, onCreated }: { studentId: string; onCreated: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    category: "MERIT", type: "PERCENTAGE", value: "", validFrom: "", validUntil: "", reason: "",
  });
  const f = (k: string) => (e: any) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.post("/billing/discounts", {
        studentId,
        category: form.category,
        type: form.type,
        value: parseFloat(form.value),
        validFrom: form.validFrom,
        validUntil: form.validUntil || undefined,
        reason: form.reason || undefined,
      });
      setOpen(false);
      setForm({ category: "MERIT", type: "PERCENTAGE", value: "", validFrom: "", validUntil: "", reason: "" });
      toast.success("Discount request submitted");
      onCreated();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to submit discount request");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border hover:bg-slate-50"
        style={{ borderColor: "var(--border-light)" }}
      >
        <Plus className="w-3.5 h-3.5" /> Request Discount
      </button>
      {open && (
        <div className="mt-2 rounded-lg border bg-white p-4 space-y-3 w-full" style={{ borderColor: "var(--border-light)" }}>
          <form onSubmit={submit} className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Category *</label>
              <select required value={form.category} onChange={f("category")}
                className="w-full px-3 py-2 text-sm border rounded-lg" style={{ borderColor: "var(--border-light)" }}>
                {DISCOUNT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Type *</label>
              <select required value={form.type} onChange={f("type")}
                className="w-full px-3 py-2 text-sm border rounded-lg" style={{ borderColor: "var(--border-light)" }}>
                {DISCOUNT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Value * {form.type === "PERCENTAGE" ? "(0–100%)" : "(₹)"}
              </label>
              <input required type="number" min="0" max={form.type === "PERCENTAGE" ? "100" : undefined}
                value={form.value} onChange={f("value")}
                className="w-full px-3 py-2 text-sm border rounded-lg" style={{ borderColor: "var(--border-light)" }} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Valid From *</label>
              <input required type="date" value={form.validFrom} onChange={f("validFrom")}
                className="w-full px-3 py-2 text-sm border rounded-lg" style={{ borderColor: "var(--border-light)" }} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Reason</label>
              <input type="text" value={form.reason} onChange={f("reason")} placeholder="e.g. Sibling discount"
                className="w-full px-3 py-2 text-sm border rounded-lg" style={{ borderColor: "var(--border-light)" }} />
            </div>
            <div className="md:col-span-2 flex gap-2 items-end">
              <button type="submit" disabled={saving}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium disabled:opacity-50">
                {saving ? "Submitting…" : "Submit Request"}
              </button>
              <button type="button" onClick={() => setOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
