"use client";
import { useState }  from "react";
import { useApi }    from "@/lib/hooks";
import { api }       from "@/lib/api";
import { formatDate } from "@/lib/utils";

export default function TrialsPage() {
  const { data, loading, refetch } = useApi<any>("/superadmin/trials");
  const [nudging, setNudging]      = useState<string | null>(null);
  const [filter, setFilter]        = useState<"all"|"critical"|"warning"|"ok">("all");

  const list = (data?.list ?? []).filter((t: any) => filter === "all" || t.urgency === filter);

  const sendNudge = async (tenantId: string, email: string) => {
    setNudging(tenantId);
    try {
      await api.post("/notifications/send", {
        recipientId: tenantId,
        channel:     "EMAIL",
        subject:     "Your SchoolOS trial is ending soon",
        body:        `Hi! Your SchoolOS trial is ending soon. Upgrade now to keep your data and continue managing your school without interruption.`,
      });
      alert(`Nudge sent to ${email}`);
    } catch (e: any) { alert(e.message); }
    finally { setNudging(null); }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">Trial Funnel</h1>
        <p className="text-slate-400 text-sm mt-1">Schools still on trial — who's about to expire?</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { key:"critical", label:"Expiring in 3 days", value: data?.expiring3d ?? 0, color:"text-red-400"   },
          { key:"warning",  label:"Expiring in 7 days", value: data?.expiring7d ?? 0, color:"text-amber-400" },
          { key:"all",      label:"Total on trial",     value: data?.total      ?? 0, color:"text-white"     },
        ].map(({ key, label, value, color }) => (
          <button key={key} onClick={() => setFilter(key as any)}
            className={`bg-slate-900 rounded-xl border p-5 text-left transition-colors ${
              filter === key ? "border-orange-500/50" : "border-slate-800 hover:border-slate-700"
            }`}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
          </button>
        ))}
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-800">
            {["School","Email","Students","Plan","Trial ends","Days left","Action"].map(h => (
              <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr></thead>
          <tbody className="divide-y divide-slate-800/50">
            {loading ? [...Array(6)].map((_,i) => (
              <tr key={i}>{[...Array(7)].map((_,j) => (
                <td key={j} className="px-5 py-4"><div className="h-4 bg-slate-800 rounded animate-pulse"/></td>
              ))}</tr>
            )) : list.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-500">No trials matching filter</td></tr>
            ) : list.map((t: any) => (
              <tr key={t.tenantId} className="hover:bg-slate-800/30">
                <td className="px-5 py-3.5">
                  <p className="font-medium text-slate-200">{t.name}</p>
                  <p className="text-xs font-mono text-slate-500">{t.slug}</p>
                </td>
                <td className="px-5 py-3.5 text-slate-400 text-xs">{t.email}</td>
                <td className="px-5 py-3.5 text-slate-400">{t.students}</td>
                <td className="px-5 py-3.5 text-slate-400 text-xs">{t.planName}</td>
                <td className="px-5 py-3.5 text-xs text-slate-400">{t.trialEndsAt ? formatDate(t.trialEndsAt) : "—"}</td>
                <td className="px-5 py-3.5">
                  {t.daysLeft !== null ? (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      t.daysLeft <= 3 ? "bg-red-500/10 text-red-400" :
                      t.daysLeft <= 7 ? "bg-amber-500/10 text-amber-400" : "bg-slate-700 text-slate-400"
                    }`}>{t.daysLeft}d</span>
                  ) : "—"}
                </td>
                <td className="px-5 py-3.5">
                  <button
                    onClick={() => sendNudge(t.tenantId, t.email)}
                    disabled={nudging === t.tenantId}
                    className="text-xs text-orange-400 hover:text-orange-300 font-medium disabled:opacity-40 transition-colors">
                    {nudging === t.tenantId ? "Sending..." : "Send nudge →"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
