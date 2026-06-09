"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Users, AlertCircle, CalendarClock, FileCheck, ClipboardList,
  CheckCircle2, XCircle, GraduationCap, TrendingUp, PlusCircle, ChevronRight,
  Phone, Search,
} from "lucide-react";
import { useCrmDashboard, useLeads } from "@/lib/hooks";
import type { LeadStatus, ListLeadsQuery } from "@/lib/api";
import { LeadStatusBadge, LEAD_STATUS_LABELS } from "@/components/crm/LeadStatusBadge";
import { LeadForm } from "@/components/crm/LeadForm";
import { useRouter } from "next/navigation";

export default function CrmDashboardPage() {
  const router = useRouter();
  const { data: dash, loading: dashLoading, refetch: refetchDash } = useCrmDashboard();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "">("");
  const [mineOnly, setMineOnly] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const query: ListLeadsQuery = useMemo(() => ({
    ...(search ? { search } : {}),
    ...(statusFilter ? { status: statusFilter as LeadStatus } : {}),
    ...(mineOnly ? { mineOnly: "true" as const } : {}),
    pageSize: 50,
  }), [search, statusFilter, mineOnly]);

  const { data: leads, loading: leadsLoading, refetch: refetchLeads } = useLeads(query);

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">CRM</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Admissions operations console</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90"
        >
          <PlusCircle className="w-4 h-4" /> New Lead
        </button>
      </header>

      {/* Metric cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <MetricCard icon={<Users className="w-4 h-4" />} label="New Leads" value={dash?.counts.newLeads} loading={dashLoading} tone="sky" />
        <MetricCard icon={<ClipboardList className="w-4 h-4" />} label="Open Leads" value={dash?.counts.openLeads} loading={dashLoading} tone="blue" />
        <MetricCard icon={<CalendarClock className="w-4 h-4" />} label="Today's Follow-ups" value={dash?.counts.todaysFollowUps} loading={dashLoading} tone="amber" />
        <MetricCard icon={<AlertCircle className="w-4 h-4" />} label="Overdue Follow-ups" value={dash?.counts.overdueFollowUps} loading={dashLoading} tone="red" />
        <MetricCard icon={<FileCheck className="w-4 h-4" />} label="Applications Submitted" value={dash?.counts.applicationsSubmitted} loading={dashLoading} tone="violet" />
        <MetricCard icon={<ClipboardList className="w-4 h-4" />} label="Pending Approval" value={dash?.counts.applicationsPendingApproval} loading={dashLoading} tone="purple" />
        <MetricCard icon={<CheckCircle2 className="w-4 h-4" />} label="Approved" value={dash?.counts.admissionsApproved} loading={dashLoading} tone="emerald" />
        <MetricCard icon={<XCircle className="w-4 h-4" />} label="Rejected" value={dash?.counts.admissionsRejected} loading={dashLoading} tone="zinc" />
        <MetricCard icon={<GraduationCap className="w-4 h-4" />} label="Enrollments Completed" value={dash?.counts.enrollmentsCompleted} loading={dashLoading} tone="green" />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline */}
        <section className="lg:col-span-2 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Lead pipeline</h2>
            <Link href="/dashboard/crm?view=pipeline" className="text-xs text-zinc-500 hover:underline">View all</Link>
          </div>
          <PipelineView data={dash?.pipeline ?? []} loading={dashLoading} />
        </section>

        {/* Conversion */}
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <h2 className="font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Conversion (30d)</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <ConversionRow label="Leads created" value={dash?.conversion.leadsCreated} />
            <ConversionRow label="Applications created" value={dash?.conversion.applicationsCreated} />
            <ConversionRow label="Enrolled" value={dash?.conversion.enrolled} />
            <hr className="border-zinc-200 dark:border-zinc-800" />
            <ConversionRow label="Lead → Application" value={`${dash?.conversion.leadToApplicationPct ?? 0}%`} />
            <ConversionRow label="Application → Enrolled" value={`${dash?.conversion.applicationToEnrolledPct ?? 0}%`} />
            <ConversionRow label="Lead → Enrolled" value={`${dash?.conversion.leadToEnrolledPct ?? 0}%`} bold />
          </dl>
        </section>
      </div>

      {/* Work queue + Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <h2 className="font-semibold mb-3">Today's work queue</h2>
          <WorkQueueLists
            today={dash?.workQueue.todaysFollowUps ?? []}
            overdue={dash?.workQueue.overdueFollowUps ?? []}
            loading={dashLoading}
          />
        </section>
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <h2 className="font-semibold mb-3">Lead source breakdown</h2>
          <SourceBreakdown rows={dash?.sources ?? []} loading={dashLoading} />
        </section>
      </div>

      {/* Leads list / filter */}
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <h2 className="font-semibold">Leads</h2>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-2.5 text-zinc-400" />
              <input
                placeholder="Search name, phone, email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm w-full sm:w-64"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as LeadStatus | "")}
              className="px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
            >
              <option value="">All statuses</option>
              {Object.entries(LEAD_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} className="rounded" />
              Assigned to me
            </label>
          </div>
        </div>
        <LeadsTable
          leads={leads?.items ?? []}
          loading={leadsLoading}
          onClick={(id) => router.push(`/dashboard/crm/${id}`)}
        />
      </section>

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setShowCreate(false)}>
          <div
            className="w-full md:max-w-2xl bg-white dark:bg-zinc-950 md:rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-6 max-h-[95vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Create lead</h3>
              <button onClick={() => setShowCreate(false)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">✕</button>
            </div>
            <LeadForm
              onComplete={(id) => { setShowCreate(false); refetchLeads(); refetchDash(); router.push(`/dashboard/crm/${id}`); }}
              onCancel={() => setShowCreate(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------- subcomponents ----------------------

const TONE_BG: Record<string, string> = {
  sky: "bg-sky-50 dark:bg-sky-950/40",
  blue: "bg-blue-50 dark:bg-blue-950/40",
  amber: "bg-amber-50 dark:bg-amber-950/40",
  red: "bg-red-50 dark:bg-red-950/40",
  violet: "bg-violet-50 dark:bg-violet-950/40",
  purple: "bg-purple-50 dark:bg-purple-950/40",
  emerald: "bg-emerald-50 dark:bg-emerald-950/40",
  zinc: "bg-zinc-100 dark:bg-zinc-900/60",
  green: "bg-green-50 dark:bg-green-950/40",
};
const TONE_TEXT: Record<string, string> = {
  sky: "text-sky-700 dark:text-sky-200",
  blue: "text-blue-700 dark:text-blue-200",
  amber: "text-amber-700 dark:text-amber-200",
  red: "text-red-700 dark:text-red-200",
  violet: "text-violet-700 dark:text-violet-200",
  purple: "text-purple-700 dark:text-purple-200",
  emerald: "text-emerald-700 dark:text-emerald-200",
  zinc: "text-zinc-700 dark:text-zinc-200",
  green: "text-green-700 dark:text-green-200",
};

function MetricCard({ icon, label, value, loading, tone }: { icon: React.ReactNode; label: string; value?: number; loading: boolean; tone: string }) {
  return (
    <div className={`rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 ${TONE_BG[tone]}`}>
      <div className={`flex items-center gap-2 text-xs uppercase tracking-wide ${TONE_TEXT[tone]}`}>{icon}<span className="truncate">{label}</span></div>
      <div className="mt-2 text-2xl font-semibold">
        {loading ? <div className="h-7 w-12 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" /> : (value ?? 0)}
      </div>
    </div>
  );
}

function PipelineView({ data, loading }: { data: Array<{ status: string; count: number }>; loading: boolean }) {
  if (loading) return <div className="h-32 rounded bg-zinc-100 dark:bg-zinc-900 animate-pulse" />;
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.status} className="flex items-center gap-3">
          <LeadStatusBadge status={d.status as LeadStatus} className="min-w-[130px] justify-center" />
          <div className="flex-1 h-4 rounded bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <div className="h-full bg-zinc-400 dark:bg-zinc-500" style={{ width: `${(d.count / max) * 100}%` }} />
          </div>
          <div className="w-10 text-right text-sm tabular-nums">{d.count}</div>
        </div>
      ))}
    </div>
  );
}

