"use client";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { useApi } from "@/lib/hooks";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { formatRelative } from "@/lib/utils";
import { Laptop, Smartphone, Monitor as MonitorIcon, X } from "lucide-react";

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin", SAAS_OWNER: "SaaS Owner", ACCOUNT_MANAGER: "Account Manager",
};

interface SessionRow {
  id: string; userAgent: string | null; ipAddress: string | null;
  createdAt: string; expiresAt: string;
  user: { id: string; email: string; firstName: string; lastName: string; role: string };
}

function deviceIcon(ua: string | null) {
  if (!ua) return MonitorIcon;
  if (/mobile|android|iphone/i.test(ua)) return Smartphone;
  return Laptop;
}

function browserSummary(ua: string | null): string {
  if (!ua) return "Unknown device";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  if (ua.includes("Edge")) return "Edge";
  return "Unknown browser";
}

export default function AdminSessionsPage() {
  const { toast } = useToast();
  const { data: sessions, loading, refetch } = useApi<SessionRow[]>("/superadmin/platform-users/sessions/all");
  const list = Array.isArray(sessions) ? sessions : [];

  const revoke = async (s: SessionRow) => {
    if (!confirm(`Revoke this session for ${s.user.firstName} ${s.user.lastName}?`)) return;
    try {
      await api.patch(`/superadmin/platform-users/sessions/${s.id}/revoke`, {});
      toast({ description: "Session revoked." });
      refetch();
    } catch (e: any) {
      toast({ description: e.message || "Failed to revoke session.", variant: "destructive" });
    }
  };

  return (
    <div>
      <PageHeader title="Active Sessions" subtitle="Every active login session for platform staff" />

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden mt-6">
        {loading ? (
          <div className="p-4 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate-800 rounded animate-pulse" />)}</div>
        ) : list.length === 0 ? (
          <div className="p-16 text-center">
            <Laptop className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No active sessions.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">User</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Device</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">IP Address</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Started</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Expires</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {list.map(s => {
                const Icon = deviceIcon(s.userAgent);
                return (
                  <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-slate-200 font-medium">{s.user.firstName} {s.user.lastName}</p>
                      <Badge label={ROLE_LABEL[s.user.role] ?? s.user.role} variant="neutral" />
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 text-xs flex items-center gap-2 mt-0.5">
                      <Icon className="w-3.5 h-3.5" /> {browserSummary(s.userAgent)}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 text-xs font-mono">{s.ipAddress ?? "—"}</td>
                    <td className="px-5 py-3.5 text-slate-400 text-xs">{formatRelative(s.createdAt)}</td>
                    <td className="px-5 py-3.5 text-slate-400 text-xs">{formatRelative(s.expiresAt)}</td>
                    <td className="px-5 py-3.5">
                      <button onClick={() => revoke(s)} title="Revoke session" className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-red-400">
                        <X className="w-4 h-4" />
                      </button>
                    </td>
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
