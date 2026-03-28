"use client";
import { useState }  from "react";
import { Bus, Plus, Users } from "lucide-react";
import { PageHeader }  from "@/components/ui/page-header";
import { StatCard }    from "@/components/ui/stat-card";
import { Badge }       from "@/components/ui/badge";
import { useApi }      from "@/lib/hooks";
import { apiClient }   from "@/lib/api";

export default function TransportPage() {
  const { data: routes,  loading: rLoad, refetch: refetchRoutes } = useApi<any[]>("/transport/routes");
  const { data: stats,   loading: sLoad, refetch: refetchStats  } = useApi<any>("/transport/stats");
  const { data: students }                                          = useApi<any>("/students?limit=500");
  const [selected,  setSelected]  = useState<string|null>(null);
  const { data: detail, loading: dLoad } = useApi<any>(selected?`/transport/routes/${selected}`:"", [selected]);

  const [showRoute,  setShowRoute]  = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [saving, setSaving] = useState(false);

  const [rf, setRf] = useState({ name:"", vehicleNumber:"", driverName:"", driverPhone:"", feeAmount:"0", description:"" });
  const [af, setAf] = useState({ studentId:"", routeId:"", boardingStop:"" });
  const r = (k:string) => (e:any) => setRf(p=>({...p,[k]:e.target.value}));
  const a = (k:string) => (e:any) => setAf(p=>({...p,[k]:e.target.value}));

  const createRoute = async (e:React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      await apiClient.post("/transport/routes", { ...rf, feeAmount: parseFloat(rf.feeAmount) });
      setShowRoute(false); setRf({ name:"", vehicleNumber:"", driverName:"", driverPhone:"", feeAmount:"0", description:"" });
      refetchRoutes(); refetchStats();
    } catch(err:any) { alert(err?.response?.data?.message ?? "Failed"); }
    finally { setSaving(false); }
  };

  const assignStudent = async (e:React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      await apiClient.post("/transport/assign", af);
      setShowAssign(false); setAf({ studentId:"", routeId:"", boardingStop:"" });
      refetchStats(); setSelected(null);
    } catch(err:any) { alert(err?.response?.data?.message ?? "Failed"); }
    finally { setSaving(false); }
  };

  const unassign = async (studentId:string) => {
    try { await apiClient.delete(`/transport/unassign/${studentId}`); refetchStats(); setSelected(null); }
    catch(err:any) { alert(err?.response?.data?.message ?? "Failed"); }
  };

  return (
    <div>
      <PageHeader title="Transport" subtitle="Routes, vehicles and student assignments"
        action={
          <div className="flex gap-2">
            <button onClick={()=>setShowAssign(p=>!p)} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"><Users className="w-4 h-4"/>Assign student</button>
            <button onClick={()=>setShowRoute(p=>!p)}  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"><Plus className="w-4 h-4"/>Add route</button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 mb-6">
        <StatCard label="Active routes"     value={stats?.routes   ?? 0} icon={<span>🚌</span>} color="blue"  loading={sLoad}/>
        <StatCard label="Students assigned" value={stats?.assigned ?? 0} icon={<span>👥</span>} color="green" loading={sLoad}/>
      </div>

      {showRoute && (
        <div className="bg-white border border-slate-100 rounded-xl p-5 mb-5 shadow-sm">
          <h3 className="font-semibold text-slate-900 text-sm mb-4">Add route</h3>
          <form onSubmit={createRoute} className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[{l:"Route name *",k:"name",req:true},{l:"Vehicle no.",k:"vehicleNumber"},{l:"Driver name",k:"driverName"},{l:"Driver phone",k:"driverPhone"},{l:"Monthly fee (₹)",k:"feeAmount",type:"number"},{l:"Description",k:"description"}].map(({l,k,req,type})=>(
              <div key={k}>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{l}</label>
                <input type={type??"text"} required={req} value={(rf as any)[k]} onChange={r(k)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
            ))}
            <div className="md:col-span-3 flex gap-3">
              <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium disabled:opacity-50">{saving?"Creating...":"Create route"}</button>
              <button type="button" onClick={()=>setShowRoute(false)} className="px-5 py-2 bg-slate-100 text-slate-600 text-sm rounded-lg">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {showAssign && (
        <div className="bg-white border border-emerald-100 rounded-xl p-5 mb-5 shadow-sm">
          <h3 className="font-semibold text-slate-900 text-sm mb-4">Assign student to route</h3>
          <form onSubmit={assignStudent} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { l:"Student *", k:"studentId", type:"select", options: students?.data?.map((s:any)=>({ value:s.id, label:`${s.firstName} ${s.lastName} (${s.admissionNumber})` })) ?? [] },
              { l:"Route *",   k:"routeId",   type:"select", options: routes?.map((r:any)=>({ value:r.id, label:r.name })) ?? [] },
            ].map(({l,k,type,options})=>(
              <div key={k}>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{l}</label>
                <select required value={(af as any)[k]} onChange={a(k)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select...</option>
                  {options.map((o:any)=><option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Boarding stop</label>
              <input type="text" value={af.boardingStop} onChange={a("boardingStop")} placeholder="e.g. City Centre"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
            <div className="flex gap-3 items-end">
              <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-emerald-600 text-white text-sm rounded-lg font-medium disabled:opacity-50">{saving?"Assigning...":"Assign"}</button>
              <button type="button" onClick={()=>setShowAssign(false)} className="px-4 py-2.5 bg-slate-100 text-slate-600 text-sm rounded-lg">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Bus className="w-4 h-4 text-slate-400"/>
            <h2 className="font-semibold text-slate-900 text-sm">Routes</h2>
          </div>
          {rLoad ? <div className="p-5 space-y-2">{[...Array(3)].map((_,i)=><div key={i} className="h-12 bg-slate-100 rounded animate-pulse"/>)}</div>
          : !routes||routes.length===0 ? <div className="p-12 text-center text-slate-400 text-sm">No routes yet</div>
          : routes.map((route:any)=>(
            <button key={route.id} onClick={()=>setSelected(selected===route.id?null:route.id)}
              className={`w-full text-left px-5 py-4 border-b border-slate-50 hover:bg-slate-50 transition-colors ${selected===route.id?"bg-blue-50 border-l-4 border-l-blue-500":""}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900 text-sm">{route.name}</p>
                  <p className="text-xs text-slate-400">{route.vehicleNumber??'No vehicle'} · {route.driverName??'No driver'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-700">₹{Number(route.feeAmount).toLocaleString("en-IN")}<span className="text-xs text-slate-400 font-normal">/mo</span></p>
                  <p className="text-xs text-slate-400">{route._count?.assignments??0} students</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400"/>
            <h2 className="font-semibold text-slate-900 text-sm">{selected ? "Students on route" : "Select a route"}</h2>
          </div>
          {!selected ? (
            <div className="p-12 text-center text-slate-300 text-sm">← Click a route to view students</div>
          ) : dLoad ? (
            <div className="p-5 space-y-2">{[...Array(3)].map((_,i)=><div key={i} className="h-10 bg-slate-100 rounded animate-pulse"/>)}</div>
          ) : detail?.assignments?.length===0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">No students on this route</div>
          ) : detail?.assignments?.map((a:any)=>(
            <div key={a.id} className="px-5 py-3.5 border-b border-slate-50 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">{a.student?.firstName} {a.student?.lastName}</p>
                <p className="text-xs text-slate-400">{a.student?.admissionNumber}{a.boardingStop?` · ${a.boardingStop}`:""}</p>
              </div>
              <button onClick={()=>unassign(a.student?.id)} className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors">Unassign</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
