"use client";
import { useState }  from "react";
import { Megaphone, Plus, Pin, Trash2 } from "lucide-react";
import { PageHeader }  from "@/components/ui/page-header";
import { StatCard }    from "@/components/ui/stat-card";
import { useApi }      from "@/lib/hooks";
import { apiClient }   from "@/lib/api";
import { useToast } from '@/lib/use-toast';


type Tab = "announcements" | "circulars";

export default function CommunicationPage() {
  const { toast } = useToast();

  const [tab,     setTab]     = useState<Tab>("announcements");
  const [showNew, setShowNew] = useState(false);
  const [saving,  setSaving]  = useState(false);

  const { data: announcements, loading: aLoad, refetch: refetchAnn  } = useApi<any[]>("/communication/announcements");
  const { data: circulars,     loading: cLoad, refetch: refetchCirc } = useApi<any[]>("/communication/circulars");
  const { data: stats,         loading: sLoad                       } = useApi<any>("/communication/stats");

  const [form, setForm] = useState({ title:"", body:"", isPinned:false, expiresAt:"", type:"announcement" });
  const f = (k:string) => (e:any) => setForm(p=>({...p,[k]:e.target.type==="checkbox"?e.target.checked:e.target.value}));

  const save = async (e:React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      if (form.type==="announcement") {
        await apiClient.post("/communication/announcements", { title:form.title, body:form.body, isPinned:form.isPinned, expiresAt:form.expiresAt||undefined });
        refetchAnn();
      } else {
        await apiClient.post("/communication/circulars", { title:form.title, body:form.body });
        refetchCirc();
      }
      setShowNew(false); setForm({ title:"", body:"", isPinned:false, expiresAt:"", type:"announcement" });
    } catch(err:any) { toast.error(err?.response?.data?.message ?? "Failed"); }
    finally { setSaving(false); }
  };

  const pin = async (id:string) => {
    try { await apiClient.patch(`/communication/announcements/${id}/pin`, {}); refetchAnn(); }
    catch(err:any) { toast.error(err?.response?.data?.message ?? "Failed"); }
  };

  const deleteAnn = async (id:string) => {
    if (!confirm("Delete this announcement?")) return;
    try { await apiClient.delete(`/communication/announcements/${id}`); refetchAnn(); }
    catch(err:any) { toast.error(err?.response?.data?.message ?? "Failed"); }
  };

  return (
    <div>
      <PageHeader title="Communication" subtitle="Announcements and circulars for students, staff and parents"
        action={
          <button onClick={()=>setShowNew(p=>!p)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4"/>New
          </button>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Announcements" value={stats?.announcements ?? 0} icon={<span>📢</span>} color="blue"   loading={sLoad}/>
        <StatCard label="Pinned"        value={stats?.pinned        ?? 0} icon={<span>📌</span>} color="amber"  loading={sLoad}/>
        <StatCard label="Circulars"     value={stats?.circulars     ?? 0} icon={<span>📄</span>} color="slate"  loading={sLoad}/>
      </div>

      {showNew && (
        <div className="bg-white border border-slate-100 rounded-xl p-5 mb-5 shadow-sm">
          <form onSubmit={save} className="space-y-4">
            <div className="flex gap-3">
              {["announcement","circular"].map(t=>(
                <button key={t} type="button" onClick={()=>setForm(p=>({...p,type:t}))}
                  className={`px-4 py-1.5 text-sm rounded-lg font-medium capitalize transition-colors ${form.type===t?"bg-blue-600 text-white":"bg-slate-100 text-slate-600"}`}>
                  {t}
                </button>
              ))}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Title *</label>
              <input required type="text" value={form.title} onChange={f("title")}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Body *</label>
              <textarea required rows={4} value={form.body} onChange={f("body")}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"/>
            </div>
            {form.type==="announcement" && (
              <div className="flex gap-6 items-center">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                  <input type="checkbox" checked={form.isPinned} onChange={f("isPinned")} className="accent-blue-600"/>
                  Pin announcement
                </label>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Expires</label>
                  <input type="date" value={form.expiresAt} onChange={f("expiresAt")}
                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium disabled:opacity-50">{saving?"Publishing...":"Publish"}</button>
              <button type="button" onClick={()=>setShowNew(false)} className="px-5 py-2 bg-slate-100 text-slate-600 text-sm rounded-lg">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-200 mb-5">
        {(["announcements","circulars"] as Tab[]).map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${tab===t?"border-blue-600 text-blue-600":"border-transparent text-slate-500 hover:text-slate-700"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab==="announcements" && (
        <div className="space-y-3">
          {aLoad ? [...Array(3)].map((_,i)=><div key={i} className="h-24 bg-white rounded-xl border border-slate-100 animate-pulse"/>) :
          !announcements||announcements.length===0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">No announcements yet</div>
          ) : announcements.map((a:any)=>(
            <div key={a.id} className={`bg-white rounded-xl border shadow-sm p-5 ${a.isPinned?"border-amber-200":"border-slate-100"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {a.isPinned && <Pin className="w-3.5 h-3.5 text-amber-500"/>}
                    <h3 className="font-semibold text-slate-900 text-sm">{a.title}</h3>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">{a.body}</p>
                  <p className="text-xs text-slate-400 mt-2">{new Date(a.createdAt).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>pin(a.id)} className={`p-1.5 rounded-lg transition-colors ${a.isPinned?"text-amber-500 bg-amber-50":"text-slate-400 hover:text-amber-500 hover:bg-amber-50"}`} title="Toggle pin">
                    <Pin className="w-3.5 h-3.5"/>
                  </button>
                  <button onClick={()=>deleteAnn(a.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                    <Trash2 className="w-3.5 h-3.5"/>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==="circulars" && (
        <div className="space-y-3">
          {cLoad ? [...Array(3)].map((_,i)=><div key={i} className="h-24 bg-white rounded-xl border border-slate-100 animate-pulse"/>) :
          !circulars||circulars.length===0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">No circulars yet</div>
          ) : circulars.map((c:any)=>(
            <div key={c.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <h3 className="font-semibold text-slate-900 text-sm mb-1">{c.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{c.body}</p>
              <p className="text-xs text-slate-400 mt-2">{new Date(c.createdAt).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
