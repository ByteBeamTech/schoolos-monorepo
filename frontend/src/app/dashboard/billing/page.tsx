"use client";
import { HelpTip } from "@/components/ui/help-tip";
import { HELP }    from "@/lib/help-content";
import { useState }         from "react";
import { useSearchParams }  from "next/navigation";
import { CreditCard, Plus, Send, FileText, DollarSign } from "lucide-react";
import { PageHeader }        from "@/components/ui/page-header";
import { StatCard }          from "@/components/ui/stat-card";
import { Badge }             from "@/components/ui/badge";
import { EmptyState }        from "@/components/ui/empty-state";
import { FilterBuilder }     from "@/components/ui/filter-builder";
import { Pagination }        from "@/components/ui/pagination";
import { INVOICE_FILTER_SCHEMA } from "@/lib/filter-schemas";
import { useApi, useFeePlans, useInvoiceStats, useStudents, useAcademicSessions } from "@/lib/hooks";
import { apiClient }         from "@/lib/api";

type Tab = "invoices" | "fee-plans";

function invoiceStatusVariant(s: string) {
  if (s === "PAID")           return "success" as const;
  if (s === "SENT")           return "info"    as const;
  if (s === "OVERDUE")        return "error"   as const;
  if (s === "PARTIALLY_PAID") return "warning" as const;
  if (s === "DRAFT")          return "neutral" as const;
  return "neutral" as const;
}

