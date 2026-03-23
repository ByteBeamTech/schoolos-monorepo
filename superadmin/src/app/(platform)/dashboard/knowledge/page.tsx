"use client";
import { useState }  from "react";
import { api }       from "@/lib/api";
import { Network }   from "lucide-react";

export default function KnowledgePage() {
  const [filters, setFilters] = useState({
    status: "", region: "", tier: "",
    hasOpenAlerts: "", hasOverdueInvoices: "",
    minStudents: "", maxStudents: "", trialExpiringDays: "",
  });
  const [results,  setResults]  = useState<any[] | null>(null);
  const [count,    setCount]    = useState(0);
  const [loading,  setLoading]  = useState(false);

  const f = (k: string) => (e: any) => setFilters(p => ({ ...p, [k]: e.target.value }));

  const query = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
      const res = await api.get<any>(`/superadmin/knowledge?${params}`);
      setResults(res.results);
      setCount(res.count);
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">Knowledge Query Builder</h1>
        <p className="text-slate-400 text-sm mt-1">Cross-table filter: find exactly the tenants you need to act on</p>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 mb-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {[
            { key: "status",  label: "Status",   options: ["","ACTIVE","TRIAL","SUSPENDED","CANCELLED"] },
            { key: "region",  label: "Region",   options: ["","IN","US","EU","UK","GLOBAL"] },
            { key: "tier",    label: "Tier",     options: ["","STARTER","GROWTH","PRO","ENTERPRISE"] },
            { key: "hasOpenAlerts",      label: "Open alerts",   options: ["","true","false"] },
            { key: "hasOverdueInvoices", label: "Overdue invoice",options: ["","true","false"] },
          ].map(({ key, label, options }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>
              <select value={(filters as any)[key]} onChange={f(key)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-orange-500">
                {options.map(o => <option key={o} value={o}>{o || "Any"}</option>)}
              </select>
            </div>
          ))}
          {[
            { key: "minStudents",       label: "Min students",     placeholder: "0" },
            { key: "maxStudents",       label: "Max students",     placeholder: "1000" },
            { key: "trialExpiringDays", label: "Trial expires in", placeholder: "7" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>
              <input type="number" placeholder={placeholder} value={(filters as any)[key]} onChange={f(key)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-600" />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={query} disabled={loading}
            className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50">
            {loading ? "Querying..." : "Run query"}
          </button>
          <button onClick={() => { setFilters({ status:"",region:"",tier:"",hasOpenAlerts:"",hasOverdueInvoices:"",minStudents:"",maxStudents:"",trialExpiringDays:"" }); setResults(null); }}
            className="px-4 py-2 bg-slate-800 text-slate-400 text-sm rounded-lg hover:bg-slate-700 transition-colors">
            Clear
          </button>
          {results !== null && (
            <span className="text-sm text-slate-400 ml-2">{count} results</span>
          )}
        </div>
      </div>

      {results !== null && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-800">
              {["School","Status","Region","Tier","Students","Sub","Alert","Overdue","Trial"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-slate-800/50">
              {results.length === 0 ? (
                <tr><td colSpan={9} className="px-5 py-12 text-center text-slate-500">
                  <Network className="w-8 h-8 mx-auto mb-2 opacity-30"/>No matching tenants
                </td></tr>
              ) : results.map((r: any) => (
                <tr key={r.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-200">{r.name}</p>
                    <p className="text-xs font-mono text-slate-500">{r.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{r.status}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{r.region}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{r.tier}</td>
                  <td className="px-4 py-3 text-slate-400">{r.students}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{r.subStatus}</td>
                  <td className="px-4 py-3">
                    {r.hasOpenAlert ? <span className="text-xs text-red-400">⚠ Yes</span> : <span className="text-xs text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {r.hasOverdue ? <span className="text-xs text-amber-400">⚠ Yes</span> : <span className="text-xs text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {r.daysToTrial !== null ? `${r.daysToTrial}d` : "—"}
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
