"use client";
import { Star }    from "lucide-react";
import { useApi }  from "@/lib/hooks";
import { api }     from "@/lib/api";
import { useState } from "react";

// NPS is stored in tenant metadata pending dedicated model
export default function NpsPage() {
  const { data: tenants } = useApi<any>("/tenants?limit=200&status=ACTIVE");
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);
  const list = tenants?.data ?? [];

  const sendSurvey = async () => {
    if (!confirm(`Send NPS survey to all ${list.length} active tenants?`)) return;
    setSending(true);
    try {
      let queued = 0;
      for (const t of list) {
        await api.post("/notifications/send", {
          channel: "EMAIL",
          subject: "How likely are you to recommend SchoolOS?",
          body:    `Hi ${t.name} team,\n\nOn a scale of 0–10, how likely are you to recommend SchoolOS to another school?\n\nReply to this email with your score and any feedback.\n\nThank you!`,
        }).catch(() => null);
        queued++;
      }
      setSent(true);
      setTimeout(() => setSent(false), 5000);
    } catch (e: any) { alert(e.message); }
    finally { setSending(false); }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">NPS Tracking</h1>
        <p className="text-slate-400 text-sm mt-1">Net Promoter Score surveys — send and track school sentiment</p>
      </div>

      {sent && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm px-4 py-3 rounded-lg mb-5">✓ NPS survey sent to all active tenants</div>}

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "NPS Score",    value: "—",   sub: "Not enough responses" },
          { label: "Promoters",    value: "—",   sub: "Score 9-10" },
          { label: "Detractors",   value: "—",   sub: "Score 0-6" },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-slate-900 rounded-xl border border-slate-800 p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{label}</p>
            <p className="text-3xl font-bold text-white mt-1">{value}</p>
            <p className="text-xs text-slate-600 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <h2 className="text-sm font-semibold text-slate-300 mb-2">Send NPS survey</h2>
        <p className="text-xs text-slate-500 mb-4">Sends an email to all {list.length} active school admins asking for a 0–10 score.</p>
        <button onClick={sendSurvey} disabled={sending}
          className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors">
          <Star className="w-4 h-4" />
          {sending ? "Sending..." : `Send survey to ${list.length} schools`}
        </button>
        <p className="text-xs text-slate-600 mt-3">A dedicated NPS model is on the roadmap — responses will be tracked automatically when built.</p>
      </div>
    </div>
  );
}
