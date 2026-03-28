"use client";
import { useState, useCallback } from "react";
import { Search, RefreshCw, ChevronLeft, ChevronRight, Shield } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge }      from "@/components/ui/badge";
import { api }        from "@/lib/api";
import { formatDate, formatRelative } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface AuditEntry {
  id:         string;
  tenantId:   string;
  tenantName: string;
  tenantSlug: string;
  actorId:    string | null;
  actorEmail: string;
  actorName:  string;
  actorRole:  string;
  action:     string;
  entityType: string;
  entityId:   string;
  ipAddress:  string | null;
  metadata:   any;
  after:      any;
  createdAt:  string;
}

interface AuditResponse {
  logs:             AuditEntry[];
  meta:             { total: number; page: number; limit: number; lastPage: number };
  actionBreakdown:  { action: string; count: number }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const ACTION_COLORS: Record<string, string> = {
  LOGIN:         "bg-blue-500/10 text-blue-400",
  LOGOUT:        "bg-slate-700 text-slate-400",
  CREATE:        "bg-emerald-500/10 text-emerald-400",
  UPDATE:        "bg-amber-500/10 text-amber-400",
  DELETE:        "bg-red-500/10 text-red-400",
  PAYMENT:       "bg-purple-500/10 text-purple-400",
  IMPERSONATION: "bg-orange-500/10 text-orange-400",
};

function ActionBadge({ action }: { action: string }) {
  const cls = ACTION_COLORS[action] ?? "bg-slate-700 text-slate-400";
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {action}
    </span>
  );
}

