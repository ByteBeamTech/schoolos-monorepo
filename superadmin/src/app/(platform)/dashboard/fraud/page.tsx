"use client";
import { ShieldAlert }     from "lucide-react";
import { PageHeader }      from "@/components/ui/page-header";
import { StatCard }        from "@/components/ui/stat-card";
import { Badge }           from "@/components/ui/badge";
import { useApi, FraudAlert } from "@/lib/hooks";
import { formatRelative }  from "@/lib/utils";
import { api }             from "@/lib/api";
import { useState }        from "react";

function severityVariant(s: string) {
  if (s === "CRITICAL") return "error" as const;
  if (s === "HIGH")     return "error" as const;
  if (s === "MEDIUM")   return "warning" as const;
  return "neutral" as const;
}

function statusVariant(s: string) {
  if (s === "OPEN")          return "error" as const;
  if (s === "INVESTIGATING")  return "warning" as const;
  if (s === "RESOLVED")       return "success" as const;
  return "neutral" as const;
}

export default function FraudPage() {
  const [statusFilter, setStatusFilter] = useState("OPEN");
  const { data: alerts, loading, refetch } = useApi<FraudAlert[]>(
    `/fraud/alerts?status=${statusFilter}&limit=100`,
    [statusFilter]
  );
  const list = Array.isArray(alerts) ? alerts : [];

  const [resolving, setResolving] = useState("");

  const resolve = async (id: string) => {
    setResolving(id);
    try {
      await api.patch(`/fraud/alerts/${id}`, { status: "RESOLVED" });
      refetch();
    } catch (e: any) { alert(e.message); }
    finally           { setResolving(""); }
  };

  const critical  = list.filter(a => a.severity === "CRITICAL").length;
  const high      = list.filter(a => a.severity === "HIGH").length;
  const open      = list.filter(a => a.status   === "OPEN").length;

  return (
    <div>
      <PageHeader title="Fraud Alerts" subtitle="Cross-tenant security signals" />

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Critical" value={critical} loading={loading} />
        <StatCard label="High"     value={high}     loading={loading} />
        <StatCard label="Open"     value={open}     loading={loading} />
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-5">
        {["OPEN", "INVESTIGATING", "RESOLVED", "FALSE_POSITIVE"].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 text-xs rounded-lg border font-medium transition-colors ${
              statusFilter === s
                ? "bg-orange-500/10 border-orange-500 text-orange-400"
                : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600"
            }`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              {["Rule", "Description", "School", "Severity", "Status", "Time", ""].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {loading ? [...Array(5)].map((_, i) => (
              <tr key={i}>
                {[...Array(7)].map((_, j) => (
                  <td key={j} className="px-5 py-4"><div className="h-4 bg-slate-800 rounded animate-pulse" /></td>
                ))}
              </tr>
            )) : list.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-16 text-center">
                <p className="text-emerald-500 font-medium">✓ No {statusFilter.toLowerCase()} alerts</p>
              </td></tr>
            ) : list.map(a => (
              <tr key={a.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-5 py-3.5 font-medium text-slate-200 text-xs">{a.ruleName}</td>
                <td className="px-5 py-3.5 text-slate-400 text-xs max-w-xs truncate">{a.description}</td>
                <td className="px-5 py-3.5 text-slate-300 text-xs">{a.tenant?.name ?? "—"}</td>
                <td className="px-5 py-3.5"><Badge label={a.severity} variant={severityVariant(a.severity)} /></td>
                <td className="px-5 py-3.5"><Badge label={a.status}   variant={statusVariant(a.status)}   /></td>
                <td className="px-5 py-3.5 text-slate-500 text-xs">{formatRelative(a.createdAt)}</td>
                <td className="px-5 py-3.5">
                  {a.status === "OPEN" && (
                    <button
                      onClick={() => resolve(a.id)}
                      disabled={resolving === a.id}
                      className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50 transition-colors"
                    >
                      {resolving === a.id ? "…" : "Resolve"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
