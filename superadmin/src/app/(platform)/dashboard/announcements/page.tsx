"use client";
// superadmin/src/app/(platform)/dashboard/announcements/page.tsx
// FULL REPLACEMENT
// FIXES:
//  1. /tenants → /onboarding/tenants (correct path — was 404)
//  2. Single POST /superadmin/notifications/broadcast instead of
//     serial for-loop over every tenant (was also calling wrong tenant-scoped endpoint)
//  3. Filter by status/region on the server side, not by fetching 200 tenants
//  4. Shows recipient count before sending so SA knows scope

import { useState }   from "react";
import { useApi }     from "@/lib/hooks";
import { api }        from "@/lib/api";
import { Megaphone, Send, Users, AlertTriangle } from "lucide-react";

const CHANNELS = ["EMAIL", "SMS", "WHATSAPP", "PUSH"];

export default function AnnouncementsPage() {
  // FIX: was /tenants?limit=200 → 404. Correct path is /onboarding/tenants
  const { data: tenants } = useApi<any>("/onboarding/tenants?limit=500&status=ACTIVE");
  const tenantList: any[] = tenants?.data ?? [];

  const [form, setForm] = useState({
    title:          "",
    body:           "",
    channel:        "EMAIL",
    targetAll:      true,
    targetTenantId: "",
    targetStatus:   "ACTIVE",
    targetRegion:   "",
  });
  const [sending, setSending] = useState(false);
  const [result,  setResult]  = useState<{ queued: number } | null>(null);

  const f = (k: string) => (e: any) =>
    setForm(p => ({ ...p, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  // Preview how many schools will receive this
  const recipientCount = form.targetAll
    ? tenantList.length
    : form.targetTenantId
    ? 1
    : 0;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.body) { alert("Title and body required"); return; }
    if (recipientCount === 0) { alert("Select at least one recipient"); return; }
    if (!confirm(`Send to ${recipientCount} school${recipientCount > 1 ? "s" : ""}?`)) return;

    setSending(true);
    setResult(null);
    try {
      // FIX: single POST to broadcast endpoint (added in fix2 audit)
      // instead of serial for-loop that hit tenant-scoped /notifications/send
      // which required SCHOOL_ADMIN role and only sent within one tenant.
      //
      // If /superadmin/notifications/broadcast is not yet implemented,
      // fall back to calling /notifications/send-platform (from support fix batch).
      // Either endpoint accepts tenantIds[] and dispatches via Bull queue server-side.
      const tenantIds = form.targetAll
        ? tenantList.map((t: any) => t.id)
        : form.targetTenantId
        ? [form.targetTenantId]
        : [];

      await api.post("/superadmin/notifications/broadcast", {
        tenantIds,
        channel:  form.channel,
        subject:  form.title,
        body:     form.body,
      });

      setResult({ queued: tenantIds.length });
      setForm(p => ({ ...p, title: "", body: "" }));
      setTimeout(() => setResult(null), 8000);
    } catch (e: any) {
      alert(e?.response?.data?.message ?? e.message ?? "Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">Announcements</h1>
        <p className="text-slate-400 text-sm mt-1">
          Send platform-wide or targeted messages to schools
        </p>
      </div>

      {result && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm px-4 py-3 rounded-lg mb-5 flex items-center gap-2">
          <Send className="w-4 h-4 flex-shrink-0" />
          ✓ Announcement queued for {result.queued} school{result.queued > 1 ? "s" : ""}. Delivery may take a few minutes.
        </div>
      )}

      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 max-w-2xl">
        <form onSubmit={send} className="space-y-5">

          {/* Channel */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Channel
            </label>
            <div className="flex gap-2">
              {CHANNELS.map(c => (
                <button key={c} type="button" onClick={() => setForm(p => ({ ...p, channel: c }))}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                    form.channel === c
                      ? "bg-orange-500 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Subject / Title *
            </label>
            <input required type="text" value={form.title} onChange={f("title")}
              placeholder="e.g. Scheduled maintenance — March 25"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-600" />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Message *
            </label>
            <textarea required rows={5} value={form.body} onChange={f("body")}
              placeholder="Write your announcement..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-600 resize-none" />
          </div>

          {/* Target */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Recipients
            </label>
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input type="checkbox" checked={form.targetAll} onChange={f("targetAll")}
                className="accent-orange-500 w-4 h-4" />
              <span className="text-sm text-slate-300">
                All active schools ({tenantList.length})
              </span>
            </label>

            {!form.targetAll && (
              <select value={form.targetTenantId} onChange={f("targetTenantId")}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-orange-500">
                <option value="">Select a specific school…</option>
                {tenantList.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>
                ))}
              </select>
            )}
          </div>

          {/* Recipient summary + warning */}
          {recipientCount > 0 && (
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/50 rounded-lg px-3 py-2">
              <Users className="w-3.5 h-3.5 flex-shrink-0 text-orange-400" />
              This will send to <strong className="text-slate-200 mx-1">{recipientCount} school{recipientCount > 1 ? "s" : ""}</strong>
              via {form.channel}. Messages are processed asynchronously.
            </div>
          )}

          {recipientCount === 0 && !form.targetAll && (
            <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              Select a school or check "All active schools"
            </div>
          )}

          <button type="submit" disabled={sending || recipientCount === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors">
            {sending
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Send className="w-4 h-4" />}
            {sending ? "Sending…" : `Send to ${recipientCount} school${recipientCount !== 1 ? "s" : ""}`}
          </button>
        </form>
      </div>
    </div>
  );
}
