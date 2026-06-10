"use client";
// frontend/src/app/dashboard/(finance)/billing/defaulters/page.tsx
// Defaulters list — overdue students, outstanding amounts, send reminder

import { useState }      from "react";
import { useRouter }     from "next/navigation";
import {
  AlertTriangle, Send, ExternalLink,
  Search, Filter, RefreshCw, Users,
  TrendingDown, Clock,
} from "lucide-react";
import { PageHeader }    from "@/components/ui/page-header";
import { StatCard }      from "@/components/ui/stat-card";
import { Badge }         from "@/components/ui/badge";
import { EmptyState }    from "@/components/ui/empty-state";
import { useApi }        from "@/lib/hooks";
import { apiClient }     from "@/lib/api";
import { useToast }      from "@/lib/use-toast";
import Link              from "next/link";

function fmt(n: number | string) {
  return `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default function DefaultersPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [search,         setSearch]         = useState("");
  const [minDaysOverdue, setMinDaysOverdue] = useState("");
  const [branchId,       setBranchId]       = useState("");
  const [sending,        setSending]        = useState<string | null>(null);
  const [selected,       setSelected]       = useState<Set<string>>(new Set());

  const qs = new URLSearchParams({
    ...(minDaysOverdue && { minDaysOverdue }),
    ...(branchId       && { branchId }),
  }).toString();

  const { data: defaulters, loading, refetch } =
    useApi<any[]>(`/billing/invoices/defaulters${qs ? `?${qs}` : ""}`, [qs]);

  const list: any[] = Array.isArray(defaulters) ? defaulters : [];

  const filtered = search.trim()
    ? list.filter(d =>
        `${d.student?.firstName} ${d.student?.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        d.student?.admissionNumber?.toLowerCase().includes(search.toLowerCase())
      )
    : list;

  const totalOutstanding = list.reduce((s, d) => s + Number(d.outstandingAmount), 0);

  const toggleSelect = (id: string) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleAll = () =>
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(d => d.student.id)));

  const sendReminder = async (studentId: string, studentName: string) => {
    setSending(studentId);
    try {
      // Gets student invoices to find the invoice IDs, then sends notification
      await apiClient.post("/notifications/send", {
        type:      "FEE_REMINDER",
        studentId,
        channel:   "EMAIL",
      });
      toast.success(`Reminder sent to ${studentName}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to send reminder");
    } finally { setSending(null); }
  };

  const bulkReminder = async () => {
    if (!selected.size) { toast.error("Select students first"); return; }
    setSending("bulk");
    let sent = 0;
    for (const studentId of selected) {
      try {
        await apiClient.post("/notifications/send", { type: "FEE_REMINDER", studentId, channel: "EMAIL" });
        sent++;
      } catch {}
    }
    toast.success(`Reminders sent to ${sent} students`);
    setSending(null);
    setSelected(new Set());
  };

  return (
    <div>
      <PageHeader
        title="Defaulters"
        subtitle="Students with overdue fee payments"
        action={
          selected.size > 0 ? (
            <button onClick={bulkReminder} disabled={sending === "bulk"}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50">
              {sending === "bulk"
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Send className="w-4 h-4" />}
              Send Reminder ({selected.size})
            </button>
          ) : (
            <button onClick={refetch}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm rounded-lg font-medium transition-colors">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          )
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Defaulters"  value={list.length}         color="red"   icon={<Users         className="w-5 h-5" />} loading={loading} />
        <StatCard label="Total Outstanding" value={fmt(totalOutstanding)} color="red"  icon={<TrendingDown  className="w-5 h-5" />} loading={loading} />
        <StatCard label="Critical (30d+)"   value={list.filter(d => d.maxDaysOverdue >= 30).length}
          color="red" icon={<AlertTriangle className="w-5 h-5" />} loading={loading} />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-5">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search student name or admission no..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <select value={minDaysOverdue} onChange={e => setMinDaysOverdue(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All overdue</option>
              <option value="7">7+ days</option>
              <option value="15">15+ days</option>
              <option value="30">30+ days</option>
              <option value="60">60+ days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No defaulters found"
          message={search ? "No students match your search." : "All students are up to date with their fees."}
          icon={<AlertTriangle className="w-10 h-10" />}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input type="checkbox"
                      checked={selected.size === filtered.length && filtered.length > 0}
                      onChange={toggleAll}
                      className="accent-blue-600 w-4 h-4" />
                  </th>
                  {["Student","Class","Outstanding","Invoices","Days Overdue","Last Payment",""].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((d: any) => {
                  const s = d.student;
                  const isSelected = selected.has(s.id);
                  return (
                    <tr key={s.id} className={`transition-colors ${isSelected ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                      <td className="px-4 py-3.5">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(s.id)}
                          className="accent-blue-600 w-4 h-4" />
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-slate-900">{s.firstName} {s.lastName}</p>
                        <p className="text-xs text-slate-400">{s.admissionNumber}</p>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500">{s.classId ?? "—"}</td>
                      <td className="px-4 py-3.5">
                        <span className="font-bold text-red-600">{fmt(d.outstandingAmount)}</span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500">{d.invoiceCount}</td>
                      <td className="px-4 py-3.5">
                        <span className={`font-medium ${d.maxDaysOverdue >= 30 ? "text-red-600" : d.maxDaysOverdue >= 15 ? "text-amber-600" : "text-slate-600"}`}>
                          {d.maxDaysOverdue}d
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-400">
                        {d.lastPaymentAt ? new Date(d.lastPaymentAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "Never"}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <Link href={`/dashboard/billing/students/${s.id}/ledger`}
                            className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors" title="View Ledger">
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                          <button onClick={() => sendReminder(s.id, `${s.firstName} ${s.lastName}`)}
                            disabled={sending === s.id}
                            className="p-1.5 text-slate-400 hover:text-amber-600 transition-colors disabled:opacity-50" title="Send Reminder">
                            {sending === s.id
                              ? <span className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin block" />
                              : <Send className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {filtered.map((d: any) => {
              const s = d.student;
              return (
                <div key={s.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-slate-900">{s.firstName} {s.lastName}</p>
                      <p className="text-xs text-slate-400">{s.admissionNumber}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-600 text-lg">{fmt(d.outstandingAmount)}</p>
                      <p className="text-xs text-slate-400">{d.maxDaysOverdue}d overdue</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Link href={`/dashboard/billing/students/${s.id}/ledger`}
                      className="flex-1 text-center py-1.5 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
                      View Ledger
                    </Link>
                    <button onClick={() => sendReminder(s.id, `${s.firstName} ${s.lastName}`)}
                      disabled={sending === s.id}
                      className="flex-1 py-1.5 text-xs text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors disabled:opacity-50">
                      {sending === s.id ? "Sending..." : "Send Reminder"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
