"use client";
import { HelpTip } from "@/components/ui/help-tip";
import { HELP }    from "@/lib/help-content";
import { useState, useEffect }  from "react";
import { useSearchParams, useRouter }  from "next/navigation";
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
  const router = useRouter();

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

  // Fee plans (not paginated) -- still needed here for the Generate/Bulk
  // Generate dropdowns below. Fee Plan *creation* moved to the dedicated
  // Fee Structure page (FDD Section 17) -- this page reads plans, it
  // doesn't create them.
  const { data: feePlans } = useFeePlans(academicYear);

  // Students for invoice generation
  const { data: studentsData } =
  useStudents(1, {});
  const students = studentsData?.data ?? [];

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

  // ── Bulk generate invoices (FR-INV-02) ───────────────────────────────────
  // FR-INV-03: verified directly against invoice.service.ts's bulkGenerate()
  // -- it runs synchronously, per-student try/catch, and returns
  // {generated, skipped, errors[]} rather than throwing on a partial
  // failure. The existing duplicate-invoice guard inside generate() makes
  // retrying this call after a timeout safe, not corrupting -- shown here
  // as an explicit "this may take a moment" note, not implied instant.
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [savingBulk, setSavingBulk] = useState(false);
  const [bulkForm, setBulkForm] = useState({ feePlanId: "", dueDate: "" });
  const [bulkResult, setBulkResult] = useState<{ generated: number; skipped: number; errors: string[] } | null>(null);

  const bulkGenerateInvoices = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBulk(true);
    setBulkResult(null);
    try {
      const res = await apiClient.post("/billing/invoices/bulk-generate", bulkForm);
      setBulkResult(res.data);
      setShowBulkForm(false);
      setBulkForm({ feePlanId: "", dueDate: "" });
      refetchInvoices();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to bulk generate invoices");
    } finally { setSavingBulk(false); }
  };

  // Record Payment (inline modal) retired here -- offered CHEQUE/NEFT
  // (rejected by the backend's MVP payment-method allowlist) and never
  // sent payerId/payerName (rejected by the M12 payer-identity rule).
  // Confirmed broken during the Sprint 1 reuse audit, flagged for
  // retirement once Collect Fee existed as the proper replacement --
  // this is that retirement. The "Pay" action below now navigates to
  // Collect Fee, pre-loaded with the invoice's student via ?studentId=
  // (the same mechanism Student Profile's "Collect Fee" button uses).

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
      <PageHeader title="Student Billing" subtitle="Invoices and payment collection" />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Invoiced"  value={`₹${((stats?.totalAmount     ?? 0) / 1000).toFixed(0)}K`} icon={<FileText   className="w-5 h-5" />} color="blue"  loading={sLoading} sub={`${stats?.totalInvoices ?? 0} invoices`} />
        <StatCard label="Collected"       value={`₹${((stats?.collectedAmount ?? 0) / 1000).toFixed(0)}K`} icon={<DollarSign className="w-5 h-5" />} color="green" loading={sLoading} sub={`${stats?.paidCount ?? 0} paid`} />
        <StatCard label="Overdue"         value={stats?.overdueCount ?? 0}                                   icon={<CreditCard className="w-5 h-5" />} color="red"   loading={sLoading} sub="invoices past due date" />
        <StatCard label="Drafts"          value={stats?.draftCount ?? 0}                                     icon={<FileText   className="w-5 h-5" />} color="amber" loading={sLoading} sub="pending to send" />
      </div>

      {/* Actions */}
      <div className="flex justify-end mb-6">
        <div className="flex gap-2">
          <button onClick={() => setShowInvoiceForm(p => !p)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Generate Invoice
          </button>
          <button onClick={() => setShowBulkForm(p => !p)}
            className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Bulk Generate
          </button>
        </div>
      </div>

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

          {/* Bulk generate form -- FR-INV-02/03 */}
          {showBulkForm && (
            <div className="bg-white border border-blue-100 rounded-xl p-5 mb-5 shadow-sm">
              <h3 className="font-semibold text-slate-900 mb-1 text-sm">Bulk Generate Invoices</h3>
              <p className="text-xs text-slate-500 mb-4">
                Generates one invoice per student assigned to the selected fee plan. This may take a moment for large classes.
              </p>
              <form onSubmit={bulkGenerateInvoices} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Fee Plan *</label>
                  <select required value={bulkForm.feePlanId}
                    onChange={e => setBulkForm(p => ({ ...p, feePlanId: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select plan</option>
                    {feePlans?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Due Date *</label>
                  <input required type="date" value={bulkForm.dueDate}
                    onChange={e => setBulkForm(p => ({ ...p, dueDate: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex gap-2 items-end">
                  <button type="submit" disabled={savingBulk}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors">
                    {savingBulk ? "Generating…" : "Generate for All Assigned"}
                  </button>
                  <button type="button" onClick={() => setShowBulkForm(false)}
                    className="px-4 py-2.5 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Bulk generate result -- FR-INV-03: shown honestly, never a
              silent "done" with no indication of what actually happened. */}
          {bulkResult && (
            <div className="mb-5 px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 text-sm">
              <p className="font-medium text-slate-900">
                {bulkResult.generated} invoice{bulkResult.generated === 1 ? "" : "s"} generated
                {bulkResult.skipped > 0 && `, ${bulkResult.skipped} skipped`}.
              </p>
              {bulkResult.errors.length > 0 && (
                <ul className="mt-1.5 text-xs text-amber-700 list-disc list-inside space-y-0.5">
                  {bulkResult.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                  {bulkResult.errors.length > 5 && <li>…and {bulkResult.errors.length - 5} more</li>}
                </ul>
              )}
              <button onClick={() => setBulkResult(null)} className="text-xs text-slate-400 hover:text-slate-600 mt-1.5">
                Dismiss
              </button>
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
                          <button onClick={() => router.push(`/dashboard/billing/collect-fee?studentId=${inv.student.id}`)}
                            className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">Collect Fee</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination meta={invoiceMeta} loading={overdueOnly ? overdueLoading : iLoading} />
          </div>
    </div>
  );
}
