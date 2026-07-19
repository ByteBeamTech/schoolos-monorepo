"use client";
import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { useApi } from "@/lib/hooks";
import { formatDate } from "@/lib/utils";
import { History, Search, LogIn, LogOut, KeyRound } from "lucide-react";

// Reads the EXISTING AuditLog trail (auth.service.ts already writes
// LOGIN/LOGOUT/PASSWORD_CHANGE/PASSWORD_RESET_REQUEST entries) -- no new
// tracking added, just a filtered, platform-staff-scoped view of data
// that already existed. NOTE: no failed-login tracking exists in this
// codebase today (no LOGIN_FAILED audit action, no lockout logic), so
// that row type genuinely won't appear here -- not a missing feature in
// this page, a missing capability further down the stack.

const ACTION_META: Record<string, { label: string; icon: any; color: string }> = {
  LOGIN:  { label: "Login",  icon: LogIn,  color: "text-emerald-400" },
  LOGOUT: { label: "Logout", icon: LogOut, color: "text-slate-400" },
  PASSWORD_CHANGE:        { label: "Password Changed", icon: KeyRound, color: "text-amber-400" },
  PASSWORD_RESET_REQUEST: { label: "Password Reset",    icon: KeyRound, color: "text-amber-400" },
};
const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin", SAAS_OWNER: "SaaS Owner", ACCOUNT_MANAGER: "Account Manager",
};

interface LogEntry {
  id: string; action: string; createdAt: string; ipAddress: string | null;
  actor: { email: string; firstName: string; lastName: string; role: string } | null;
}

export default function AdminLoginHistoryPage() {
  const [search, setSearch] = useState("");
  const { data: logs, loading } = useApi<LogEntry[]>(
    `/superadmin/platform-users/login-history/all?search=${encodeURIComponent(search)}`, [search]
  );
  const list = Array.isArray(logs) ? logs : [];

  return (
    <div>
      <PageHeader title="Login History" subtitle="Login, logout, and password-change events for platform staff" />

      <div className="relative max-w-sm mt-6 mb-5">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..."
          className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 text-slate-200 text-sm rounded-lg focus:outline-none focus:border-orange-500" />
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-slate-800 rounded animate-pulse" />)}</div>
        ) : list.length === 0 ? (
          <div className="p-16 text-center">
            <History className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No login history found.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Event</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">User</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">IP</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {list.map(log => {
                const meta = ACTION_META[log.action] ?? { label: log.action, icon: History, color: "text-slate-400" };
                const Icon = meta.icon;
                return (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3">
                      <span className={`flex items-center gap-2 text-xs font-medium ${meta.color}`}>
                        <Icon className="w-3.5 h-3.5" /> {meta.label}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {log.actor ? (
                        <>
                          <p className="text-slate-200">{log.actor.firstName} {log.actor.lastName}</p>
                          <p className="text-slate-500 text-xs">{log.actor.email} · {ROLE_LABEL[log.actor.role] ?? log.actor.role}</p>
                        </>
                      ) : <span className="text-slate-500 text-xs">Unknown actor</span>}
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs font-mono">{log.ipAddress ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-400 text-xs">{formatDate(log.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
