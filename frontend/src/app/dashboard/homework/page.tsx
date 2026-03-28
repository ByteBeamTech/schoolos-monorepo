"use client";
import { useState }  from "react";
import { BookOpen, Plus } from "lucide-react";
import { PageHeader }  from "@/components/ui/page-header";
import { StatCard }    from "@/components/ui/stat-card";
import { Badge }       from "@/components/ui/badge";
import { useApi, useAcademicSessions } from "@/lib/hooks";
import { apiClient }   from "@/lib/api";

export default function HomeworkPage() {
  const { data: stats,  loading: sLoad            } = useApi<any>("/homework/stats");
  const { data: list,   loading: lLoad, refetch    } = useApi<any[]>("/homework");
  const { sessions }                                  = useAcademicSessions();
  const { data: classes }                             = useApi<any>("/academics/classes");
  const { data: subjects }                            = useApi<any[]>("/academics/subjects");
  const [showNew, setShowNew] = useState(false);
  const [saving,  setSaving]  = useState(false);

  const [form, setForm] = useState({ sessionId:"", classId:"", subjectId:"", title:"", dueDate:"", description:"", maxMarks:"" });
  const f = (k:string)=>(e:any)=>setForm(p=>({...p,[k]:e.target.value}));

  const create = async (e:React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      await apiClient.post("/homework", { ...form, maxMarks:form.maxMarks?+form.maxMarks:undefined });
      setShowNew(false); setForm({ sessionId:"", classId:"", subjectId:"", title:"", dueDate:"", description:"", maxMarks:"" });
      refetch();
    } catch(err:any) { alert(err?.response?.data?.message ?? "Failed"); }
    finally { setSaving(false); }
  };

  const isOverdue = (dueDate:string) => new Date(dueDate) < new Date();

  return (
    <div>
      <PageHeader title="Homework" subtitle="Assign and track homework across classes"
        action={
          <button onClick={()=>setShowNew(p=>!p)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4"/>Assign homework
          </button>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total assigned" value={stats?.total    ?? 0} icon={<BookOpen className="w-5 h-5"/>} color="blue"  loading={sLoad}/>
        <StatCard label="Due soon"       value={stats?.dueSoon  ?? 0} icon={<BookOpen className="w-5 h-5"/>} color="amber" loading={sLoad}/>
        <StatCard label="Submissions"    value={stats?.submitted?? 0} icon={<BookOpen className="w-5 h-5"/>} color="green" loading={sLoad}/>
      </div>

      {showNew && (
        <div className="bg-white border border-slate-100 rounded-xl p-5 mb-5 shadow-sm">
          <h3 className="font-semibold text-slate-900 text-sm mb-4">Assign homework</h3>
          <form onSubmit={create} className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Session *</label>
              <select required value={form.sessionId} onChange={f("sessionId")}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select session...</option>
                {sessions?.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Class *</label>
              <select required value={form.classId} onChange={f("classId")}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select class...</option>
                {classes?.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Subject *</label>
              <select required value={form.subjectId} onChange={f("subjectId")}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select subject...</option>
                {subjects?.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Title *</label>
              <input required type="text" value={form.title} onChange={f("title")}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Due date *</label>
              <input required type="date" value={form.dueDate} onChange={f("dueDate")}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Max marks</label>
              <input type="number" min="0" value={form.maxMarks} onChange={f("maxMarks")}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Description</label>
              <textarea rows={2} value={form.description} onChange={f("description")}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"/>
            </div>
            <div className="md:col-span-3 flex gap-3">
              <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium disabled:opacity-50">{saving?"Saving...":"Assign"}</button>
              <button type="button" onClick={()=>setShowNew(false)} className="px-5 py-2 bg-slate-100 text-slate-600 text-sm rounded-lg">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-slate-50 border-b border-slate-100">
            {["Title","Class","Subject","Due date","Max marks","Submissions","Status"].map(h=>(
              <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr></thead>
          <tbody className="divide-y divide-slate-50">
            {lLoad ? [...Array(5)].map((_,i)=><tr key={i}>{[...Array(7)].map((_,j)=><td key={j} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse"/></td>)}</tr>) :
            !list||list.length===0 ? (
              <tr><td colSpan={7} className="px-5 py-16 text-center text-slate-400 text-sm">No homework assigned yet</td></tr>
            ) : list.map((h:any)=>(
              <tr key={h.id} className="hover:bg-slate-50">
                <td className="px-5 py-3.5 font-medium text-slate-900">{h.title}</td>
                <td className="px-5 py-3.5 text-slate-500">{h.classId?.slice(0,8)}</td>
                <td className="px-5 py-3.5 text-slate-500">{h.subjectId?.slice(0,8)}</td>
                <td className="px-5 py-3.5 text-xs text-slate-500">{new Date(h.dueDate).toLocaleDateString("en-IN")}</td>
                <td className="px-5 py-3.5 text-slate-500">{h.maxMarks??'—'}</td>
                <td className="px-5 py-3.5 text-slate-500">{h._count?.submissions??0}</td>
                <td className="px-5 py-3.5">
                  <Badge label={isOverdue(h.dueDate)?"Overdue":"Active"} variant={isOverdue(h.dueDate)?"error":"success"}/>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
