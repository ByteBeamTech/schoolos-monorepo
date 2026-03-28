"use client";
import { useState }  from "react";
import { Wallet, Plus } from "lucide-react";
import { PageHeader }  from "@/components/ui/page-header";
import { StatCard }    from "@/components/ui/stat-card";
import { Badge }       from "@/components/ui/badge";
import { useApi }      from "@/lib/hooks";
import { apiClient }   from "@/lib/api";

const now  = new Date();
const MONTH = now.getMonth() + 1;
const YEAR  = now.getFullYear();

const STATUS_V: Record<string, any> = { DRAFT:"neutral", APPROVED:"info", PAID:"success", CANCELLED:"error" };

export default function PayrollPage() {
  const { data: stats,   loading: sLoad, refetch: rs } = useApi<any>(`/payroll/stats?month=${MONTH}&year=${YEAR}`);
  const { data: payslips,loading: pLoad, refetch: rp } = useApi<any[]>(`/payroll/payslips?month=${MONTH}&year=${YEAR}`);
  const { data: structs, loading: stLoad              } = useApi<any[]>("/payroll/structures");

  const [showGen, setShowGen] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [form,    setForm]    = useState({ staffId:"", month:String(MONTH), year:String(YEAR), presentDays:"26" });
  const f = (k:string) => (e:any) => setForm(p=>({...p,[k]:e.target.value}));

  const generate = async (e:React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      await apiClient.post("/payroll/payslips/generate", { ...form, month:+form.month, year:+form.year, presentDays:+form.presentDays });
      setShowGen(false); rp(); rs();
    } catch(err:any) { alert(err?.response?.data?.message ?? "Failed"); }
    finally { setSaving(false); }
  };

  const approve  = async (id:string) => { try { await apiClient.patch(`/payroll/payslips/${id}/approve`,{}); rp(); rs(); } catch(e:any){alert(e?.response?.data?.message);} };
  const markPaid = async (id:string) => { try { await apiClient.patch(`/payroll/payslips/${id}/mark-paid`,{}); rp(); rs(); } catch(e:any){alert(e?.response?.data?.message);} };

  return (
    <div>
      <PageHeader title="Payroll" subtitle={`${now.toLocaleString('en-IN',{month:'long'})} ${YEAR}`}
        action={
          <button onClick={()=>setShowGen(p=>!p)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4"/>Generate payslip
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total staff"  value={stats?.total   ?? 0}  icon={<Wallet className="w-5 h-5"/>} color="blue"  loading={sLoad}/>
        <StatCard label="Paid"         value={stats?.paid    ?? 0}  icon={<Wallet className="w-5 h-5"/>} color="green" loading={sLoad}/>
        <StatCard label="Draft"        value={stats?.draft   ?? 0}  icon={<Wallet className="w-5 h-5"/>} color="amber" loading={sLoad}/>
        <StatCard label="Total payout" value={`₹${(stats?.totalNet??0).toLocaleString("en-IN")}`} icon={<Wallet className="w-5 h-5"/>} color="purple" loading={sLoad}/>
      </div>

      {showGen && (
        <div className="bg-white border border-slate-100 rounded-xl p-5 mb-5 shadow-sm">
          <h3 className="font-semibold text-slate-900 text-sm mb-4">Generate payslip</h3>
          <form onSubmit={generate} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Staff member *</label>
              <select required value={form.staffId} onChange={f("staffId")}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select staff...</option>
                {structs?.map((s:any)=><option key={s.staffId} value={s.staffId}>{s.staffId}</option>)}
              </select>
            </div>
            {[{l:"Month",k:"month",type:"number"},{l:"Year",k:"year",type:"number"},{l:"Present days",k:"presentDays",type:"number"}].map(({l,k,type})=>(
              <div key={k}>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{l}</label>
                <input type={type} required value={(form as any)[k]} onChange={f(k)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
            ))}
            <div className="md:col-span-4 flex gap-3">
              <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium disabled:opacity-50">{saving?"Generating...":"Generate"}</button>
              <button type="button" onClick={()=>setShowGen(false)} className="px-5 py-2 bg-slate-100 text-slate-600 text-sm rounded-lg">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-slate-50 border-b border-slate-100">
            {["Staff ID","Month","Gross","PF","TDS","Net salary","Status","Actions"].map(h=>(
              <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr></thead>
          <tbody className="divide-y divide-slate-50">
            {pLoad ? [...Array(5)].map((_,i)=>(
              <tr key={i}>{[...Array(8)].map((_,j)=><td key={j} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse"/></td>)}</tr>
            )) : !payslips||payslips.length===0 ? (
              <tr><td colSpan={8} className="px-5 py-16 text-center text-slate-400 text-sm">No payslips for this month. Generate above.</td></tr>
            ) : payslips.map((p:any)=>(
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-5 py-3.5 font-mono text-xs text-slate-600">{p.staffId.slice(0,12)}</td>
                <td className="px-5 py-3.5 text-slate-600">{p.month}/{p.year}</td>
                <td className="px-5 py-3.5 font-medium text-slate-800">₹{Number(p.grossSalary).toLocaleString("en-IN")}</td>
                <td className="px-5 py-3.5 text-slate-500">₹{Number(p.pfDeduction).toLocaleString("en-IN")}</td>
                <td className="px-5 py-3.5 text-slate-500">₹{Number(p.tdsDeduction).toLocaleString("en-IN")}</td>
                <td className="px-5 py-3.5 font-bold text-slate-900">₹{Number(p.netSalary).toLocaleString("en-IN")}</td>
                <td className="px-5 py-3.5"><Badge label={p.status} variant={STATUS_V[p.status]}/></td>
                <td className="px-5 py-3.5">
                  <div className="flex gap-3">
                    {p.status==="DRAFT"    && <button onClick={()=>approve(p.id)}  className="text-xs text-blue-600 hover:text-blue-800 font-medium">Approve</button>}
                    {p.status==="APPROVED" && <button onClick={()=>markPaid(p.id)} className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">Mark paid</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