// ── Action breakdown sidebar ──────────────────────────────────────────────────
function ActionBreakdown({ breakdown }: { breakdown: { action: string; count: number }[] }) {
  const max = Math.max(...breakdown.map((b) => b.count), 1);
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">Action breakdown</h2>
      <div className="space-y-3">
        {breakdown.length === 0 ? (
          <p className="text-slate-500 text-sm">No data</p>
        ) : breakdown.map(({ action, count }) => (
          <div key={action}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">{action}</span>
              <span className="text-slate-300 font-medium">{count}</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${ACTION_COLORS[action]?.includes("blue") ? "bg-blue-500" :
                  ACTION_COLORS[action]?.includes("emerald") ? "bg-emerald-500" :
                  ACTION_COLORS[action]?.includes("red") ? "bg-red-500" :
                  ACTION_COLORS[action]?.includes("amber") ? "bg-amber-500" :
                  ACTION_COLORS[action]?.includes("orange") ? "bg-orange-500" :
                  ACTION_COLORS[action]?.includes("purple") ? "bg-purple-500" : "bg-slate-500"}`}
                style={{ width: `${Math.round((count / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const ACTIONS = ["", "LOGIN", "LOGOUT", "CREATE", "UPDATE", "DELETE", "PAYMENT", "IMPERSONATION"];
const ENTITIES = ["", "User", "Student", "Invoice", "Payment", "Tenant", "IMPERSONATION", "Staff", "Section"];

export default function AuditLogPage() {
  const [filters, setFilters] = useState({
    tenantId: "", action: "", entityType: "", actorId: "", from: "", to: "",
  });
  const [page,     setPage]     = useState(1);
  const [data,     setData]     = useState<AuditResponse | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [queried,  setQueried]  = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const f = (k: string) => (e: any) => {
    setFilters((p) => ({ ...p, [k]: e.target.value }));
    setPage(1);
  };

  const load = useCallback(async (p = page) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "50" });
      if (filters.tenantId)   params.set("tenantId",   filters.tenantId);
      if (filters.action)     params.set("action",     filters.action);
      if (filters.entityType) params.set("entityType", filters.entityType);
      if (filters.actorId)    params.set("actorId",    filters.actorId);
      if (filters.from)       params.set("from",       filters.from);
      if (filters.to)         params.set("to",         filters.to);
      const result = await api.get<AuditResponse>(`/superadmin/audit?${params}`);
      setData(result);
      setQueried(true);
    } catch (e: any) {
      setError(e.message ?? "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  const handleSearch = () => { setPage(1); load(1); };
  const handlePage   = (p: number) => { setPage(p); load(p); };

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle="Platform-wide activity trail across all tenants"
      />

      {/* Filters */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Tenant ID or slug
            </label>
            <input
              type="text"
              value={filters.tenantId}
              onChange={f("tenantId")}
              placeholder="schoolos-platform"
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:outline-none focus:border-orange-500 placeholder-slate-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Action</label>
            <select value={filters.action} onChange={f("action")}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:outline-none focus:border-orange-500">
              {ACTIONS.map((a) => <option key={a} value={a}>{a || "All actions"}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Entity type</label>
            <select value={filters.entityType} onChange={f("entityType")}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:outline-none focus:border-orange-500">
              {ENTITIES.map((e) => <option key={e} value={e}>{e || "All entities"}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">From date</label>
            <input type="date" value={filters.from} onChange={f("from")}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:outline-none focus:border-orange-500" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">To date</label>
            <input type="date" value={filters.to} onChange={f("to")}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:outline-none focus:border-orange-500" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleSearch} disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors">
            <Search className="w-4 h-4" />
            {loading ? "Searching..." : "Search"}
          </button>
          {queried && (
            <button onClick={() => load(page)} disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          )}
          {queried && data && (
            <span className="text-xs text-slate-500">
              {data.meta.total.toLocaleString()} entries found
            </span>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Content */}
      {!queried ? (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-16 text-center">
          <Shield className="w-10 h-10 text-slate-700 mx-auto mb-4" />
          <p className="text-slate-400 font-medium">Set filters and click Search</p>
          <p className="text-slate-600 text-sm mt-1">
            Leave all filters blank to see the latest 50 platform-wide events.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Log table */}
          <div className="lg:col-span-3">
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    {["Time", "Action", "Actor", "School", "Entity", ""].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {loading ? (
                    [...Array(10)].map((_, i) => (
                      <tr key={i}>
                        {[...Array(6)].map((_, j) => (
                          <td key={j} className="px-4 py-3.5">
                            <div className="h-4 bg-slate-800 rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : data?.logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-16 text-center text-slate-500">
                        No audit entries match your filters
                      </td>
                    </tr>
                  ) : data?.logs.map((log) => (
                    <>
                      <tr
                        key={log.id}
                        onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                        className="hover:bg-slate-800/30 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3.5">
                          <p className="text-xs text-slate-400 whitespace-nowrap">{formatRelative(log.createdAt)}</p>
                          <p className="text-xs text-slate-600">{formatDate(log.createdAt)}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <ActionBadge action={log.action} />
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-xs text-slate-300 font-medium truncate max-w-[140px]">{log.actorName}</p>
                          <p className="text-xs text-slate-500 truncate max-w-[140px]">{log.actorEmail}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-xs text-slate-300">{log.tenantName}</p>
                          <p className="text-xs text-slate-600 font-mono">{log.tenantSlug}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-xs text-slate-400">{log.entityType}</p>
                          <p className="text-xs text-slate-600 font-mono truncate max-w-[100px]">{log.entityId}</p>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 text-xs">
                          {log.ipAddress ?? "—"}
                        </td>
                      </tr>

                      {/* Expanded metadata row */}
                      {expanded === log.id && (
                        <tr key={`${log.id}-expanded`} className="bg-slate-900/80">
                          <td colSpan={6} className="px-4 pb-4 pt-0">
                            <div className="bg-slate-800/50 rounded-lg p-4 text-xs font-mono text-slate-400 max-h-48 overflow-y-auto">
                              {log.after && (
                                <div className="mb-2">
                                  <span className="text-slate-500 font-sans font-semibold">After: </span>
                                  <span className="text-emerald-400">{JSON.stringify(log.after, null, 2)}</span>
                                </div>
                              )}
                              {log.metadata && (
                                <div>
                                  <span className="text-slate-500 font-sans font-semibold">Metadata: </span>
                                  <span className="text-blue-400">{JSON.stringify(log.metadata, null, 2)}</span>
                                </div>
                              )}
                              {!log.after && !log.metadata && (
                                <span className="text-slate-600">No additional data</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data && data.meta.lastPage > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-slate-500">
                  Page {data.meta.page} of {data.meta.lastPage} · {data.meta.total.toLocaleString()} total entries
                </p>
                <div className="flex gap-2">
                  <button onClick={() => handlePage(page - 1)} disabled={page === 1 || loading}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg disabled:opacity-40 transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => handlePage(page + 1)} disabled={page === data.meta.lastPage || loading}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg disabled:opacity-40 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Breakdown sidebar */}
          <div>
            <ActionBreakdown breakdown={data?.actionBreakdown ?? []} />
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 mt-4">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Legend</h2>
              <div className="space-y-2">
                {Object.entries(ACTION_COLORS).map(([action, cls]) => (
                  <div key={action} className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{action}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
