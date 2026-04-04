"use client";
import { useState }  from "react";
import { FileText, Plus, Printer } from "lucide-react";
import { PageHeader }  from "@/components/ui/page-header";
import { Badge }       from "@/components/ui/badge";
import { useApi }      from "@/lib/hooks";
import { apiClient }   from "@/lib/api";
import { useToast } from '@/lib/use-toast';


const CERT_TYPES = ["TRANSFER","BONAFIDE","CHARACTER","ACHIEVEMENT","MIGRATION","CONDUCT"];
const CERT_LABELS: Record<string,string> = {
  TRANSFER:"Transfer Certificate", BONAFIDE:"Bonafide Certificate",
  CHARACTER:"Character Certificate", ACHIEVEMENT:"Achievement Certificate",
  MIGRATION:"Migration Certificate", CONDUCT:"Conduct Certificate",
};
const CERT_V: Record<string,any> = { TRANSFER:"error", BONAFIDE:"info", CHARACTER:"success", ACHIEVEMENT:"purple", MIGRATION:"warning", CONDUCT:"neutral" };

export default function CertificatesPage() {
  const { data: certs,   loading, refetch } = useApi<any[]>("/certificates");
  const { data: students                  } = useApi<any>("/students?limit=500");
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [lastCert, setLastCert] = useState<any>(null);
  const [form, setForm] = useState({ studentId:"", type:"BONAFIDE", reason:"", notes:"" });
  const f = (k:string)=>(e:any)=>setForm(p=>({...p,[k]:e.target.value}));

  const issue = async (e:React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const res = await apiClient.post("/certificates", form);
      setLastCert(res.data); setShowForm(false);
      setForm({ studentId:"", type:"BONAFIDE", reason:"", notes:"" });
      refetch();
    } catch(err:any) { toast.error(err?.response?.data?.message ?? "Failed"); }
    finally { setSaving(false); }
  };

  const print = (cert:any) => {
    window.open(`/api/v1/certificates/${cert.id}/print`, "_blank");
  };

  return (
    <div>
      <PageHeader title="Certificates" subtitle="Issue TC, Bonafide, Character and other certificates"
        action={
          <button onClick={()=>setShowForm(p=>!p)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4"/>Issue certificate
          </button>
        }
      />

      {showForm && (
        <div className="bg-white border border-blue-100 rounded-xl p-5 mb-5 shadow-sm">
          <h3 className="font-semibold text-slate-900 text-sm mb-4">Issue certificate</h3>
          <form onSubmit={issue} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Student *</label>
              <select required value={form.studentId} onChange={f("studentId")}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select student...</option>
                {students?.data?.map((s:any)=>(
                  <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admissionNumber})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Certificate type *</label>
              <select required value={form.type} onChange={f("type")}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                {CERT_TYPES.map(t=><option key={t} value={t}>{CERT_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Purpose / reason</label>
              <input type="text" placeholder="e.g. For bank account opening" value={form.reason} onChange={f("reason")}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Internal notes</label>
              <input type="text" placeholder="Not printed on certificate" value={form.notes} onChange={f("notes")}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
            <div className="md:col-span-2 flex gap-3 pt-2 border-t border-slate-100">
              <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium disabled:opacity-50">{saving?"Issuing...":"Issue certificate"}</button>
              <button type="button" onClick={()=>setShowForm(false)} className="px-5 py-2 bg-slate-100 text-slate-600 text-sm rounded-lg">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {lastCert && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-5 flex items-center justify-between">
          <div>
            <p className="font-semibold text-emerald-800 text-sm">✓ Issued: {lastCert.certNumber}</p>
            <p className="text-emerald-600 text-xs mt-0.5">{lastCert.studentName} · {CERT_LABELS[lastCert.type]}</p>
          </div>
          <button onClick={()=>print(lastCert)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white text-xs rounded-lg hover:bg-emerald-800 transition-colors">
            <Printer className="w-3.5 h-3.5"/>Print
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-slate-50 border-b border-slate-100">
            {["Cert no.","Student","Class","Type","Reason","Issued","Action"].map(h=>(
              <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr></thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? [...Array(4)].map((_,i)=><tr key={i}>{[...Array(7)].map((_,j)=><td key={j} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse"/></td>)}</tr>) :
            !certs||certs.length===0 ? (
              <tr><td colSpan={7} className="px-5 py-16 text-center text-slate-400 text-sm">No certificates issued yet</td></tr>
            ) : certs.map((c:any)=>(
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-5 py-3.5 font-mono text-xs text-slate-600">{c.certNumber}</td>
                <td className="px-5 py-3.5 font-medium text-slate-900">{c.studentName}</td>
                <td className="px-5 py-3.5 text-slate-500">{c.className}</td>
                <td className="px-5 py-3.5"><Badge label={c.type} variant={CERT_V[c.type]}/></td>
                <td className="px-5 py-3.5 text-slate-400 text-xs">{c.reason||'—'}</td>
                <td className="px-5 py-3.5 text-xs text-slate-400">{new Date(c.issuedAt).toLocaleDateString("en-IN")}</td>
                <td className="px-5 py-3.5">
                  <button onClick={()=>print(c)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                    <Printer className="w-3 h-3"/>Print
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
