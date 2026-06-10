"use client";
// frontend/src/app/dashboard/(finance)/billing/analytics/page.tsx
// Billing analytics — collection KPIs + monthly chart + fee head breakdown

import { useState }        from "react";
import {
  TrendingUp, TrendingDown, DollarSign,
  Users, BarChart3, RefreshCw, Percent,
} from "lucide-react";
import { PageHeader }       from "@/components/ui/page-header";
import { StatCard }         from "@/components/ui/stat-card";
import { useApi, useAcademicSessions } from "@/lib/hooks";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number | string) {
  const v = Number(n ?? 0);
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)}Cr`;
  if (v >= 100000)   return `₹${(v / 100000).toFixed(2)}L`;
  if (v >= 1000)     return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

// ── Bar chart (no external deps) ─────────────────────────────────────────────
function BarChart({ data, maxH = 100 }: { data: { label: string; value: number; color?: string }[]; maxH?: number }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end justify-between gap-1.5 h-32">
      {data.map(d => {
        const h = Math.max(4, (d.value / max) * 120);
        return (
          <div key={d.label} className="flex flex-col items-center flex-1 min-w-0 gap-1">
            <span className="text-xs font-medium text-slate-600 text-center">
              {d.value > 0 ? fmt(d.value) : ""}
            </span>
            <div
              className={`w-full rounded-t-md transition-all ${d.color ?? "bg-blue-500"}`}
              style={{ height: h }}
            />
            <span className="text-xs text-slate-400 text-center truncate w-full">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ value, max, color = "bg-blue-500", label }: {
  value: number; max: number; color?: string; label?: string
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      {label && (
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>{label}</span>
          <span>{fmt(value)}</span>
        </div>
      )}
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function BillingAnalyticsPage() {
  const { data: sessions }  = useAcademicSessions();
  const currentSession      = sessions?.find((s: any) => s.isCurrent) ?? sessions?.[0];
  const [academicYear, setAcademicYear] = useState<string>("");
  const activeYear = academicYear || currentSession?.name || "";

  const { data: analytics, loading, refetch } = useApi<any>(
    `/billing/analytics${activeYear ? `?academicYear=${encodeURIComponent(activeYear)}` : ""}`,
    [activeYear]
  );

  const kpis         = analytics?.kpis         ?? {};
  const monthly      = analytics?.monthly      ?? [];
  const feeHeadBreak = analytics?.feeHeadBreakdown ?? [];
  const defaulters   = analytics?.defaulters   ?? {};

  // Build monthly bar data
  const monthlyData = monthly.map((m: any) => ({
    label: m.month ?? m.label ?? "",
    value: Number(m.collected ?? m.amount ?? 0),
    color: "bg-blue-500",
  }));
  const outstandingData = monthly.map((m: any) => ({
    label: m.month ?? m.label ?? "",
    value: Number(m.outstanding ?? 0),
    color: "bg-red-400",
  }));

  const collectionRate = kpis.collectionRate ?? 0;
  const totalInvoiced  = Number(kpis.totalInvoiced  ?? 0);
  const totalCollected = Number(kpis.totalCollected ?? 0);
  const outstanding    = Number(kpis.outstanding    ?? 0);

  return (
    <div>
      <PageHeader
        title="Billing Analytics"
        subtitle="Financial performance and collection overview"
        action={
          <div className="flex items-center gap-2">
            <select value={academicYear} onChange={e => setAcademicYear(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Current year</option>
              {(sessions ?? []).map((s: any) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
            <button onClick={refetch}
              className="p-2 text-slate-400 hover:text-slate-700 transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard label="Total Invoiced"   value={fmt(totalInvoiced)}  color="blue"   icon={<DollarSign   className="w-5 h-5" />} loading={loading} />
        <StatCard label="Collected"        value={fmt(totalCollected)} color="green"  icon={<TrendingUp    className="w-5 h-5" />} loading={loading} />
        <StatCard label="Outstanding"      value={fmt(outstanding)}    color={outstanding > 0 ? "red" : "green"} icon={<TrendingDown className="w-5 h-5" />} loading={loading} />
        <StatCard
          label="Collection Rate"
          value={`${collectionRate}%`}
          color={collectionRate >= 80 ? "green" : collectionRate >= 60 ? "amber" : "red"}
          icon={<Percent className="w-5 h-5" />}
          loading={loading}
          sub={collectionRate >= 80 ? "Excellent" : collectionRate >= 60 ? "Needs attention" : "Critical"}
        />
        <StatCard label="Defaulters"       value={defaulters.count ?? 0} color="red"  icon={<Users         className="w-5 h-5" />} loading={loading}
          sub={defaulters.totalAmount ? fmt(defaulters.totalAmount) : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Monthly collection chart */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-slate-700">Monthly Collection</h2>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500 rounded-sm inline-block" /> Collected</span>
              </div>
            </div>
            {loading ? (
              <div className="h-32 bg-slate-100 rounded-lg animate-pulse" />
            ) : monthlyData.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-slate-400 text-sm">
                <BarChart3 className="w-8 h-8 mr-2 opacity-30" /> No data yet
              </div>
            ) : (
              <BarChart data={monthlyData} />
            )}
          </div>

          {/* Outstanding trend */}
          {outstandingData.some(d => d.value > 0) && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-5">Outstanding Trend</h2>
              <BarChart data={outstandingData} />
            </div>
          )}

          {/* Collection rate gauge */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Collection Summary</h2>
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <div key={i} className="h-6 bg-slate-100 rounded animate-pulse" />)}
              </div>
            ) : (
              <div className="space-y-4">
                <ProgressBar value={totalCollected} max={totalInvoiced} color="bg-emerald-500" label="Collected" />
                <ProgressBar value={outstanding}    max={totalInvoiced} color="bg-red-400"     label="Outstanding" />
                <div className="flex justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                  <span>Total invoiced</span>
                  <span className="font-semibold text-slate-700">{fmt(totalInvoiced)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar — fee head breakdown */}
        <div className="space-y-5">
          {feeHeadBreak.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Collection by Fee Head</h2>
              <div className="space-y-3">
                {feeHeadBreak.slice(0, 8).map((fh: any) => (
                  <div key={fh.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 truncate max-w-[140px]">{fh.name}</span>
                      <span className="text-slate-700 font-medium flex-shrink-0">{fmt(fh.collected)}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${Math.min(100, (Number(fh.collected) / (totalCollected || 1)) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Defaulter breakdown */}
          {defaulters.count > 0 && (
            <div className="bg-red-50 rounded-2xl border border-red-100 p-5">
              <h2 className="text-sm font-semibold text-red-700 mb-3">Defaulter Summary</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-red-600">Total defaulters</span>
                  <span className="font-bold text-red-700">{defaulters.count}</span>
                </div>
                {defaulters.totalAmount && (
                  <div className="flex justify-between">
                    <span className="text-red-600">Total dues</span>
                    <span className="font-bold text-red-700">{fmt(defaulters.totalAmount)}</span>
                  </div>
                )}
                {(defaulters.criticalCount ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-red-600">30+ days overdue</span>
                    <span className="font-bold text-red-800">{defaulters.criticalCount}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Quick Actions</h2>
            <div className="space-y-2">
              {[
                { label: "View Defaulters",     href: "/dashboard/billing/defaulters" },
                { label: "Late Fee Management", href: "/dashboard/billing/late-fees"  },
                { label: "All Invoices",         href: "/dashboard/billing"             },
              ].map(({ label, href }) => (
                <a key={href} href={href}
                  className="flex items-center justify-between text-sm text-blue-600 hover:text-blue-800 py-1.5 border-b border-slate-50 last:border-0 transition-colors">
                  {label}
                  <span className="text-slate-300">→</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
