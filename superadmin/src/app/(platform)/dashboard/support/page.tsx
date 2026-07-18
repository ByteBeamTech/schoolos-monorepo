"use client";
import { useState, useEffect, useRef } from "react";
import { useApi }         from "@/lib/hooks";
import { api }            from "@/lib/api";
import { PageHeader }     from "@/components/ui/page-header";
import { Badge }          from "@/components/ui/badge";
import { useToast }       from "@/components/ui/use-toast";
import { useSocketEvent } from "@/lib/use-socket";
import { notifyTab }      from "@/lib/tab-attention";
import { MessageSquare, AlertCircle, Clock, CheckCircle, AlertTriangle, Zap } from "lucide-react";

const STATUS_COLORS: Record<string, any> = {
  OPEN:             "error",
  IN_PROGRESS:      "warning",
  WAITING_CUSTOMER: "info",
  RESOLVED:         "success",
  CLOSED:           "neutral",
};
const PRIORITY_COLORS: Record<string, any> = {
  CRITICAL: "error",
  HIGH:     "warning",
  MEDIUM:   "info",
  LOW:      "neutral",
};

export default function SupportPage() {
  const [statusFilter,  setStatusFilter]  = useState("OPEN");
  const [slaFilter,     setSlaFilter]     = useState(false);
  const [priorityFilter, setPriorityFilter] = useState("");
  const [selected,      setSelected]      = useState<any>(null);
  const [reply,         setReply]         = useState("");
  const [sending,       setSending]       = useState(false);
  const [runningCheck,  setRunningCheck]  = useState(false);
  const { toast } = useToast();

  // Polling reuses the same opt-in mechanism built for the sidebar's
  // pending-count badge (UI-0.5) -- pauses while the tab is hidden,
  // refetches immediately on focus. Now that the realtime gateway is
  // active (see useSocketEvent wiring below), these intervals are a
  // FALLBACK, not the primary delivery path -- kept moderate/loose
  // rather than removed entirely, so a dropped socket connection
  // (backend restart, proxy hiccup, reconnect delay) still self-heals
  // within a bounded time instead of going silent indefinitely.
  const { data: stats }                     = useApi<any>("/support/admin/stats", [], { pollInterval: 45000 });
  const { data: tickets, loading, refetch } = useApi<any[]>(
    `/support/admin/tickets?status=${statusFilter}${slaFilter ? "&slaBreached=true" : ""}${priorityFilter ? `&priority=${priorityFilter}` : ""}`,
    [statusFilter, slaFilter, priorityFilter],
    { pollInterval: 45000 }
  );
  const { data: ticket, refetch: refetchTicket } = useApi<any>(
    selected ? `/support/admin/tickets/${selected}` : "", [selected],
    { pollInterval: 25000 }
  );

  // REALTIME: primary delivery path. These just trigger the existing
  // refetch()/refetchTicket() -- the diffing/toast logic below already
  // handles notification display correctly regardless of whether the
  // underlying data changed because of a socket ping or a poll tick, so
  // there's no separate/duplicate toast logic needed here.
  useSocketEvent("support:new-ticket", () => refetch());
  useSocketEvent("support:new-message", (payload: any) => {
    if (payload?.ticketId === selected) refetchTicket();
    refetch(); // keep list ordering/unread-style signals fresh too
  });

  const list = Array.isArray(tickets) ? tickets : [];

  // Notify when a genuinely new ticket appears in the current filtered
  // list (poll-driven). `knownTicketIds` starts null so the very first
  // load just establishes the baseline silently -- no toast for tickets
  // that already existed when the page opened, only ones that show up
  // after.
  const knownTicketIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!Array.isArray(tickets)) return;
    if (knownTicketIds.current) {
      for (const t of tickets) {
        if (!knownTicketIds.current.has(t.id)) {
          toast({ description: `New ticket: ${t.title} — ${t.tenant?.name ?? "unknown school"}` });
          notifyTab("New ticket");
        }
      }
    }
    knownTicketIds.current = new Set(tickets.map((t: any) => t.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets]);

  // Reset the message-count baseline whenever a *different* ticket is
  // selected, so switching tickets never fires a false "new message"
  // toast just because the newly-opened ticket happens to have more
  // messages than whatever was previously selected.
  const lastMessageCount = useRef<number | null>(null);
  useEffect(() => { lastMessageCount.current = null; }, [selected]);

  // Notify when a new message appears on the currently-open ticket
  // (poll/socket-driven) -- e.g. the school replied while a superadmin
  // was reading it.
  //
  // BUG FIX (found via real usage): this used to fire on ANY message-
  // count increase, including the superadmin's OWN reply -- sending a
  // message through this same panel calls refetchTicket() on success,
  // which increased the count and toasted "New message" right back at
  // the person who just sent it. Fixed by only toasting when the
  // *latest* message's senderRole isn't SUPER_ADMIN -- i.e. only notify
  // about messages that came from the school side, not our own replies.
  // (Known limitation, acceptable tradeoff: if a *different* superadmin
  // replies to the same ticket while this one is watching, it's also
  // suppressed -- rare enough not to be worth a per-user sender check
  // here.)
  useEffect(() => {
    if (!ticket?.messages) return;
    const count = ticket.messages.length;
    const latest = ticket.messages[ticket.messages.length - 1];
    if (
      lastMessageCount.current !== null &&
      count > lastMessageCount.current &&
      latest?.senderRole !== "SUPER_ADMIN"
    ) {
      toast({ description: `New message on ${ticket.ticketNumber ?? "this ticket"}` });
      notifyTab("New message");
    }
    lastMessageCount.current = count;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket]);

  const sendReply = async () => {
    if (!reply.trim() || !selected) return;
    setSending(true);
    try {
      await api.post(`/support/admin/tickets/${selected}/messages`, { message: reply });
      setReply(""); refetchTicket();
    } catch (e: any) { alert(e.message); }
    finally { setSending(false); }
  };

  const updateStatus = async (id: string, status: string) => {
    try { await api.patch(`/support/admin/tickets/${id}`, { status }); refetch(); refetchTicket(); }
    catch (e: any) { alert(e.message); }
  };

  const runSLACheck = async () => {
    setRunningCheck(true);
    try {
      const res: any = await api.post("/support/admin/sla/run", {});
      alert(`SLA check done: ${res.checked} tickets | ${res.breaches} breaches | ${res.escalations} escalations`);
      refetch();
    } catch (e: any) { alert(e.message); }
    finally { setRunningCheck(false); }
  };

  const getSLAStatus = (t: any) => {
    if (t.slaResolutionBreached) return { label: "Resolution SLA", color: "bg-red-500/10 text-red-400 border-red-500/20" };
    if (t.slaResponseBreached)   return { label: "Response SLA",   color: "bg-orange-500/10 text-orange-400 border-orange-500/20" };
    if (t.slaResolutionDueAt) {
      const mins = Math.round((new Date(t.slaResolutionDueAt).getTime() - Date.now()) / 60000);
      if (mins < 60)  return { label: `${mins}m left`, color: "bg-red-500/10 text-red-400 border-red-500/20" };
      if (mins < 240) return { label: `${Math.round(mins/60)}h left`, color: "bg-amber-500/10 text-amber-400 border-amber-500/20" };
    }
    return null;
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Customer Support</h1>
          <p className="text-slate-400 text-sm mt-1">SLA tracking, auto-escalation, ticket management</p>
        </div>
        <button onClick={runSLACheck} disabled={runningCheck}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg disabled:opacity-50 transition-colors">
          <Zap className="w-4 h-4" />
          {runningCheck ? "Running..." : "Run SLA Check"}
        </button>
      </div>

      {/* Stats -- each card is clickable and applies the exact same
          filter combination the backend used to compute that count
          (e.g. "Critical" = status OPEN + priority CRITICAL, matching
          stats()'s own query -- not just a status match). */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        {[
          { label: "Open",        value: stats?.open        ?? 0, icon: <AlertCircle className="w-5 h-5 text-red-400" />,
            onClick: () => { setStatusFilter("OPEN"); setSlaFilter(false); setPriorityFilter(""); } },
          { label: "In Progress", value: stats?.inProgress  ?? 0, icon: <Clock       className="w-5 h-5 text-amber-400" />,
            onClick: () => { setStatusFilter("IN_PROGRESS"); setSlaFilter(false); setPriorityFilter(""); } },
          { label: "SLA Breached",value: stats?.slaBreached ?? 0, icon: <AlertTriangle className="w-5 h-5 text-orange-400" />,
            // Backend's slaBreached count spans every non-resolved/closed
            // status, not one specific status -- clearing statusFilter to
            // "" means the list omits the status param entirely (backend
            // treats a missing status filter as "any status"), matching
            // that same scope instead of narrowing to just one tab.
            onClick: () => { setStatusFilter(""); setSlaFilter(true); setPriorityFilter(""); } },
          { label: "Critical",    value: stats?.critical    ?? 0, icon: <AlertCircle className="w-5 h-5 text-red-500" />,
            onClick: () => { setStatusFilter("OPEN"); setSlaFilter(false); setPriorityFilter("CRITICAL"); } },
          { label: "Resolved",    value: stats?.resolved    ?? 0, icon: <CheckCircle className="w-5 h-5 text-emerald-400" />,
            onClick: () => { setStatusFilter("RESOLVED"); setSlaFilter(false); setPriorityFilter(""); } },
          { label: "Closed",      value: stats?.closed      ?? 0, icon: <CheckCircle className="w-5 h-5 text-slate-400" />,
            onClick: () => { setStatusFilter("CLOSED"); setSlaFilter(false); setPriorityFilter(""); } },
        ].map(({ label, value, icon, onClick }) => (
          <button key={label} onClick={onClick}
            className="bg-slate-900 rounded-xl border border-slate-800 p-4 flex items-center gap-3 text-left hover:border-slate-600 transition-colors cursor-pointer">
            {icon}
            <div>
              <p className="text-xs text-slate-500">{label}</p>
              <p className={`text-2xl font-bold ${label === "SLA Breached" && value > 0 ? "text-orange-400" : "text-white"}`}>{value}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        {["OPEN","IN_PROGRESS","WAITING_CUSTOMER","RESOLVED","CLOSED"].map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setPriorityFilter(""); }}
            className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
              statusFilter === s
                ? "bg-orange-500/10 border-orange-500 text-orange-400"
                : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600"
            }`}>{s.replace(/_/g," ")}</button>
        ))}
        {priorityFilter && (
          <span className="px-3 py-1.5 text-xs rounded-lg border border-red-500 bg-red-500/10 text-red-400 font-medium flex items-center gap-1.5">
            Priority: {priorityFilter}
            <button onClick={() => setPriorityFilter("")} className="hover:text-red-200">×</button>
          </span>
        )}
        <button onClick={() => setSlaFilter(p => !p)}
          className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ml-auto ${
            slaFilter
              ? "bg-red-500/10 border-red-500 text-red-400"
              : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600"
          }`}>
          <AlertTriangle className="w-3 h-3 inline mr-1" />SLA Breached Only
        </button>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {/* Ticket list */}
        <div className="col-span-2 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          {loading ? (
            <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-slate-800 rounded animate-pulse" />)}</div>
          ) : list.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">No tickets</div>
          ) : (
            <div className="divide-y divide-slate-800 overflow-y-auto max-h-[600px]">
              {list.map((t: any) => {
                const sla = getSLAStatus(t);
                return (
                  <button key={t.id} onClick={() => setSelected(t.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-slate-800/50 transition-colors ${selected === t.id ? "bg-slate-800 border-l-2 border-orange-500" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">{t.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{t.tenant?.name} · {t.ticketNumber}</p>
                        {sla && (
                          <span className={`inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${sla.color}`}>
                            <AlertTriangle className="w-2.5 h-2.5" />{sla.label}
                          </span>
                        )}
                        {t.escalationLevel > 0 && (
                          <span className="inline-flex items-center gap-1 ml-1 mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            Escalated L{t.escalationLevel}
                          </span>
                        )}
                      </div>
                      <Badge label={t.priority} variant={PRIORITY_COLORS[t.priority]} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Ticket detail */}
        <div className="col-span-3 bg-slate-900 rounded-xl border border-slate-800 flex flex-col">
          {!selected || !ticket ? (
            <div className="flex-1 flex items-center justify-center p-12">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">Select a ticket to view</p>
              </div>
            </div>
          ) : (
            <>
              <div className="px-5 py-4 border-b border-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-200">{ticket.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{ticket.ticketNumber} · {ticket.tenant?.name} · {ticket.category}</p>
                    {ticket.slaResolutionDueAt && (
                      <p className={`text-xs mt-1 ${ticket.slaResolutionBreached ? "text-red-400" : "text-slate-500"}`}>
                        Resolve by: {new Date(ticket.slaResolutionDueAt).toLocaleString()}
                        {ticket.slaResolutionBreached && " ⚠️ BREACHED"}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge label={ticket.status.replace(/_/g," ")} variant={STATUS_COLORS[ticket.status]} />
                    <Badge label={ticket.priority} variant={PRIORITY_COLORS[ticket.priority]} />
                  </div>
                </div>
                <div className="flex gap-2 mt-3 flex-wrap">
                  {["IN_PROGRESS","WAITING_CUSTOMER","RESOLVED","CLOSED"].map(s => (
                    <button key={s} onClick={() => updateStatus(ticket.id, s)}
                      disabled={ticket.status === s}
                      className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded disabled:opacity-40 transition-colors">
                      → {s.replace(/_/g," ")}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-80">
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">Original request</p>
                  <p className="text-sm text-slate-300">{ticket.description}</p>
                </div>
                {(ticket.messages ?? []).map((msg: any) => (
                  <div key={msg.id} className={`rounded-lg p-3 ${
                    msg.isInternal ? "bg-purple-500/5 border border-purple-500/20 opacity-70" :
                    msg.senderRole === "SUPER_ADMIN" ? "bg-orange-500/5 border border-orange-500/20 ml-4" :
                    "bg-slate-800/50 mr-4"
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-medium ${
                        msg.isInternal ? "text-purple-400" :
                        msg.senderRole === "SUPER_ADMIN" ? "text-orange-400" : "text-slate-400"
                      }`}>
                        {msg.isInternal ? "🔒 Internal Note" : msg.senderRole === "SUPER_ADMIN" ? "Support Team" : "School"}
                      </span>
                      <span className="text-xs text-slate-600">{new Date(msg.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-slate-300">{msg.message}</p>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-slate-800">
                <textarea value={reply} onChange={e => setReply(e.target.value)} rows={3}
                  placeholder="Reply to school... (check 'Internal note' to hide from school)"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-600 resize-none" />
                <div className="flex items-center justify-between mt-2">
                  <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                    <input type="checkbox" id="internal" className="rounded"
                      onChange={e => {
                        const btn = document.getElementById('reply-btn') as HTMLButtonElement;
                        if (btn) btn.dataset.internal = e.target.checked ? 'true' : 'false';
                      }} />
                    Internal note (hidden from school)
                  </label>
                  <button id="reply-btn" data-internal="false" onClick={async () => {
                    const btn = document.getElementById('reply-btn') as HTMLButtonElement;
                    const isInternal = btn?.dataset.internal === 'true';
                    if (!reply.trim()) return;
                    setSending(true);
                    try {
                      await api.post(`/support/admin/tickets/${selected}/messages`, { message: reply, isInternal });
                      setReply(""); refetchTicket();
                    } catch (e: any) { alert(e.message); }
                    finally { setSending(false); }
                  }} disabled={sending || !reply.trim()}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg disabled:opacity-40 transition-colors">
                    {sending ? "Sending..." : "Send Reply"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
