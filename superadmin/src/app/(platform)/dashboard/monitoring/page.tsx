"use client";
import { useState } from "react";
import { useApi }   from "@/lib/hooks";
import { api }      from "@/lib/api";

export default function MonitoringPage() {
  const { data, loading, refetch } = useApi<any>("/superadmin/monitoring");
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const services = data?.services ?? {};
  const activity = data?.activity ?? {};
  const counts   = data?.tenantCounts ?? {};

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">System Monitoring</h1>
          <p className="text-slate-400 text-sm mt-1">Live service status, activity and tenant distribution</p>
        </div>
        <button onClick={refresh} disabled={refreshing}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors disabled:opacity-50">
          {refreshing ? "Refreshing..." : "↻ Refresh"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Service status */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Services</h2>
          {loading ? [...Array(3)].map((_,i) => (
            <div key={i} className="h-10 bg-slate-800 rounded animate-pulse mb-2" />
          )) : Object.entries(services).map(([name, status]) => (
            <div key={name} className="flex items-center justify-between py-2.5 border-b border-slate-800 last:border-0">
              <span className="text-sm text-slate-300 capitalize">{name}</span>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  status === "up" ? "bg-emerald-500" : status === "down" ? "bg-red-500" : "bg-amber-400"
                }`} />
                <span className={`text-xs font-medium ${
                  status === "up" ? "text-emerald-400" : status === "down" ? "text-red-400" : "text-amber-400"
                }`}>{String(status)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Activity */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Activity</h2>
          {[
            { label: "New signups (24h)",     value: activity.recentSignups ?? 0             },
            { label: "Audit events (1h)",     value: activity.recentActivityLastHour ?? 0   },
          ].map(({ label, value }) => (
            <div key={label} className="py-2.5 border-b border-slate-800 last:border-0">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
            </div>
          ))}
          <p className="text-xs text-slate-600 mt-3">
            Last updated: {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString("en-IN") : "—"}
          </p>
        </div>

        {/* Tenant distribution */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Tenant distribution</h2>
          {["ACTIVE","TRIAL","SUSPENDED","CANCELLED"].map(status => (
            <div key={status} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
              <span className={`text-xs font-medium ${
                status === "ACTIVE"    ? "text-emerald-400" :
                status === "TRIAL"     ? "text-blue-400"    :
                status === "SUSPENDED" ? "text-amber-400"   : "text-red-400"
              }`}>{status}</span>
              <span className="text-slate-200 font-bold">{counts[status] ?? 0}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
