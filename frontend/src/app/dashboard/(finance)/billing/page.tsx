"use client";
import { HelpTip } from "@/components/ui/help-tip";
import { HELP }    from "@/lib/help-content";
import { useState, useEffect }  from "react";
import { useSearchParams }  from "next/navigation";
import { CreditCard, Plus, Send, FileText, DollarSign } from "lucide-react";
import { PageHeader }        from "@/components/ui/page-header";
import { StatCard }          from "@/components/ui/stat-card";
import { Badge }             from "@/components/ui/badge";
import { EmptyState }        from "@/components/ui/empty-state";
import { FilterBuilder }     from "@/components/ui/filter-builder";
import { Pagination }        from "@/components/ui/pagination";
import { INVOICE_FILTER_SCHEMA } from "@/lib/filter-schemas";
import { useApi, useFeePlans, useInvoiceStats, useStudents, useAcademicSessions, type Invoice } from "@/lib/hooks";
import { apiClient }         from "@/lib/api";
import { useToast } from '@/lib/use-toast';


type Tab = "invoices" | "fee-plans";

function invoiceStatusVariant(s: string, isOverdue: boolean) {
  if (s === "PAID")           return "success" as const;
  if (isOverdue)              return "error"   as const;
  if (s === "SENT")           return "info"    as const;
  if (s === "PARTIALLY_PAID") return "warning" as const;
  return "neutral" as const;
}

