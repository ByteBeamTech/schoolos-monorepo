// path: apps/schoolos/frontend/src/app/dashboard/library/page.tsx

"use client";
import { useState }   from "react";
import { BookOpen, Plus, Search, RotateCcw, RefreshCw, AlertTriangle, Bookmark, IndianRupee, ClipboardList } from "lucide-react";
import { PageHeader }  from "@/components/ui/page-header";
import { StatCard }    from "@/components/ui/stat-card";
import { Badge, BadgeVariant } from "@/components/ui/badge";
import { useApi }      from "@/lib/hooks";
import { apiClient }   from "@/lib/api";
import { useSearchParams }  from "next/navigation";
import { useFilterParams }  from "@/lib/use-filter-params";
import { useToast } from '@/lib/use-toast';


type Tab = "catalog" | "overdue" | "active" | "reservations" | "fines" | "audits";

const RESERVATION_BADGE: Record<string, BadgeVariant> = {
  QUEUED: "neutral", READY_FOR_PICKUP: "info", FULFILLED: "success", CANCELLED: "neutral", EXPIRED: "warning",
};
const BILLING_BADGE: Record<string, BadgeVariant> = {
  PENDING: "warning", SENT_TO_BILLING: "info", BILLED: "purple", WAIVED: "neutral", CANCELLED: "neutral",
};
const AUDIT_BADGE: Record<string, BadgeVariant> = {
  IN_PROGRESS: "info", COMPLETED: "success", CANCELLED: "neutral",
};
const COPY_STATUSES = ["AVAILABLE", "ISSUED", "LOST", "DAMAGED", "IN_REPAIR", "DISPOSED"];

