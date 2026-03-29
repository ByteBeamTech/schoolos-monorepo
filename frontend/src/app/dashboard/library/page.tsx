// path: apps/schoolos/frontend/src/app/dashboard/library/page.tsx

"use client";
import { useState }   from "react";
import { BookOpen, Plus, Search, RotateCcw } from "lucide-react";
import { PageHeader }  from "@/components/ui/page-header";
import { StatCard }    from "@/components/ui/stat-card";
import { Badge }       from "@/components/ui/badge";
import { useApi }      from "@/lib/hooks";
import { apiClient }   from "@/lib/api";
import { useSearchParams }  from "next/navigation";
import { FilterBuilder }    from "@/components/ui/filter-builder";
import { useFilterParams }  from "@/lib/use-filter-params";

type Tab = "catalog" | "overdue";

export default function LibraryPage() {
  const [tab, setTab] = useState<Tab>("catalog");
  const searchParams  = useSearchParams();
  
  // --- FIX: Add search state ---
  const [search, setSearch] = useState("");
  
  const { getParam }  = useFilterParams();
  const [showAdd,    setShowAdd]     = useState(false);
  const [showIssue,  setShowIssue]   = useState(false);
  const [saving,      setSaving]      = useState(false);

  const qs    = searchParams.toString();
  const { data: books,    loading: bLoad, refetch: refetchBooks  } = useApi<any[]>(`/library/books${qs ? "?" + qs : ""}`, [qs]);
  const { data: overdue, loading: oLoad, refetch: refetchOverdue } = useApi<any[]>("/library/overdue");
  const { data: stats,    loading: sLoad, refetch: refetchStats  } = useApi<any>("/library/stats");
  const { data: students }                                          = useApi<any>("/students?limit=500");

  const [bookForm, setBookForm] = useState({ title:"", author:"", isbn:"", subject:"", location:"", totalCopies:"1" });
  const [issueForm, setIssueForm] = useState({ bookId:"", studentId:"", dueDate:"" });
  const bf = (k:string) => (e:any) => setBookForm(p=>({...p,[k]:e.target.value}));
  const isf = (k:string) => (e:any) => setIssueForm(p=>({...p,[k]:e.target.value}));

  const saveBook = async (e:React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      await apiClient.post("/library/books", { ...bookForm, totalCopies: parseInt(bookForm.totalCopies) });
      setShowAdd(false); setBookForm({ title:"", author:"", isbn:"", subject:"", location:"", totalCopies:"1" });
      refetchBooks(); refetchStats();
    } catch(err:any) { alert(err?.response?.data?.message ?? "Failed"); }
    finally { setSaving(false); }
  };

  const issueBook = async (e:React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      await apiClient.post("/library/issue", issueForm);
      setShowIssue(false); setIssueForm({ bookId:"", studentId:"", dueDate:"" });
      refetchBooks(); refetchStats();
    } catch(err:any) { alert(err?.response?.data?.message ?? "Failed"); }
    finally { setSaving(false); }
  };

  const returnBook = async (issueId:string) => {
    try {
      await apiClient.post(`/library/return/${issueId}`, {});
      refetchOverdue(); refetchStats(); refetchBooks();
    } catch(err:any) { alert(err?.response?.data?.message ?? "Failed"); }
  };

  const LIBRARY_SCHEMA = {
    module: "LIBRARY", searchField: "search",
    fields: [{ id: "search", label: "Book", type: "text" as const, placeholder: "Search title, author, ISBN\u2026" }],
  };

  return (
    <div>
      <PageHeader title="Library" subtitle="Book catalog, issues and returns"
        action={
          <div className="flex gap-2">
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
            {[{l:"Title *",k:"title",req:true},{l:"Author",k:"author"},{l:"ISBN",k:"isbn"},{l:"Subject",k:"subject"},{l:"Location",k:"location"}].map(({l,k,req})=>(
              <div key={k}>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{l}</label>
                <input type="text" required={req} value={(bookForm as any)[k]} onChange={bf(k)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Copies *</label>
              <input type="number" min="1" required value={bookForm.totalCopies} onChange={bf("totalCopies")}
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
              <select required value={issueForm.studentId} onChange={isf("studentId")}
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

      <div className="flex gap-1 border-b border-slate-200 mb-5">
        {(["catalog","overdue"] as Tab[]).map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${tab===t?"border-blue-600 text-blue-600":"border-transparent text-slate-500 hover:text-slate-700"}`}>
            {t==="overdue"?`Overdue (${stats?.overdue??0})`:"Book catalog"}
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
                {["Title","Author","ISBN","Subject","Location","Copies","Available"].map(h=>(
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {bLoad ? [...Array(5)].map((_,i)=>(
                  <tr key={i}>{[...Array(7)].map((_,j)=><td key={j} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse"/></td>)}</tr>
                )) : !books||books.length===0 ? (
                  <tr><td colSpan={7} className="px-5 py-16 text-center text-slate-400 text-sm">No books yet. Add your first book above.</td></tr>
                ) : books.map((b:any)=>(
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3.5 font-medium text-slate-900">{b.title}</td>
                    <td className="px-5 py-3.5 text-slate-600">{b.author??'—'}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{b.isbn??'—'}</td>
                    <td className="px-5 py-3.5 text-slate-500">{b.subject??'—'}</td>
                    <td className="px-5 py-3.5 text-slate-500">{b.location??'—'}</td>
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
              {["Book","Student","Issued","Due date","Days overdue","Action"].map(h=>(
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
                    <td className="px-5 py-3.5 font-medium text-slate-900">{o.book?.title}</td>
                    <td className="px-5 py-3.5 text-slate-700">{o.student?.firstName} {o.student?.lastName}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">{new Date(o.issuedAt).toLocaleDateString("en-IN")}</td>
                    <td className="px-5 py-3.5 text-xs text-red-500 font-medium">{new Date(o.dueDate).toLocaleDateString("en-IN")}</td>
                    <td className="px-5 py-3.5"><Badge label={`${days}d`} variant="error"/></td>
                    <td className="px-5 py-3.5">
                      <button onClick={()=>returnBook(o.id)} className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                        <RotateCcw className="w-3 h-3"/>Return
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