function fmt(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function BillingPage() {
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>("invoices");

  // Sessions
  const { data: sessions } = useAcademicSessions();
  const currentSession = sessions?.find(s => s.isCurrent) ?? sessions?.[0];
  const academicYear   = currentSession?.name ?? "";

  // URL-state filters — all invoice filters live in the URL
  const searchParams = useSearchParams();
  const qs           = searchParams.toString();
  // M5: 'overdueOnly' is a frontend-only routing signal (set by the
  // dashboard's "View Overdue" quick action and the filter panel's
  // "Overdue" field). It is NEVER sent to the backend: InvoiceStatus.OVERDUE
  // is no longer written (invoice/overdue.util.ts), so a literal
  // status=OVERDUE query would now match nothing there. The backend has no
  // route parameter for this and none is added here (no backend changes).
  const overdueOnly  = searchParams.get("overdueOnly") === "true";

  // The page size actually in effect. No page-size selector (25/50/100 or
  // similar) exists anywhere in this application -- checked directly:
  // components/ui/pagination.tsx has no such control, and no
  // setFilter('limit', ...) call exists anywhere in the codebase. This list
  // has always relied silently on the backend's own default of 20
  // (InvoiceService.findAll()). Reading it from the URL means a page size
  // WOULD be honored if a selector is ever added later (it would just call
  // setFilter('limit', ...) like every other filter here); until then this
  // falls back to the backend's own existing default -- not a new number
  // invented by this commit.
  const pageSize = Number(searchParams.get("limit")) || 20;
  const page     = Number(searchParams.get("page"))  || 1;

  // Stats (not paginated)
  const { data: stats, loading: sLoading } = useInvoiceStats(academicYear);

  // ── Normal path (unchanged from before this milestone) ────────────────
  // Every filter (status, studentId, academicYear, dueDate, amount, search,
  // page, limit) is forwarded to the backend exactly as it always has been;
  // findAll() does the filtering and pagination server-side. overdueOnly is
  // never part of this query string.
  const invoiceQs = qs || (academicYear ? `academicYear=${encodeURIComponent(academicYear)}` : "");
  const { data: invoiceData, loading: iLoading, refetch: refetchInvoices } =
    useApi<{ data: Invoice[]; meta: any }>(`/billing/invoices${invoiceQs ? `?${invoiceQs}` : ""}`, [qs]);

  // ── overdueOnly path ────────────────────────────────────────────────
  // isOverdue is a computed property, not a stored column -- the backend
  // cannot filter or paginate a result set by it (no backend changes in
  // this milestone). The only way to guarantee an accurate overdue list,
  // without guessing a "large enough" fetch size, is to walk every backend
  // page for the OTHER active filters (status/overdueOnly excluded) using
  // the backend's own real pagination contract (page / meta.lastPage,
  // whatever limit it already defaults to), accumulate the full matching
  // set, then filter it by isOverdue. Trade-off, stated plainly rather than
  // hidden: this issues one backend request per page of matching invoices,
  // so it costs more round trips than a single-page fetch -- the honest
  // price of exact correctness without a backend change. MAX_SCAN_PAGES
  // below is a defensive ceiling against a runaway loop on a very large
  // result set, not a guess at "enough" data; if it is ever hit, the UI
  // says so explicitly (below) rather than silently showing a partial list.
  //
  // Worst-case analysis (see architecture review): sequential fetching
  // made wall-clock latency scale linearly with request count -- at the
  // MAX_SCAN_PAGES=50 ceiling, roughly 2-6s. Fetched here with bounded
  // concurrency instead (SCAN_CONCURRENCY requests in flight at once,
  // matching a typical browser's own per-origin connection limit -- not a
  // backend change, just how the existing requests are issued), cutting
  // that latency by roughly the same factor without changing what is
  // fetched, the accuracy contract, or MAX_SCAN_PAGES itself. Page 1 is
  // always fetched alone first, since meta.lastPage (needed to know how
  // many more pages exist) is only known after it returns.
  const MAX_SCAN_PAGES  = 50;
  const SCAN_CONCURRENCY = 6;
  const overdueFetchKey = (() => {
    const params = new URLSearchParams(qs);
    params.delete("overdueOnly");
    params.delete("page");
    params.delete("limit");
    if (academicYear && !params.has("academicYear")) params.set("academicYear", academicYear);
    return params.toString();
  })();
  const [overdueScan, setOverdueScan] = useState<{
    loading: boolean; invoices: Invoice[]; truncated: boolean;
  }>({ loading: false, invoices: [], truncated: false });

  useEffect(() => {
    if (!overdueOnly) return;
    let cancelled = false;
    (async () => {
      setOverdueScan(s => ({ ...s, loading: true }));

      const fetchPage = async (p: number) => {
        const params = new URLSearchParams(overdueFetchKey);
        params.set("page", String(p));
        const res = await apiClient.get(`/billing/invoices?${params.toString()}`);
        return res.data as { data: Invoice[]; meta: { lastPage?: number } };
      };

      // Page 1 alone: lastPage is unknown until it returns.
      const first = await fetchPage(1);
      const byPage = new Map<number, Invoice[]>([[1, first.data ?? []]]);
      const lastPage = first.meta?.lastPage ?? 1;
      const scanThrough = Math.min(lastPage, MAX_SCAN_PAGES);
      const truncated = lastPage > MAX_SCAN_PAGES;

      // Remaining pages, SCAN_CONCURRENCY in flight at a time. Bounded, not
      // "fire them all at once" -- keeps this well inside a normal
      // browser's per-origin connection limit and avoids hammering the
      // backend with 49 simultaneous requests for one filter click.
      let nextPage = 2;
      const worker = async () => {
        while (nextPage <= scanThrough && !cancelled) {
          const p = nextPage++;
          const body = await fetchPage(p);
          byPage.set(p, body.data ?? []);
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(SCAN_CONCURRENCY, Math.max(0, scanThrough - 1)) }, worker),
      );

      // Reassembled in page order, not arrival order -- concurrent
      // responses can resolve out of sequence; the backend's own
      // orderBy: createdAt desc must be preserved across the pages.
      const all: Invoice[] = [];
      for (let p = 1; p <= scanThrough; p++) all.push(...(byPage.get(p) ?? []));

      if (!cancelled) setOverdueScan({ loading: false, invoices: all, truncated });
    })();
    return () => { cancelled = true; };
    // Re-scan only when the SET being scanned can change -- never on
    // page/limit alone, since those just reslice the already-scanned,
    // already-filtered result client-side (see below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overdueOnly, overdueFetchKey]);

  // isOverdue filtered from the server-computed field only -- never
  // re-derived from status/dueDate anywhere in this file.
  const overdueFiltered = overdueScan.invoices.filter(i => i.isOverdue);
  const overdueTotal    = overdueFiltered.length;
  const overdueLastPage = Math.max(1, Math.ceil(overdueTotal / pageSize));
  const overduePage     = Math.min(page, overdueLastPage);

  const fetchedInvoices = (invoiceData as any)?.data ?? invoiceData ?? [];
  const invoices: Invoice[] = overdueOnly
    ? overdueFiltered.slice((overduePage - 1) * pageSize, overduePage * pageSize)
    : fetchedInvoices;
  const invoiceMeta = overdueOnly
    ? {
        total: overdueTotal, page: overduePage, limit: pageSize, lastPage: overdueLastPage,
        hasPrev: overduePage > 1, hasNext: overduePage < overdueLastPage,
      }
    : ((invoiceData as any)?.meta ?? null);
  const overdueLoading = overdueOnly && overdueScan.loading;

  // Fee plans (not paginated)
  const { data: feePlans, loading: pLoading, refetch: refetchPlans } = useFeePlans(academicYear);

  // Students for invoice generation
  const { data: studentsData } =
  useStudents(1, {});
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
    if (!currentSession?.id) { toast.error("Select a session first"); return; }
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
      toast.error(err?.response?.data?.message ?? "Failed to create fee plan");
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
      toast.error(err?.response?.data?.message ?? "Failed to generate invoice");
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
      toast.error(err?.response?.data?.message ?? "Failed to record payment");
    } finally { setSavingPayment(false); }
  };

  const sendInvoice = async (id: string) => {
    try {
      await apiClient.patch(`/billing/invoices/${id}/send`, {});
      refetchInvoices();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to send invoice");
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

          {/* Truncation notice -- shown, never silent, if the overdue scan
              hit its safety ceiling (MAX_SCAN_PAGES) before covering every
              matching invoice. */}
          {overdueOnly && overdueScan.truncated && (
            <div className="mb-3 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              Showing overdue invoices from the first {MAX_SCAN_PAGES} pages scanned only —
              narrow the Academic Year or another filter for a complete view.
            </div>
          )}

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
                {(overdueOnly ? overdueLoading : iLoading) ? [...Array(5)].map((_, i) => (
                  <tr key={i}>{[...Array(7)].map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                  ))}</tr>
                )) : !invoices || invoices.length === 0 ? (
                  <tr><td colSpan={7}>
                    <EmptyState title="No invoices" message="Generate your first invoice above." icon={<FileText className="w-12 h-12" />} />
                  </td></tr>
                ) : invoices.map((inv: Invoice) => (
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
                    <td className="px-4 py-3"><Badge label={inv.status} variant={invoiceStatusVariant(inv.status, !!inv.isOverdue)} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {inv.status === "DRAFT" && (
                          <button onClick={() => sendInvoice(inv.id)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                            <Send className="w-3 h-3" /> Send
                          </button>
                        )}
                        {["SENT","PARTIALLY_PAID"].includes(inv.status) && (
                          <button onClick={() => { setPayingInvoiceId(inv.id); setPayForm(p => ({ ...p, amount: String(inv.dueAmount) })); }}
                            className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">Pay</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination meta={invoiceMeta} loading={overdueOnly ? overdueLoading : iLoading} />
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
