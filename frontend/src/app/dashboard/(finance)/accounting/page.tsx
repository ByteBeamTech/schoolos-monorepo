"use client";
import { useState }  from "react";
import { Receipt, Plus, Download } from "lucide-react";
import { PageHeader }  from "@/components/ui/page-header";
import { StatCard }    from "@/components/ui/stat-card";
import { Badge }       from "@/components/ui/badge";
import { useApi }      from "@/lib/hooks";
import { apiClient }   from "@/lib/api";
import { useToast } from '@/lib/use-toast';


const CATEGORIES = ["UTILITIES","STATIONERY","MAINTENANCE","SALARIES","TRANSPORT","EVENTS","EQUIPMENT","PETTY_CASH","OTHER"];
const CAT_COLORS: Record<string, any> = { UTILITIES:"info", MAINTENANCE:"warning", SALARIES:"purple", EVENTS:"success", OTHER:"neutral" };

export default function AccountingPage() {
  const { toast } = useToast();

  const [tab,     setTab]     = useState<"expenses"|"vendors">("expenses");
  const [showNew, setShowNew] = useState(false);
  const [catFilter,setCatFilter] = useState("");
  const [fromDate, setFromDate]  = useState("");
  const [toDate,   setToDate]    = useState("");
  const [saving,   setSaving]    = useState(false);

  const expUrl = `/accounting/expenses${catFilter||fromDate||toDate ? "?" + new URLSearchParams(Object.fromEntries([["category",catFilter],["fromDate",fromDate],["toDate",toDate]].filter(([,v])=>v))).toString() : ""}`;
  const { data: expenses, loading: eLoad, refetch: refetchExp } = useApi<any[]>(expUrl, [catFilter, fromDate, toDate]);
  const { data: vendors,  loading: vLoad, refetch: refetchVend } = useApi<any[]>("/accounting/vendors");
  const { data: stats,    loading: sLoad                        } = useApi<any>("/accounting/stats");

  const [form, setForm]   = useState({ category:"OTHER", amount:"", description:"", expenseDate:"", vendorId:"" });
  const [vForm, setVForm] = useState({ name:"", contactName:"", phone:"", email:"", gstNumber:"" });
  const [showVend, setShowVend] = useState(false);
  const f  = (k:string) => (e:any) => setForm(p=>({...p,[k]:e.target.value}));
  const vf = (k:string) => (e:any) => setVForm(p=>({...p,[k]:e.target.value}));

  const saveExpense = async (e:React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      await apiClient.post("/accounting/expenses", { ...form, amount: parseFloat(form.amount) });
      setShowNew(false); setForm({ category:"OTHER", amount:"", description:"", expenseDate:"", vendorId:"" });
      refetchExp();
    } catch(err:any) { toast.error(err?.response?.data?.message ?? "Failed"); }
    finally { setSaving(false); }
  };

  const saveVendor = async (e:React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      await apiClient.post("/accounting/vendors", vForm);
      setShowVend(false); setVForm({ name:"", contactName:"", phone:"", email:"", gstNumber:"" });
      refetchVend();
    } catch(err:any) { toast.error(err?.response?.data?.message ?? "Failed"); }
    finally { setSaving(false); }
  };

  const exportTally = () => {
    if (!fromDate||!toDate) { toast.error("Select date range for Tally export"); return; }
    window.open(`/api/v1/accounting/export/tally?fromDate=${fromDate}&toDate=${toDate}`, "_blank");
  };

  return (
    <div>
      <PageHeader title="Accounting" subtitle="Expense tracking, vendor management and Tally export"
        action={
          <div className="flex gap-2">
            <button onClick={exportTally} className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg font-medium transition-colors">
              <Download className="w-4 h-4"/>Export to Tally
            </button>
            <button onClick={()=>setShowNew(p=>!p)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <Plus className="w-4 h-4"/>Add expense
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total expenses"   value={`₹${(stats?.totalExpenses??0).toLocaleString("en-IN")}`} icon={<span>💰</span>} color="blue"   loading={sLoad}/>
        <StatCard label="This month"       value={`₹${(stats?.thisMonthTotal??0).toLocaleString("en-IN")}`} icon={<span>📅</span>} color="green"  loading={sLoad}/>
        <StatCard label="Total records"    value={stats?.expenseCount  ?? 0} icon={<span>🧾</span>} color="amber"  loading={sLoad}/>
        <StatCard label="Active vendors"   value={stats?.activeVendors ?? 0} icon={<span>🏪</span>} color="slate"  loading={sLoad}/>
      </div>

      {showNew && (
        <div className="bg-white border border-slate-100 rounded-xl p-5 mb-5 shadow-sm">
          <h3 className="font-semibold text-slate-900 text-sm mb-4">Add expense</h3>
          <form onSubmit={saveExpense} className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Category *</label>
              <select required value={form.category} onChange={f("category")}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                {CATEGORIES.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Amount (₹) *</label>
              <input required type="number" min="0" step="0.01" value={form.amount} onChange={f("amount")}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Date *</label>
              <input required type="date" value={form.expenseDate} onChange={f("expenseDate")}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Description *</label>
              <input required type="text" value={form.description} onChange={f("description")}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Vendor</label>
              <select value={form.vendorId} onChange={f("vendorId")}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">No vendor</option>
                {vendors?.map((v:any)=><option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-3 flex gap-3">
              <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium disabled:opacity-50">{saving?"Saving...":"Save expense"}</button>
              <button type="button" onClick={()=>setShowNew(false)} className="px-5 py-2 bg-slate-100 text-slate-600 text-sm rounded-lg">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-200 mb-5">
        {(["expenses","vendors"] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${tab===t?"border-blue-600 text-blue-600":"border-transparent text-slate-500 hover:text-slate-700"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab==="expenses" && (
        <div>
          <div className="flex gap-3 mb-4 flex-wrap items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Category</label>
              <select value={catFilter} onChange={e=>setCatFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All categories</option>
                {CATEGORIES.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">From</label>
              <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">To</label>
              <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 border-b border-slate-100">
                {["Date","Category","Description","Vendor","Amount","Approved"].map(h=>(
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {eLoad ? [...Array(6)].map((_,i)=>(
                  <tr key={i}>{[...Array(6)].map((_,j)=><td key={j} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse"/></td>)}</tr>
                )) : !expenses||expenses.length===0 ? (
                  <tr><td colSpan={6} className="px-5 py-16 text-center text-slate-400 text-sm">No expenses found</td></tr>
                ) : expenses.map((e:any)=>(
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3.5 text-xs text-slate-500">{new Date(e.expenseDate).toLocaleDateString("en-IN")}</td>
                    <td className="px-5 py-3.5"><Badge label={e.category} variant={CAT_COLORS[e.category]??"neutral"}/></td>
                    <td className="px-5 py-3.5 text-slate-800">{e.description}</td>
                    <td className="px-5 py-3.5 text-slate-500">{e.vendor?.name??'—'}</td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900">₹{Number(e.amount).toLocaleString("en-IN")}</td>
                    <td className="px-5 py-3.5">
                      {e.approvedBy ? <Badge label="Approved" variant="success"/> : <Badge label="Pending" variant="neutral"/>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab==="vendors" && (
        <div>
          <div className="mb-4">
            <button onClick={()=>setShowVend(p=>!p)} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors">
              <Plus className="w-4 h-4"/>Add vendor
            </button>
          </div>
          {showVend && (
            <div className="bg-white border border-slate-100 rounded-xl p-5 mb-5 shadow-sm">
              <form onSubmit={saveVendor} className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[{l:"Name *",k:"name",req:true},{l:"Contact",k:"contactName"},{l:"Phone",k:"phone"},{l:"Email",k:"email"},{l:"GST No.",k:"gstNumber"}].map(({l,k,req})=>(
                  <div key={k}>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{l}</label>
                    <input type="text" required={req} value={(vForm as any)[k]} onChange={vf(k)}
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                  </div>
                ))}
                <div className="md:col-span-3 flex gap-3">
                  <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium disabled:opacity-50">{saving?"Saving...":"Add vendor"}</button>
                  <button type="button" onClick={()=>setShowVend(false)} className="px-5 py-2 bg-slate-100 text-slate-600 text-sm rounded-lg">Cancel</button>
                </div>
              </form>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vLoad ? [...Array(4)].map((_,i)=><div key={i} className="h-28 bg-white rounded-xl border border-slate-100 animate-pulse"/>) :
            !vendors||vendors.length===0 ? <div className="col-span-3 text-center py-12 text-slate-400 text-sm">No vendors yet</div> :
            vendors.map((v:any)=>(
              <div key={v.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                <p className="font-semibold text-slate-900">{v.name}</p>
                {v.contactName && <p className="text-sm text-slate-500 mt-0.5">{v.contactName}</p>}
                {v.phone && <p className="text-xs text-slate-400 mt-1">{v.phone}</p>}
                {v.gstNumber && <p className="text-xs font-mono text-slate-400">GST: {v.gstNumber}</p>}
                <p className="text-xs text-slate-400 mt-2">{v._count?.expenses ?? 0} expenses recorded</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