export default function LibraryPage() {
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>("catalog");
  const searchParams  = useSearchParams();
  const [search, setSearch] = useState("");
  const { getParam }  = useFilterParams();

  const [showAdd,      setShowAdd]     = useState(false);
  const [showIssue,    setShowIssue]   = useState(false);
  const [showReserve,  setShowReserve] = useState(false);
  const [saving,        setSaving]      = useState(false);

  const qs = searchParams.toString();
  const { data: books,     loading: bLoad, refetch: refetchBooks     } = useApi<any[]>(`/library/books${qs ? "?" + qs : ""}`, [qs]);
  const { data: overdue,   loading: oLoad, refetch: refetchOverdue   } = useApi<any[]>("/library/overdue");
  const { data: active,    loading: acLoad, refetch: refetchActive   } = useApi<any[]>("/library/issues?status=ISSUED", [tab]);
  const { data: stats,     loading: sLoad, refetch: refetchStats     } = useApi<any>("/library/stats");
  const { data: students }                                              = useApi<any>("/students?limit=500");
  const { data: reservations, loading: rLoad, refetch: refetchReservations } = useApi<any[]>("/library/reservations", [tab]);
  const { data: charges,      loading: cLoad, refetch: refetchCharges     } = useApi<any[]>("/library/charge-requests", [tab]);
  const { data: audits,       loading: auLoad, refetch: refetchAudits     } = useApi<any[]>("/library/inventory-audits", [tab]);

  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);
  const { data: auditDetail, loading: adLoad, refetch: refetchAuditDetail } =
    useApi<any>(selectedAuditId ? `/library/inventory-audits/${selectedAuditId}` : "", [selectedAuditId]);

  const refetchAll = () => { refetchBooks(); refetchStats(); refetchOverdue(); refetchActive(); };

  // ---------- Catalog / Issue forms (unchanged from before) ----------
  const [bookForm, setBookForm] = useState({ title:"", authorName:"", isbn:"", categoryName:"", initialCopies:"1" });
  const [issueForm, setIssueForm] = useState({ bookId:"", borrowerId:"", dueDate:"" });
  const bf = (k:string) => (e:any) => setBookForm(p=>({...p,[k]:e.target.value}));
  const isf = (k:string) => (e:any) => setIssueForm(p=>({...p,[k]:e.target.value}));

  const saveBook = async (e:React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      await apiClient.post("/library/books", { ...bookForm, initialCopies: parseInt(bookForm.initialCopies) || 0 });
      setShowAdd(false); setBookForm({ title:"", authorName:"", isbn:"", categoryName:"", initialCopies:"1" });
      refetchAll();
    } catch(err:any) { toast.error(err?.response?.data?.message ?? "Failed"); }
    finally { setSaving(false); }
  };

  const issueBook = async (e:React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      // borrowerType is hardcoded to STUDENT here -- this form only offers a
      // student picker today; a staff-borrower picker is new UX scope not
      // built yet (backend already supports BorrowerType.STAFF).
      await apiClient.post("/library/issue", { ...issueForm, borrowerType: "STUDENT" });
      setShowIssue(false); setIssueForm({ bookId:"", borrowerId:"", dueDate:"" });
      refetchAll();
    } catch(err:any) { toast.error(err?.response?.data?.message ?? "Failed"); }
    finally { setSaving(false); }
  };

  // ---------- Issue lifecycle actions: return / renew / mark lost ----------
  const returnBook = async (issueId:string, damaged=false) => {
    try {
      await apiClient.post(`/library/return/${issueId}`, { damaged });
      refetchAll(); refetchCharges();
    } catch(err:any) { toast.error(err?.response?.data?.message ?? "Failed"); }
  };
  const renewBook = async (issueId:string) => {
    try {
      await apiClient.post(`/library/issues/${issueId}/renew`, {});
      toast.success("Renewed"); refetchAll();
    } catch(err:any) { toast.error(err?.response?.data?.message ?? "Failed"); }
  };
  const markLost = async (issueId:string) => {
    try {
      await apiClient.post(`/library/issues/${issueId}/lost`, {});
      refetchAll(); refetchCharges();
    } catch(err:any) { toast.error(err?.response?.data?.message ?? "Failed"); }
  };

  // ---------- Reservations ----------
  const [reserveForm, setReserveForm] = useState({ bookId:"", borrowerId:"" });
  const rf = (k:string) => (e:any) => setReserveForm(p=>({...p,[k]:e.target.value}));

  const reserveBook = async (e:React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      await apiClient.post("/library/reservations", { ...reserveForm, borrowerType: "STUDENT" });
      setShowReserve(false); setReserveForm({ bookId:"", borrowerId:"" });
      refetchReservations();
    } catch(err:any) { toast.error(err?.response?.data?.message ?? "Failed"); }
    finally { setSaving(false); }
  };
  const cancelReservation = async (id:string) => {
    try { await apiClient.post(`/library/reservations/${id}/cancel`, {}); refetchReservations(); refetchAll(); }
    catch(err:any) { toast.error(err?.response?.data?.message ?? "Failed"); }
  };
  const fulfillReservation = async (id:string) => {
    try { await apiClient.post(`/library/reservations/${id}/fulfill`, {}); refetchReservations(); refetchAll(); }
    catch(err:any) { toast.error(err?.response?.data?.message ?? "Failed"); }
  };

  // ---------- Fines / Charge Requests ----------
  const sendToBilling = async (id:string) => {
    try { await apiClient.post(`/library/charge-requests/${id}/send-to-billing`, {}); refetchCharges(); }
    catch(err:any) { toast.error(err?.response?.data?.message ?? "Failed"); }
  };
  const waiveCharge = async (id:string) => {
    try { await apiClient.post(`/library/charge-requests/${id}/waive`, {}); refetchCharges(); }
    catch(err:any) { toast.error(err?.response?.data?.message ?? "Failed"); }
  };

  // ---------- Inventory Audits ----------
  const [scanForm, setScanForm] = useState({ barcode:"", scannedStatus:"AVAILABLE" });
  const sf = (k:string) => (e:any) => setScanForm(p=>({...p,[k]:e.target.value}));

  const startAudit = async () => {
    try {
      const res = await apiClient.post("/library/inventory-audits", {});
      refetchAudits(); setSelectedAuditId(res.data?.id ?? null);
    } catch(err:any) { toast.error(err?.response?.data?.message ?? "Failed"); }
  };
  const submitScan = async (e:React.FormEvent) => {
    e.preventDefault();
    if (!selectedAuditId || !scanForm.barcode.trim()) return;
    try {
      await apiClient.post(`/library/inventory-audits/${selectedAuditId}/scan`, { items: [scanForm] });
      setScanForm({ barcode:"", scannedStatus:"AVAILABLE" });
      refetchAuditDetail();
    } catch(err:any) { toast.error(err?.response?.data?.message ?? "Failed"); }
  };
  const completeAudit = async () => {
    if (!selectedAuditId) return;
    try { await apiClient.post(`/library/inventory-audits/${selectedAuditId}/complete`, {}); refetchAudits(); refetchAuditDetail(); }
    catch(err:any) { toast.error(err?.response?.data?.message ?? "Failed"); }
  };
  const resolveItem = async (itemId:string, toStatus:string) => {
    if (!selectedAuditId) return;
    try {
      await apiClient.post(`/library/inventory-audits/${selectedAuditId}/items/${itemId}/resolve`, { toStatus });
      refetchAuditDetail();
    } catch(err:any) { toast.error(err?.response?.data?.message ?? "Failed"); }
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: "catalog",      label: "Book catalog" },
    { id: "overdue",      label: `Overdue (${stats?.overdue ?? 0})` },
    { id: "active",       label: "Active loans" },
    { id: "reservations", label: "Reservations" },
    { id: "fines",        label: "Fines" },
    { id: "audits",       label: "Inventory audits" },
  ];

  return (
    <div>
      <PageHeader title="Library" subtitle="Book catalog, issues, reservations and fines"
        action={
          <div className="flex gap-2">
            <button onClick={()=>setShowReserve(p=>!p)} className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"><Bookmark className="w-4 h-4"/>Reserve</button>
            <button onClick={()=>setShowIssue(p=>!p)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Issue book</button>
            <button onClick={()=>setShowAdd(p=>!p)}   className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"><Plus className="w-4 h-4"/>Add book</button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total books"   value={stats?.totalBooks      ?? 0} icon={<span>📚</span>} color="blue"   loading={sLoad}/>
        <StatCard label="Available"     value={stats?.availableCopies ?? 0} icon={<span>✅</span>} color="green"  loading={sLoad}/>
        <StatCard label="Issued"        value={stats?.issued          ?? 0} icon={<span>📖</span>} color="amber"  loading={sLoad}/>
        <StatCard label="Overdue"       value={stats?.overdue         ?? 0} icon={<span>⚠️</span>}  color="red"    loading={sLoad}/>
      </div>

      {showAdd && (
        <div className="bg-white border border-slate-100 rounded-xl p-5 mb-5 shadow-sm">
          <h3 className="font-semibold text-slate-900 text-sm mb-4">Add book</h3>
          <form onSubmit={saveBook} className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[{l:"Title *",k:"title",req:true},{l:"Author",k:"authorName"},{l:"ISBN",k:"isbn"},{l:"Category",k:"categoryName"}].map(({l,k,req})=>(
              <div key={k}>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{l}</label>
                <input type="text" required={req} value={(bookForm as any)[k]} onChange={bf(k)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Copies *</label>
              <input type="number" min="0" required value={bookForm.initialCopies} onChange={bf("initialCopies")}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
            <div className="md:col-span-3 flex gap-3">
              <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium disabled:opacity-50">{saving?"Adding...":"Add book"}</button>
              <button type="button" onClick={()=>setShowAdd(false)} className="px-5 py-2 bg-slate-100 text-slate-600 text-sm rounded-lg">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {showIssue && (
        <div className="bg-white border border-emerald-100 rounded-xl p-5 mb-5 shadow-sm">
          <h3 className="font-semibold text-slate-900 text-sm mb-4">Issue book to student</h3>
          <form onSubmit={issueBook} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Book *</label>
              <select required value={issueForm.bookId} onChange={isf("bookId")}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select book...</option>
                {books?.filter((b:any)=>b.availableCopies>0).map((b:any)=>(
                  <option key={b.id} value={b.id}>{b.title} ({b.availableCopies} available)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Student *</label>
              <select required value={issueForm.borrowerId} onChange={isf("borrowerId")}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select student...</option>
                {students?.data?.map((s:any)=>(
                  <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admissionNumber})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Due date *</label>
              <input required type="date" value={issueForm.dueDate} onChange={isf("dueDate")}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
            <div className="flex gap-3 items-end">
              <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-emerald-600 text-white text-sm rounded-lg font-medium disabled:opacity-50">{saving?"Issuing...":"Issue"}</button>
              <button type="button" onClick={()=>setShowIssue(false)} className="px-4 py-2.5 bg-slate-100 text-slate-600 text-sm rounded-lg">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {showReserve && (
        <div className="bg-white border border-purple-100 rounded-xl p-5 mb-5 shadow-sm">
          <h3 className="font-semibold text-slate-900 text-sm mb-4">Reserve a book</h3>
          <p className="text-xs text-slate-400 mb-4">If a copy is free right now it will be held immediately; otherwise the borrower joins the queue and is notified when one becomes available.</p>
          <form onSubmit={reserveBook} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Book *</label>
              <select required value={reserveForm.bookId} onChange={rf("bookId")}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option value="">Select book...</option>
                {books?.map((b:any)=>(<option key={b.id} value={b.id}>{b.title}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Student *</label>
              <select required value={reserveForm.borrowerId} onChange={rf("borrowerId")}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option value="">Select student...</option>
                {students?.data?.map((s:any)=>(
                  <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admissionNumber})</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 items-end">
              <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-purple-600 text-white text-sm rounded-lg font-medium disabled:opacity-50">{saving?"Reserving...":"Reserve"}</button>
              <button type="button" onClick={()=>setShowReserve(false)} className="px-4 py-2.5 bg-slate-100 text-slate-600 text-sm rounded-lg">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-200 mb-5 overflow-x-auto">
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab===t.id?"border-blue-600 text-blue-600":"border-transparent text-slate-500 hover:text-slate-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab==="catalog" && (
        <div>
          <div className="relative mb-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
            <input type="text" placeholder="Search title, author, ISBN..." value={search} onChange={e=>setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 border-b border-slate-100">
                {["Title","Author","ISBN","Category","Copies","Available"].map(h=>(
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {bLoad ? [...Array(5)].map((_,i)=>(
                  <tr key={i}>{[...Array(6)].map((_,j)=><td key={j} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse"/></td>)}</tr>
                )) : !books||books.length===0 ? (
                  <tr><td colSpan={6} className="px-5 py-16 text-center text-slate-400 text-sm">No books yet. Add your first book above.</td></tr>
                ) : books.map((b:any)=>(
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3.5 font-medium text-slate-900">{b.title}</td>
                    <td className="px-5 py-3.5 text-slate-600">{b.authorNames?.length ? b.authorNames.join(', ') : '—'}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{b.isbn??'—'}</td>
                    <td className="px-5 py-3.5 text-slate-500">{b.category?.name??'—'}</td>
                    <td className="px-5 py-3.5 font-medium text-slate-700">{b.totalCopies}</td>
                    <td className="px-5 py-3.5"><Badge label={String(b.availableCopies)} variant={b.availableCopies>0?"success":"error"}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab==="overdue" && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 border-b border-slate-100">
              {["Book","Student","Issued","Due date","Days overdue","Actions"].map(h=>(
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-slate-50">
              {oLoad ? [...Array(4)].map((_,i)=>(
                <tr key={i}>{[...Array(6)].map((_,j)=><td key={j} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse"/></td>)}</tr>
              )) : !overdue||overdue.length===0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-emerald-600 font-medium text-sm">✓ No overdue books</td></tr>
              ) : overdue.map((o:any)=>{
                const days = Math.floor((Date.now()-new Date(o.dueDate).getTime())/86400000);
                return (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3.5 font-medium text-slate-900">{o.copy?.book?.title}</td>
                    <td className="px-5 py-3.5 text-slate-700">{o.borrowerNameSnapshot}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">{new Date(o.issuedAt).toLocaleDateString("en-IN")}</td>
                    <td className="px-5 py-3.5 text-xs text-red-500 font-medium">{new Date(o.dueDate).toLocaleDateString("en-IN")}</td>
                    <td className="px-5 py-3.5"><Badge label={`${days}d`} variant="error"/></td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <button onClick={()=>returnBook(o.id)} className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                          <RotateCcw className="w-3 h-3"/>Return
                        </button>
                        <button onClick={()=>renewBook(o.id)} className="text-xs text-emerald-600 hover:text-emerald-800 font-medium flex items-center gap-1">
                          <RefreshCw className="w-3 h-3"/>Renew
                        </button>
                        <button onClick={()=>markLost(o.id)} className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3"/>Lost
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab==="active" && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 border-b border-slate-100">
              {["Book","Borrower","Due date","Status","Actions"].map(h=>(
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-slate-50">
              {acLoad ? [...Array(4)].map((_,i)=>(
                <tr key={i}>{[...Array(5)].map((_,j)=><td key={j} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse"/></td>)}</tr>
              )) : !active||active.length===0 ? (
                <tr><td colSpan={5} className="px-5 py-16 text-center text-slate-400 text-sm">No active loans</td></tr>
              ) : active.map((iss:any)=>{
                const isOverdue = new Date(iss.dueDate).getTime() < Date.now();
                return (
                  <tr key={iss.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3.5 font-medium text-slate-900">{iss.copy?.book?.title}</td>
                    <td className="px-5 py-3.5 text-slate-700">{iss.borrowerNameSnapshot}</td>
                    <td className={`px-5 py-3.5 text-xs font-medium ${isOverdue?"text-red-500":"text-slate-500"}`}>{new Date(iss.dueDate).toLocaleDateString("en-IN")}</td>
                    <td className="px-5 py-3.5"><Badge label={isOverdue?"Overdue":"On time"} variant={isOverdue?"error":"success"}/></td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <button onClick={()=>returnBook(iss.id)} className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"><RotateCcw className="w-3 h-3"/>Return</button>
                        <button onClick={()=>returnBook(iss.id, true)} className="text-xs text-amber-600 hover:text-amber-800 font-medium">Return damaged</button>
                        <button onClick={()=>renewBook(iss.id)} className="text-xs text-emerald-600 hover:text-emerald-800 font-medium flex items-center gap-1"><RefreshCw className="w-3 h-3"/>Renew</button>
                        <button onClick={()=>markLost(iss.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Lost</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab==="reservations" && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 border-b border-slate-100">
              {["Book","Borrower","Requested","Status","Hold expires","Actions"].map(h=>(
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-slate-50">
              {rLoad ? [...Array(3)].map((_,i)=>(
                <tr key={i}>{[...Array(6)].map((_,j)=><td key={j} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse"/></td>)}</tr>
              )) : !reservations||reservations.length===0 ? (
                <tr><td colSpan={6} className="px-5 py-16 text-center text-slate-400 text-sm">No reservations. Use "Reserve" above to queue a borrower for a book that's fully checked out.</td></tr>
              ) : reservations.map((r:any)=>(
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3.5 font-medium text-slate-900">{r.book?.title}</td>
                  <td className="px-5 py-3.5 text-slate-700">{r.borrowerNameSnapshot}</td>
                  <td className="px-5 py-3.5 text-xs text-slate-500">{new Date(r.createdAt).toLocaleDateString("en-IN")}</td>
                  <td className="px-5 py-3.5"><Badge label={r.status.replace(/_/g," ")} variant={RESERVATION_BADGE[r.status] ?? "neutral"}/></td>
                  <td className="px-5 py-3.5 text-xs text-slate-500">{r.holdExpiresAt ? new Date(r.holdExpiresAt).toLocaleString("en-IN") : "—"}</td>
                  <td className="px-5 py-3.5">
                    {(r.status==="QUEUED"||r.status==="READY_FOR_PICKUP") && (
                      <div className="flex items-center gap-3">
                        {r.status==="READY_FOR_PICKUP" && (
                          <button onClick={()=>fulfillReservation(r.id)} className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">Check out</button>
                        )}
                        <button onClick={()=>cancelReservation(r.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Cancel</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab==="fines" && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-amber-50/50 flex items-start gap-2">
            <IndianRupee className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0"/>
            <p className="text-xs text-amber-700">These are Library's proposed charges only. Sending one to Billing is final from here — Library cannot waive it afterwards; that has to go through Billing's own process.</p>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 border-b border-slate-100">
              {["Borrower","Reason","Amount","Status","Raised","Actions"].map(h=>(
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-slate-50">
              {cLoad ? [...Array(3)].map((_,i)=>(
                <tr key={i}>{[...Array(6)].map((_,j)=><td key={j} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse"/></td>)}</tr>
              )) : !charges||charges.length===0 ? (
                <tr><td colSpan={6} className="px-5 py-16 text-center text-slate-400 text-sm">No fines raised</td></tr>
              ) : charges.map((c:any)=>(
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3.5 font-medium text-slate-900">{c.borrowerNameSnapshot}</td>
                  <td className="px-5 py-3.5"><Badge label={c.reason} variant={c.reason==="OVERDUE"?"warning":"error"}/></td>
                  <td className="px-5 py-3.5 font-semibold text-slate-700">₹{Number(c.computedAmount).toLocaleString("en-IN")}</td>
                  <td className="px-5 py-3.5"><Badge label={c.billingStatus.replace(/_/g," ")} variant={BILLING_BADGE[c.billingStatus] ?? "neutral"}/></td>
                  <td className="px-5 py-3.5 text-xs text-slate-500">{new Date(c.createdAt).toLocaleDateString("en-IN")}</td>
                  <td className="px-5 py-3.5">
                    {c.billingStatus==="PENDING" && (
                      <div className="flex items-center gap-3">
                        <button onClick={()=>sendToBilling(c.id)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Send to Billing</button>
                        <button onClick={()=>waiveCharge(c.id)} className="text-xs text-slate-500 hover:text-slate-700 font-medium">Waive</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab==="audits" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-slate-400"/>
                <h2 className="font-semibold text-slate-900 text-sm">Inventory audits</h2>
              </div>
              <button onClick={startAudit} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium">Start new audit</button>
            </div>
            {auLoad ? <div className="p-5 space-y-2">{[...Array(3)].map((_,i)=><div key={i} className="h-12 bg-slate-100 rounded animate-pulse"/>)}</div>
            : !audits||audits.length===0 ? <div className="p-12 text-center text-slate-400 text-sm">No audits yet — start one to reconcile shelf stock against the catalog.</div>
            : audits.map((a:any)=>(
              <button key={a.id} onClick={()=>setSelectedAuditId(a.id)}
                className={`w-full text-left px-5 py-3.5 border-b border-slate-50 hover:bg-slate-50 transition-colors ${selectedAuditId===a.id?"bg-blue-50 border-l-4 border-l-blue-500":""}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{new Date(a.startedAt).toLocaleString("en-IN")}</p>
                    <p className="text-xs text-slate-400">by {a.conductedBy}</p>
                  </div>
                  <Badge label={a.status.replace(/_/g," ")} variant={AUDIT_BADGE[a.status] ?? "neutral"}/>
                </div>
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900 text-sm">{selectedAuditId ? "Audit detail" : "Select an audit"}</h2>
            </div>
            {!selectedAuditId ? (
              <div className="p-12 text-center text-slate-300 text-sm">← Select or start an audit to scan copies</div>
            ) : adLoad ? (
              <div className="p-5 space-y-2">{[...Array(3)].map((_,i)=><div key={i} className="h-10 bg-slate-100 rounded animate-pulse"/>)}</div>
            ) : (
              <div>
                {auditDetail?.status==="IN_PROGRESS" && (
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                    <form onSubmit={submitScan} className="flex gap-2">
                      <input type="text" placeholder="Scan or type barcode" value={scanForm.barcode} onChange={sf("barcode")}
                        className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                      <select value={scanForm.scannedStatus} onChange={sf("scannedStatus")}
                        className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {COPY_STATUSES.map(s=><option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
                      </select>
                      <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium">Scan</button>
                    </form>
                    <button onClick={completeAudit} className="mt-3 text-xs text-emerald-600 hover:text-emerald-800 font-medium">Complete audit</button>
                  </div>
                )}
                <div className="max-h-[28rem] overflow-y-auto">
                  {auditDetail?.items?.length===0 ? (
                    <div className="p-12 text-center text-slate-400 text-sm">No copies expected at this branch</div>
                  ) : auditDetail?.items?.map((it:any)=>(
                    <div key={it.id} className={`px-5 py-3 border-b border-slate-50 flex items-center justify-between ${it.discrepancy?"bg-red-50/50":""}`}>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{it.copy?.book?.title ?? it.copyId}</p>
                        <p className="text-xs text-slate-400">Expected {it.expectedStatus.replace(/_/g," ")} · Scanned {it.scannedStatus?.replace(/_/g," ") ?? "not scanned"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {it.discrepancy && !it.resolvedAt && <Badge label="Discrepancy" variant="error"/>}
                        {it.discrepancy && !it.resolvedAt && (
                          <select onChange={(e)=>e.target.value && resolveItem(it.id, e.target.value)} defaultValue=""
                            className="text-xs border border-slate-200 rounded-lg px-2 py-1">
                            <option value="" disabled>Resolve as...</option>
                            {COPY_STATUSES.map(s=><option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
                          </select>
                        )}
                        {it.resolvedAt && <Badge label="Resolved" variant="success"/>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