function ConversionRow({ label, value, bold }: { label: string; value?: number | string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className={bold ? "font-semibold" : ""}>{value ?? "—"}</dd>
    </div>
  );
}

function WorkQueueLists({
  today, overdue, loading,
}: { today: any[]; overdue: any[]; loading: boolean }) {
  if (loading) return <div className="h-32 rounded bg-zinc-100 dark:bg-zinc-900 animate-pulse" />;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <h3 className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">Today</h3>
        {today.length === 0 ? (
          <p className="text-sm text-zinc-400">Nothing scheduled.</p>
        ) : (
          <ul className="space-y-2">
            {today.map((t) => (
              <li key={t.id}>
                <Link href={`/dashboard/crm/${t.leadId}`} className="flex items-center gap-2 text-sm hover:underline">
                  <Phone className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="font-medium">{t.leadName}</span>
                  <span className="text-zinc-400">— {t.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">Overdue</h3>
        {overdue.length === 0 ? (
          <p className="text-sm text-zinc-400">No overdue tasks. 🎉</p>
        ) : (
          <ul className="space-y-2">
            {overdue.map((t) => (
              <li key={t.id}>
                <Link href={`/dashboard/crm/${t.leadId}`} className="flex items-center gap-2 text-sm hover:underline">
                  <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                  <span className="font-medium">{t.leadName}</span>
                  <span className="text-zinc-400">— {t.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SourceBreakdown({ rows, loading }: { rows: any[]; loading: boolean }) {
  if (loading) return <div className="h-32 rounded bg-zinc-100 dark:bg-zinc-900 animate-pulse" />;
  if (!rows.length) return <p className="text-sm text-zinc-400">No source data yet.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {rows.slice(0, 8).map((r) => (
        <li key={r.sourceId ?? "unknown"} className="flex items-center justify-between gap-2">
          <span className="truncate">{r.sourceName}</span>
          <span className="text-zinc-500 dark:text-zinc-400 tabular-nums">{r.leads} → {r.enrolled} ({r.conversionPct}%)</span>
        </li>
      ))}
    </ul>
  );
}

function LeadsTable({ leads, loading, onClick }: { leads: any[]; loading: boolean; onClick: (id: string) => void }) {
  if (loading) return <div className="h-32 rounded bg-zinc-100 dark:bg-zinc-900 animate-pulse" />;
  if (!leads.length) return <p className="text-sm text-zinc-400 py-6 text-center">No leads match your filters.</p>;
  return (
    <>
      {/* Mobile: cards */}
      <ul className="md:hidden divide-y divide-zinc-200 dark:divide-zinc-800">
        {leads.map((l) => (
          <li key={l.id} onClick={() => onClick(l.id)} className="py-3 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <div className="font-medium truncate">{l.parentName}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                  {l.parentPhone} • {l.gradeInterestedIn}
                </div>
              </div>
              <LeadStatusBadge status={l.status} />
            </div>
          </li>
        ))}
      </ul>
      {/* Desktop: table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
            <tr>
              <th className="text-left py-2 px-3">Parent</th>
              <th className="text-left py-2 px-3">Phone</th>
              <th className="text-left py-2 px-3">Grade</th>
              <th className="text-left py-2 px-3">Status</th>
              <th className="text-left py-2 px-3">Assigned</th>
              <th className="text-left py-2 px-3">Activity</th>
              <th className="py-2 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-b border-zinc-100 dark:border-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer" onClick={() => onClick(l.id)}>
                <td className="py-2 px-3">
                  <div className="font-medium">{l.parentName}</div>
                  {l.studentName && <div className="text-xs text-zinc-500 dark:text-zinc-400">{l.studentName}</div>}
                </td>
                <td className="py-2 px-3">{l.parentPhone}</td>
                <td className="py-2 px-3">{l.gradeInterestedIn}</td>
                <td className="py-2 px-3"><LeadStatusBadge status={l.status} /></td>
                <td className="py-2 px-3 text-zinc-500">{l.assignedTo ? (l.assignedTo.firstName ?? l.assignedTo.email) : "—"}</td>
                <td className="py-2 px-3 text-zinc-500 text-xs">{(l._count?.tasks ?? 0)} tasks · {(l._count?.interactions ?? 0)} logs</td>
                <td className="py-2 px-3 text-right"><ChevronRight className="w-4 h-4 text-zinc-400 inline" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
