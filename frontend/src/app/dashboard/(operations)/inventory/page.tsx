"use client";
import { useState }  from "react";
import { Package, Plus, AlertTriangle } from "lucide-react";
import { PageHeader }  from "@/components/ui/page-header";
import { StatCard }    from "@/components/ui/stat-card";
import { Badge }       from "@/components/ui/badge";
import { useApi }      from "@/lib/hooks";
import { apiClient }   from "@/lib/api";

type Tab = "assets"|"stock";

export default function InventoryPage() {
  const [tab, setTab]         = useState<Tab>("assets");
  const [showNew, setShowNew] = useState(false);
  const [saving,  setSaving]  = useState(false);

  const { data: assets,   loading: aLoad, refetch: ra } = useApi<any[]>("/inventory/assets");
  const { data: stock,    loading: sLoad, refetch: rs } = useApi<any[]>("/inventory/stock");
  const { data: lowStock, loading: lLoad               } = useApi<any[]>("/inventory/stock/low");

  const [aForm, setAForm] = useState({ name:"", category:"FURNITURE", serialNumber:"", purchaseDate:"", purchasePrice:"", location:"", condition:"GOOD" });
  const [sForm, setSForm] = useState({ name:"", category:"STATIONERY", unit:"pcs", quantity:"0", minQuantity:"5", unitCost:"", location:"" });
  const af = (k:string)=>(e:any)=>setAForm(p=>({...p,[k]:e.target.value}));
  const sf = (k:string)=>(e:any)=>setSForm(p=>({...p,[k]:e.target.value}));

  const saveAsset = async (e:React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      await apiClient.post("/inventory/assets", { ...aForm, purchasePrice:aForm.purchasePrice?parseFloat(aForm.purchasePrice):undefined });
      setShowNew(false); ra();
    } catch(err:any) { alert(err?.response?.data?.message ?? "Failed"); }
    finally { setSaving(false); }
  };

  const saveStock = async (e:React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      await apiClient.post("/inventory/stock", { ...sForm, quantity:+sForm.quantity, minQuantity:+sForm.minQuantity, unitCost:sForm.unitCost?parseFloat(sForm.unitCost):undefined });
      setShowNew(false); rs();
    } catch(err:any) { alert(err?.response?.data?.message ?? "Failed"); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader title="Inventory" subtitle="Assets, stock items and maintenance tracking"
        action={
          <button onClick={()=>setShowNew(p=>!p)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4"/>Add {tab==="assets"?"asset":"stock item"}
          </button>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total assets"    value={assets?.length   ?? 0}  icon={<Package className="w-5 h-5"/>}       color="blue"  loading={aLoad}/>
        <StatCard label="Stock items"     value={stock?.length    ?? 0}  icon={<Package className="w-5 h-5"/>}       color="green" loading={sLoad}/>
        <StatCard label="Low stock alerts"value={lowStock?.length ?? 0}  icon={<AlertTriangle className="w-5 h-5"/>} color="red"   loading={lLoad}/>
      </div>

      {showNew && tab==="assets" && (
        <div className="bg-white border border-slate-100 rounded-xl p-5 mb-5 shadow-sm">
          <h3 className="font-semibold text-slate-900 text-sm mb-4">Add asset</h3>
          <form onSubmit={saveAsset} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[{l:"Name *",k:"name",req:true},{l:"Category *",k:"category",req:true},{l:"Serial no.",k:"serialNumber"},{l:"Location",k:"location"},{l:"Purchase price",k:"purchasePrice",type:"number"}].map(({l,k,req,type})=>(
              <div key={k}>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{l}</label>
                <input type={type??"text"} required={req} value={(aForm as any)[k]} onChange={af(k)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Purchase date</label>
              <input type="date" value={aForm.purchaseDate} onChange={af("purchaseDate")}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Condition</label>
              <select value={aForm.condition} onChange={af("condition")}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                {["GOOD","FAIR","POOR","UNDER_REPAIR","DISPOSED"].map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="md:col-span-4 flex gap-3">
              <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium disabled:opacity-50">{saving?"Adding...":"Add asset"}</button>
              <button type="button" onClick={()=>setShowNew(false)} className="px-5 py-2 bg-slate-100 text-slate-600 text-sm rounded-lg">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {showNew && tab==="stock" && (
        <div className="bg-white border border-slate-100 rounded-xl p-5 mb-5 shadow-sm">
          <h3 className="font-semibold text-slate-900 text-sm mb-4">Add stock item</h3>
          <form onSubmit={saveStock} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[{l:"Name *",k:"name",req:true},{l:"Category *",k:"category",req:true},{l:"Unit *",k:"unit",req:true},{l:"Qty",k:"quantity",type:"number"},{l:"Min qty",k:"minQuantity",type:"number"},{l:"Unit cost",k:"unitCost",type:"number"},{l:"Location",k:"location"}].map(({l,k,req,type})=>(
              <div key={k}>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{l}</label>
                <input type={type??"text"} required={req} value={(sForm as any)[k]} onChange={sf(k)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
            ))}
            <div className="md:col-span-4 flex gap-3">
              <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium disabled:opacity-50">{saving?"Adding...":"Add item"}</button>
              <button type="button" onClick={()=>setShowNew(false)} className="px-5 py-2 bg-slate-100 text-slate-600 text-sm rounded-lg">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-200 mb-5">
        {(["assets","stock"] as Tab[]).map(t=>(
          <button key={t} onClick={()=>{setTab(t);setShowNew(false);}}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${tab===t?"border-blue-600 text-blue-600":"border-transparent text-slate-500 hover:text-slate-700"}`}>
            {t==="assets"?`Assets (${assets?.length??0})`:`Stock (${stock?.length??0})`}
          </button>
        ))}
        {(lowStock?.length??0) > 0 && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-red-500 font-medium">
            <AlertTriangle className="w-3.5 h-3.5"/>{lowStock?.length} low stock alerts
          </span>
        )}
      </div>

      {tab==="assets" && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 border-b border-slate-100">
              {["Name","Category","Serial no.","Location","Condition","Purchased","Last maintenance"].map(h=>(
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-slate-50">
              {aLoad ? [...Array(5)].map((_,i)=><tr key={i}>{[...Array(7)].map((_,j)=><td key={j} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse"/></td>)}</tr>) :
              !assets||assets.length===0 ? <tr><td colSpan={7} className="px-5 py-16 text-center text-slate-400 text-sm">No assets yet</td></tr> :
              assets.map((a:any)=>(
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3.5 font-medium text-slate-900">{a.name}</td>
                  <td className="px-5 py-3.5 text-slate-500">{a.category}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-slate-400">{a.serialNumber??'—'}</td>
                  <td className="px-5 py-3.5 text-slate-500">{a.location??'—'}</td>
                  <td className="px-5 py-3.5">
                    <Badge label={a.condition} variant={a.condition==="GOOD"?"success":a.condition==="FAIR"?"warning":"error"}/>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-400">{a.purchaseDate?new Date(a.purchaseDate).toLocaleDateString("en-IN"):'—'}</td>
                  <td className="px-5 py-3.5 text-xs text-slate-400">
                    {a.maintenanceLogs?.[0]?.performedAt ? new Date(a.maintenanceLogs[0].performedAt).toLocaleDateString("en-IN") : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab==="stock" && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 border-b border-slate-100">
              {["Name","Category","Unit","Quantity","Min qty","Unit cost","Status"].map(h=>(
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-slate-50">
              {sLoad ? [...Array(5)].map((_,i)=><tr key={i}>{[...Array(7)].map((_,j)=><td key={j} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse"/></td>)}</tr>) :
              !stock||stock.length===0 ? <tr><td colSpan={7} className="px-5 py-16 text-center text-slate-400 text-sm">No stock items yet</td></tr> :
              stock.map((s:any)=>(
                <tr key={s.id} className={`hover:bg-slate-50 ${s.quantity<=s.minQuantity?"bg-red-50/30":""}`}>
                  <td className="px-5 py-3.5 font-medium text-slate-900">{s.name}</td>
                  <td className="px-5 py-3.5 text-slate-500">{s.category}</td>
                  <td className="px-5 py-3.5 text-slate-500">{s.unit}</td>
                  <td className="px-5 py-3.5 font-semibold text-slate-800">{s.quantity}</td>
                  <td className="px-5 py-3.5 text-slate-500">{s.minQuantity}</td>
                  <td className="px-5 py-3.5 text-slate-500">{s.unitCost?`₹${Number(s.unitCost).toLocaleString("en-IN")}`:'—'}</td>
                  <td className="px-5 py-3.5">
                    {s.quantity<=s.minQuantity ? <Badge label="Low stock" variant="error"/> : <Badge label="OK" variant="success"/>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