function fmt(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function BillingPage() {
  const [tab, setTab] = useState<Tab>("invoices");

  // Sessions
  const { data: sessions } = useAcademicSessions();
  const currentSession = sessions?.find(s => s.isCurrent) ?? sessions?.[0];
  const academicYear   = currentSession?.name ?? "";

  // URL-state filters — all invoice filters live in the URL
  const searchParams = useSearchParams();
  const qs           = searchParams.toString();

  // Stats (not paginated)
  const { data: stats, loading: sLoading } = useInvoiceStats(academicYear);

  // Invoices — driven by URL params
  const invoiceQs = qs || (academicYear ? `academicYear=${encodeURIComponent(academicYear)}` : "");
  const { data: invoiceData, loading: iLoading, refetch: refetchInvoices } =
    useApi<{ data: any[]; meta: any }>(`/billing/invoices${invoiceQs ? `?${invoiceQs}` : ""}`, [qs, academicYear]);
  const invoices = (invoiceData as any)?.data ?? invoiceData ?? [];
  const invoiceMeta = (invoiceData as any)?.meta ?? null;

  // Fee plans (not paginated)
  const { data: feePlans, loading: pLoading, refetch: refetchPlans } = useFeePlans(academicYear);

  // Students for invoice generation
  const { data: studentsData } = useStudents(1, "");
  const students = studentsData?.data ?? [];

  // ── Create fee plan ──────────────────────────────────────────────────────
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [savingPlan,   setSavingPlan]   = useState(false);
  const [planForm, setPlanForm] = useState({
    name: "", grade: "", currency: "INR",
    items: [{ name: "", amount: "" }],
  });

  const addItem    = () => setPlanForm(p => ({ ...p, items: [...p.items, { name: "", amount: "" }] }));
  const removeItem = (i: number) => setPlanForm(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }));
  const setItem    = (i: number, k: string, v: string) =>
    setPlanForm(p => ({ ...p, items: p.items.map((item, idx) => idx === i ? { ...item, [k]: v } : item) }));

  const createPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSession?.id) { alert("Select a session first"); return; }
    setSavingPlan(true);
    try {
      await apiClient.post("/billing/fee-plans", {
        sessionId:    currentSession.id,
        academicYear: academicYear || currentSession.id,
        name:         planForm.name,
        grade:        planForm.grade || undefined,
        currency:     planForm.currency,
        feeItems:     planForm.items.filter(i => i.name && i.amount).map((i, idx) => ({
          name: i.name, amount: parseFloat(i.amount), sortOrder: idx,
        })),
      });
      setShowPlanForm(false);
      setPlanForm({ name: "", grade: "", currency: "INR", items: [{ name: "", amount: "" }] });
      refetchPlans();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? "Failed to create fee plan");
    } finally { setSavingPlan(false); }
  };

  // ── Generate invoice ─────────────────────────────────────────────────────
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [savingInvoice,   setSavingInvoice]   = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({ studentId: "", feePlanId: "", dueDate: "" });

  const generateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingInvoice(true);
    try {
      await apiClient.post("/billing/invoices/generate", invoiceForm);
      setShowInvoiceForm(false);
      setInvoiceForm({ studentId: "", feePlanId: "", dueDate: "" });
      refetchInvoices();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? "Failed to generate invoice");
    } finally { setSavingInvoice(false); }
  };

  // ── Record payment ───────────────────────────────────────────────────────
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [payForm,  setPayForm]  = useState({ amount: "", paymentMethod: "CASH", referenceNumber: "" });
  const [savingPayment, setSavingPayment] = useState(false);

  const recordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInvoiceId) return;
    setSavingPayment(true);
    try {
      await apiClient.post("/billing/payments/record-offline", {
        invoiceId:       payingInvoiceId,
        amount:          parseFloat(payForm.amount),
        paymentMethod:   payForm.paymentMethod,
        referenceNumber: payForm.referenceNumber || undefined,
      });
      setPayingInvoiceId(null);
      setPayForm({ amount: "", paymentMethod: "CASH", referenceNumber: "" });
      refetchInvoices();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? "Failed to record payment");
    } finally { setSavingPayment(false); }
  };

  const sendInvoice = async (id: string) => {
    try {
      await apiClient.patch(`/billing/invoices/${id}/send`, {});
      refetchInvoices();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? "Failed to send invoice");
    }
  };

  return (
    <div>
      <PageHeader title="Student Billing" subtitle="Fee plans, invoices and payments" />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Invoiced"  value={`₹${((stats?.totalAmount     ?? 0) / 1000).toFixed(0)}K`} icon={<FileText   className="w-5 h-5" />} color="blue"  loading={sLoading} sub={`${stats?.totalInvoices ?? 0} invoices`} />
        <StatCard label="Collected"       value={`₹${((stats?.collectedAmount ?? 0) / 1000).toFixed(0)}K`} icon={<DollarSign className="w-5 h-5" />} color="green" loading={sLoading} sub={`${stats?.paidCount ?? 0} paid`} />
        <StatCard label="Overdue"         value={stats?.overdueCount ?? 0}                                   icon={<CreditCard className="w-5 h-5" />} color="red"   loading={sLoading} sub="invoices past due date" />
        <StatCard label="Drafts"          value={stats?.draftCount ?? 0}                                     icon={<FileText   className="w-5 h-5" />} color="amber" loading={sLoading} sub="pending to send" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 mb-6 items-center justify-between">
        <div className="flex gap-1">
          {(["invoices","fee-plans"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
                tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}>
              {t === "fee-plans" ? "Fee Plans" : "Invoices"}
            </button>
          ))}
        </div>
        <div className="pb-1">
          {tab === "invoices" && (
            <button onClick={() => setShowInvoiceForm(p => !p)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" /> Generate Invoice
            </button>
          )}
          {tab === "fee-plans" && (
            <button onClick={() => setShowPlanForm(p => !p)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" /> New Fee Plan
            </button>
          )}
        </div>
      </div>

      {/* ── INVOICES TAB ── */}
      {tab === "invoices" && (
        <>
          {/* Generate invoice form */}
          {showInvoiceForm && (
            <div className="bg-white border border-blue-100 rounded-xl p-5 mb-5 shadow-sm">
              <h3 className="font-semibold text-slate-900 mb-4 text-sm">Generate Invoice</h3>
              <form onSubmit={generateInvoice} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Student *</label>
                  <select required value={invoiceForm.studentId}
                    onChange={e => setInvoiceForm(p => ({ ...p, studentId: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select student</option>
                    {students.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admissionNumber})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Fee Plan *</label>
                  <select required value={invoiceForm.feePlanId}
                    onChange={e => setInvoiceForm(p => ({ ...p, feePlanId: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select plan</option>
                    {feePlans?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Due Date *</label>
                  <input required type="date" value={invoiceForm.dueDate}
                    onChange={e => setInvoiceForm(p => ({ ...p, dueDate: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex gap-2 items-end">
                  <button type="submit" disabled={savingInvoice}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors">
                    {savingInvoice ? "Generating..." : "Generate"}
                  </button>
                  <button type="button" onClick={() => setShowInvoiceForm(false)}
                    className="px-4 py-2.5 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Record payment modal */}
          {payingInvoiceId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Record Payment</h2>
                <form onSubmit={recordPayment} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Amount (₹) *</label>
                    <input required type="number" min="1" step="0.01"
                      value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))}
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Payment Method *</label>
                    <select value={payForm.paymentMethod} onChange={e => setPayForm(p => ({ ...p, paymentMethod: e.target.value }))}
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {["CASH","CHEQUE","NEFT","UPI","CARD"].map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Reference Number</label>
                    <input type="text" placeholder="Cheque/UTR/Txn no."
                      value={payForm.referenceNumber} onChange={e => setPayForm(p => ({ ...p, referenceNumber: e.target.value }))}
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setPayingInvoiceId(null)}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm rounded-lg transition-colors">Cancel</button>
                    <button type="submit" disabled={savingPayment}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors">
                      {savingPayment ? "Recording..." : "Record Payment"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* FilterBuilder replaces the old status button row */}
          <FilterBuilder schema={INVOICE_FILTER_SCHEMA} className="mb-4" />

          {/* Invoices table */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {["Invoice","Student","Amount","Paid","Due","Status","Actions"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {iLoading ? [...Array(5)].map((_, i) => (
                  <tr key={i}>{[...Array(7)].map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                  ))}</tr>
                )) : !invoices || invoices.length === 0 ? (
                  <tr><td colSpan={7}>
                    <EmptyState title="No invoices" message="Generate your first invoice above." icon={<FileText className="w-12 h-12" />} />
                  </td></tr>
                ) : invoices.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900 text-xs">{inv.student.firstName} {inv.student.lastName}</p>
                      <p className="text-slate-400 text-xs">{inv.student.admissionNumber}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{fmt(inv.totalAmount)}</td>
                    <td className="px-4 py-3 text-emerald-700">{fmt(inv.paidAmount)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(inv.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </td>
                    <td className="px-4 py-3"><Badge label={inv.status} variant={invoiceStatusVariant(inv.status)} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {inv.status === "DRAFT" && (
                          <button onClick={() => sendInvoice(inv.id)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                            <Send className="w-3 h-3" /> Send
                          </button>
                        )}
                        {["SENT","PARTIALLY_PAID","OVERDUE"].includes(inv.status) && (
                          <button onClick={() => { setPayingInvoiceId(inv.id); setPayForm(p => ({ ...p, amount: String(inv.dueAmount) })); }}
                            className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">Pay</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination meta={invoiceMeta} loading={iLoading} />
          </div>
        </>
      )}

      {/* ── FEE PLANS TAB ── */}
      {tab === "fee-plans" && (
        <>
          {showPlanForm && (
            <div className="bg-white border border-blue-100 rounded-xl p-5 mb-5 shadow-sm">
              <h3 className="font-semibold text-slate-900 mb-4 text-sm">Create Fee Plan</h3>
              <form onSubmit={createPlan}>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Plan Name *</label>
                    <input required type="text" placeholder="e.g. Annual Tuition 2025-26"
                      value={planForm.name} onChange={e => setPlanForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Grade / Class</label>
                    <input type="text" placeholder="e.g. Grade 10"
                      value={planForm.grade} onChange={e => setPlanForm(p => ({ ...p, grade: e.target.value }))}
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Currency</label>
                    <select value={planForm.currency} onChange={e => setPlanForm(p => ({ ...p, currency: e.target.value }))}
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {["INR","USD","GBP","EUR"].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Fee Items</p>
                {planForm.items.map((item, i) => (
                  <div key={i} className="flex gap-3 mb-2">
                    <input type="text" placeholder="Item name (e.g. Tuition Fee)"
                      value={item.name} onChange={e => setItem(i, "name", e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <input type="number" min="0" placeholder="Amount"
                      value={item.amount} onChange={e => setItem(i, "amount", e.target.value)}
                      className="w-32 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    {planForm.items.length > 1 && (
                      <button type="button" onClick={() => removeItem(i)}
                        className="px-3 py-2 text-red-500 hover:text-red-700 text-sm">✕</button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addItem}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium mb-4">+ Add fee item</button>
                <div className="flex gap-3 pt-2 border-t border-slate-100">
                  <button type="submit" disabled={savingPlan}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors">
                    {savingPlan ? "Creating..." : "Create Plan"}
                  </button>
                  <button type="button" onClick={() => setShowPlanForm(false)}
                    className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm rounded-lg transition-colors">Cancel</button>
                </div>
              </form>
            </div>
          )}

          {pLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />)}
            </div>
          ) : !feePlans || feePlans.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400 text-sm">
              No fee plans yet. Create your first plan above.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {feePlans.map((plan: any) => {
                const total = plan.feeItems.reduce((s: number, i: any) => s + Number(i.amount), 0);
                return (
                  <div key={plan.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-bold text-slate-900">{plan.name}</p>
                        {plan.grade && <p className="text-xs text-slate-400 mt-0.5">{plan.grade}</p>}
                      </div>
                      <span className="font-mono text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">{plan.currency}</span>
                    </div>
                    <div className="space-y-1.5 mb-4">
                      {plan.feeItems.map((item: any) => (
                        <div key={item.id} className="flex justify-between text-xs">
                          <span className="text-slate-600">{item.name}</span>
                          <span className="font-medium text-slate-900">{fmt(Number(item.amount))}</span>
                        </div>
                      ))}
                    </div>
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900">Total: {fmt(total)}</span>
                      <Badge label={plan.isActive ? "Active" : "Inactive"} variant={plan.isActive ? "success" : "neutral"} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
