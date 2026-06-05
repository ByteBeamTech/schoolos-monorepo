"use client";
// superadmin/src/app/(platform)/dashboard/nps/page.tsx
// FULL REPLACEMENT
// FIXES:
//  1. /tenants → /onboarding/tenants (was 404)
//  2. sendSurvey calls /superadmin/notifications/broadcast instead of
//     serial for-loop on tenant-scoped /notifications/send (was 403)
//  3. Removed misleading "score tracking pending model" — honest UI
//     showing that scores aren't yet captured, with clear next step
//  4. Added last-sent timestamp stored in localStorage as a stopgap
//     so SA doesn't accidentally spam schools

import { useState }        from "react";
import { useApi }          from "@/lib/hooks";
import { api }             from "@/lib/api";
import { Star, Send, Clock, AlertTriangle } from "lucide-react";

const LAST_SENT_KEY = "nps_last_sent_at";

export default function NpsPage() {
  // FIX: was /tenants?limit=200&status=ACTIVE → 404
  const { data: tenants } = useApi<any>("/onboarding/tenants?limit=500&status=ACTIVE");
  const list: any[] = tenants?.data ?? [];

  const [sending,  setSending]  = useState(false);
  const [sent,     setSent]     = useState(false);
  const [lastSent, setLastSent] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(LAST_SENT_KEY);
  });

  const daysSinceLast = lastSent
    ? Math.floor((Date.now() - new Date(lastSent).getTime()) / 86400000)
    : null;

  const sendSurvey = async () => {
    if (daysSinceLast !== null && daysSinceLast < 60) {
      if (!confirm(
        `You sent an NPS survey ${daysSinceLast} days ago. Sending again so soon may annoy schools. Continue?`
      )) return;
    }
    if (!confirm(`Send NPS survey to all ${list.length} active schools?`)) return;

    setSending(true);
    try {
      // FIX: single broadcast call instead of serial loop
      await api.post("/superadmin/notifications/broadcast", {
        tenantIds: list.map((t: any) => t.id),
        channel:   "EMAIL",
        subject:   "How likely are you to recommend SchoolOS? (30 sec)",
        body: [
          "Hi team,",
          "",
          "On a scale of 0–10, how likely are you to recommend SchoolOS to another school?",
          "",
          "0 = Not at all likely   10 = Extremely likely",
          "",
          "Please reply to this email with:",
          "1. Your score (0–10)",
          "2. One thing we could do better",
          "",
          "Thank you — your feedback shapes our roadmap.",
          "",
          "— SchoolOS Team",
        ].join("\n"),
      });

      const now = new Date().toISOString();
      localStorage.setItem(LAST_SENT_KEY, now);
      setLastSent(now);
      setSent(true);
      setTimeout(() => setSent(false), 6000);
    } catch (e: any) {
      alert(e?.response?.data?.message ?? e.message ?? "Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">NPS Tracking</h1>
        <p className="text-slate-400 text-sm mt-1">
          Net Promoter Score — measure how likely schools are to recommend SchoolOS
        </p>
      </div>

      {sent && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm px-4 py-3 rounded-lg mb-5 flex items-center gap-2">
          <Send className="w-4 h-4 flex-shrink-0" />
          ✓ NPS survey sent to {list.length} schools. Track replies in your email.
        </div>
      )}

      {/* Scores — placeholder until NPS model is built */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "NPS Score",  value: "—", sub: "No responses captured yet" },
          { label: "Promoters",  value: "—", sub: "Score 9–10" },
          { label: "Detractors", value: "—", sub: "Score 0–6"  },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-slate-900 rounded-xl border border-slate-800 p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{label}</p>
            <p className="text-3xl font-bold text-white mt-1">{value}</p>
            <p className="text-xs text-slate-600 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Score capture notice */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-300">Score capture not yet built</p>
          <p className="text-xs text-amber-600 mt-1">
            Replies come to your email inbox. To display scores here, add an <code className="text-amber-500">NpsResponse</code> Prisma model
            and a webhook or reply-parser that stores scores. Until then, tally responses manually.
          </p>
        </div>
      </div>

      {/* Send panel */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 max-w-xl">
        <h2 className="text-sm font-semibold text-slate-300 mb-1">Send NPS survey</h2>
        <p className="text-xs text-slate-500 mb-4">
          Sends an email to all {list.length} active school admins asking for a 0–10 score.
          Recommended frequency: once per quarter.
        </p>

        {lastSent && (
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
            <Clock className="w-3.5 h-3.5 flex-shrink-0" />
            Last sent: {new Date(lastSent).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            {daysSinceLast !== null && daysSinceLast < 60 && (
              <span className="text-amber-500 font-medium">({daysSinceLast}d ago — consider waiting)</span>
            )}
          </div>
        )}

        <button
          onClick={sendSurvey}
          disabled={sending || list.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors"
        >
          {sending
            ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <Star className="w-4 h-4" />}
          {sending ? "Sending…" : `Send survey to ${list.length} schools`}
        </button>
      </div>
    </div>
  );
}
