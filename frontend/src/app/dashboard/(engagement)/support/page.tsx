"use client";
/**
 * frontend/src/app/dashboard/(engagement)/support/page.tsx
 *
 * FIXES vs original:
 *  1. Removed dead apiFetch / authHeaders — only apiClient used
 *  2. Poll active ticket every 20s so new SA replies appear automatically
 *  3. Reopen logic: RESOLVED/CLOSED ticket gets status back to OPEN on school reply
 *     (calls PATCH /support/tickets/:id/reopen before POST messages)
 *  4. Message thread fills parent flex height — no nested double-scroll
 *  5. Error states surfaced for both list and ticket fetches
 *  6. "Ctrl+Enter to send" hint stays correct on Mac (⌘) vs Windows (Ctrl)
 */

import { HelpTip }      from "@/components/ui/help-tip";
import { HELP }         from "@/lib/help-content";
import { useState, useEffect, useCallback, useRef } from "react";
import { PageHeader }   from "@/components/ui/page-header";
import { Badge }        from "@/components/ui/badge";
import { EmptyState }   from "@/components/ui/empty-state";
import { useApi }       from "@/lib/hooks";
import { apiClient }    from "@/lib/api";
import type { BadgeVariant }
from "@/components/ui/badge";
import {
  MessageSquare, Plus, Clock, CheckCircle,
  AlertCircle, Send, X, RefreshCw,
} from "lucide-react";
import { useToast } from "@/lib/use-toast";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_V: Record<string, BadgeVariant> = {
  OPEN: "error", IN_PROGRESS: "warning", WAITING_CUSTOMER: "info",
  RESOLVED: "success", CLOSED: "neutral",
};
const PRIORITY_V: Record<string, BadgeVariant> = {
  CRITICAL: "error", HIGH: "warning", MEDIUM: "info", LOW: "neutral",
};
const CATEGORIES = ["BILLING","TECHNICAL","FEATURE_REQUEST","ONBOARDING","BUG","OTHER"];
const PRIORITIES  = ["LOW","MEDIUM","HIGH","CRITICAL"];

const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);
const SEND_HINT = isMac ? "⌘+Enter to send" : "Ctrl+Enter to send";

// ── Component ─────────────────────────────────────────────────────────────────

export default function SupportPage() {
  const { toast } = useToast();

  // UI state
  const [showForm, setShowForm]   = useState(false);
  const [selected, setSelected]   = useState<string | null>(null);
  const [reply,    setReply]      = useState("");
  const [saving,   setSaving]     = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", category: "TECHNICAL", priority: "MEDIUM",
  });

  // Refs
  const threadRef   = useRef<HTMLDivElement>(null);
  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const {
    data: tickets, loading, error: listError, refetch,
  } = useApi<any[]>("/support/tickets");

  // Manual ticket fetch (used for polling — not useApi, to avoid flicker)
  const [ticket,      setTicket]      = useState<any | null>(null);
  const [ticketError, setTicketError] = useState<string | null>(null);

  const fetchTicket = useCallback(async (id: string) => {
    try {
      const res = await apiClient.get(`/support/tickets/${id}`);
      setTicket(res.data);
      setTicketError(null);
    } catch (e: any) {
      setTicketError(e?.response?.data?.message ?? "Failed to load ticket");
    }
  }, []);

  // Load ticket when selection changes; clear stale data immediately
  useEffect(() => {
    if (!selected) { setTicket(null); setTicketError(null); return; }
    setTicket(null);
    fetchTicket(selected);
  }, [selected, fetchTicket]);

  // Poll the open ticket every 20 s — surfaces SA replies without page reload
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!selected) return;
    pollRef.current = setInterval(() => fetchTicket(selected), 20_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selected, fetchTicket]);

  // Scroll thread to bottom when new messages arrive
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [ticket?.messages?.length]);

  // ── Derived counts ─────────────────────────────────────────────────────────

  const list         = Array.isArray(tickets) ? tickets : [];
  const openCount    = list.filter(t => t.status === "OPEN").length;
  const inProgCount  = list.filter(t => ["IN_PROGRESS","WAITING_CUSTOMER"].includes(t.status)).length;
  const resolvedCount = list.filter(t => t.status === "RESOLVED").length;

  // ── Handlers ───────────────────────────────────────────────────────────────

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const createTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) return;
    setSaving(true);
    try {
      const res = await apiClient.post("/support/tickets", form);
      // apiClient wraps axios — response body is at res.data
      const created = res.data;
      setShowForm(false);
      setForm({ title: "", description: "", category: "TECHNICAL", priority: "MEDIUM" });
      await refetch();
      setSelected(created.id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? err.message ?? "Failed to create ticket");
    } finally { setSaving(false); }
  };

  const sendReply = async () => {
    if (!reply.trim() || !selected || !ticket) return;
    setSaving(true);
    try {
      const isClosed = ["RESOLVED","CLOSED"].includes(ticket.status);

      // FIX: reopen ticket before posting message — backend addMessage only
      // promotes WAITING_CUSTOMER → IN_PROGRESS, not RESOLVED/CLOSED → OPEN
      if (isClosed) {
        await apiClient.patch(`/support/tickets/${selected}/reopen`);
      }

      await apiClient.post(`/support/tickets/${selected}/messages`, { message: reply });
      setReply("");
      // Refresh both the thread and the list (status chip in list must update)
      await Promise.all([fetchTicket(selected), refetch()]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? err.message ?? "Failed to send reply");
    } finally { setSaving(false); }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isSendKey = isMac ? e.metaKey : e.ctrlKey;
    if (e.key === "Enter" && isSendKey) { e.preventDefault(); sendReply(); }
  };

  const selectTicket = (id: string) => {
    setSelected(id);
    setShowForm(false);
    setReply("");
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Support"
        subtitle="Raise tickets and chat with SchoolOS support team"
        action={
          <button
            onClick={() => { setShowForm(p => !p); if (!showForm) setSelected(null); }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? "Cancel" : "New Ticket"}
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Open",        value: openCount,     icon: <AlertCircle className="w-4 h-4 text-red-500" />,     color: "text-red-600"     },
          { label: "In Progress", value: inProgCount,   icon: <Clock       className="w-4 h-4 text-amber-500" />,   color: "text-amber-600"   },
          { label: "Resolved",    value: resolvedCount, icon: <CheckCircle className="w-4 h-4 text-emerald-500" />, color: "text-emerald-600" },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            {icon}
            <div>
              <p className="text-xs text-slate-500">{label}</p>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* New ticket form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-6 mb-6">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-600" />
            New Support Ticket
          </h3>
          <form onSubmit={createTicket} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Subject *
              </label>
              <input
                type="text" required value={form.title} onChange={f("title")}
                placeholder="Brief description of the issue"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Category
                </label>
                <select value={form.category} onChange={f("category")}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Priority</label>
                  <HelpTip content={HELP["support-priority"]} size="sm" />
                </div>
                <select value={form.priority} onChange={f("priority")}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {PRIORITIES.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Description *
              </label>
              <textarea
                required rows={4} value={form.description} onChange={f("description")}
                placeholder="Describe the issue in detail — include error messages, steps to reproduce, and what you expected."
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2 border-t border-slate-100">
              <button type="submit" disabled={saving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors flex items-center gap-2">
                {saving && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {saving ? "Submitting…" : "Submit Ticket"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main panel — fixed height so inner areas scroll, not the page */}
      <div className="grid grid-cols-5 gap-4 flex-1 min-h-0">

        {/* Ticket list */}
        <div className="col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-slate-50 flex-shrink-0">
            <p className="text-sm font-semibold text-slate-700">Your Tickets ({list.length})</p>
          </div>

          {/* Error state */}
          {listError && (
            <div className="p-4 flex flex-col items-center gap-2 text-center">
              <AlertCircle className="w-8 h-8 text-red-300" />
              <p className="text-sm text-slate-500">{listError}</p>
              <button onClick={refetch}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Retry
              </button>
            </div>
          )}

          {/* Loading skeleton */}
          {!listError && loading && (
            <div className="p-4 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          )}

          {/* Empty */}
          {!listError && !loading && list.length === 0 && (
            <EmptyState
              title="No tickets yet"
              message="Create a ticket to get help from the SchoolOS team."
              icon={<MessageSquare className="w-10 h-10" />}
            />
          )}

          {/* List */}
          {!listError && !loading && list.length > 0 && (
            <div className="divide-y divide-slate-50 overflow-y-auto flex-1">
              {list.map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => selectTicket(t.id)}
                  className={`w-full text-left px-4 py-3.5 hover:bg-slate-50 transition-colors ${
                    selected === t.id ? "bg-blue-50 border-l-2 border-blue-500" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{t.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {t.ticketNumber} · {t.category?.replace(/_/g, " ")}
                      </p>
                      {t.messages?.[0] && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">
                          {t.messages[0].senderRole === "SUPER_ADMIN" ? "💬 Support: " : "You: "}
                          {t.messages[0].message}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <Badge label={t.status.replace(/_/g, " ")} variant={STATUS_V[t.status]} />
                      <Badge label={t.priority}                  variant={PRIORITY_V[t.priority]} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Ticket detail */}
        <div className="col-span-3 bg-white rounded-xl border border-slate-100 shadow-sm flex flex-col min-h-0">

          {/* Nothing selected */}
          {!selected && (
            <div className="flex-1 flex items-center justify-center p-12">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 text-sm font-medium">Select a ticket to view</p>
                <p className="text-slate-300 text-xs mt-1">or create a new one above</p>
              </div>
            </div>
          )}

          {/* Ticket fetch error */}
          {selected && ticketError && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
              <AlertCircle className="w-8 h-8 text-red-300" />
              <p className="text-sm text-slate-500">{ticketError}</p>
              <button onClick={() => fetchTicket(selected)}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Retry
              </button>
            </div>
          )}

          {/* Loading skeleton for ticket */}
          {selected && !ticketError && !ticket && (
            <div className="flex-1 p-5 space-y-3">
              <div className="h-6 w-2/3 bg-slate-100 rounded animate-pulse" />
              <div className="h-4 w-1/3 bg-slate-100 rounded animate-pulse" />
              <div className="mt-4 h-24 bg-slate-100 rounded-lg animate-pulse" />
            </div>
          )}

          {/* Ticket content */}
          {selected && !ticketError && ticket && (
            <>
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-100 flex-shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">{ticket.title}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400">{ticket.ticketNumber}</span>
                      <span className="text-slate-200">·</span>
                      <span className="text-xs text-slate-400">{ticket.category?.replace(/_/g, " ")}</span>
                    </div>
                    {ticket.slaResolutionDueAt && !["RESOLVED","CLOSED"].includes(ticket.status) && (
                      <p className={`text-xs mt-1 ${ticket.slaResolutionBreached ? "text-red-500 font-medium" : "text-slate-400"}`}>
                        {ticket.slaResolutionBreached
                          ? "⚠️ SLA exceeded — our team has been alerted"
                          : `Expected resolution by ${new Date(ticket.slaResolutionDueAt).toLocaleString("en-IN")}`}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <Badge label={ticket.status.replace(/_/g, " ")} variant={STATUS_V[ticket.status]} />
                    <Badge label={ticket.priority}                  variant={PRIORITY_V[ticket.priority]} />
                  </div>
                </div>
              </div>

              {/* Message thread — flex-1 fills remaining space, single scroll */}
              <div ref={threadRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                {/* Original description */}
                <div className="bg-slate-50 rounded-lg p-3.5">
                  <p className="text-xs text-slate-400 font-medium mb-1.5">Your original request</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{ticket.description}</p>
                </div>

                {/* Messages (hide internal notes from school) */}
                {(ticket.messages ?? [])
                  .filter((m: any) => !m.isInternal)
                  .map((msg: any) => {
                    const isSchool = msg.senderRole !== "SUPER_ADMIN";
                    return (
                      <div
                        key={msg.id}
                        className={`rounded-lg p-3.5 ${
                          isSchool
                            ? "bg-blue-50 ml-8"
                            : "bg-slate-50 mr-8 border border-slate-100"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-xs font-semibold ${isSchool ? "text-blue-600" : "text-slate-600"}`}>
                            {isSchool ? "You" : "🎧 SchoolOS Support"}
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(msg.createdAt).toLocaleString("en-IN", {
                              day: "numeric", month: "short",
                              hour: "2-digit", minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{msg.message}</p>
                      </div>
                    );
                  })}
              </div>

              {/* Reply box — always shown; reopen happens transparently */}
              <div className="p-4 border-t border-slate-100 flex-shrink-0">
                {["RESOLVED","CLOSED"].includes(ticket.status) && (
                  <p className="text-xs text-slate-400 mb-2 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    This ticket is {ticket.status.toLowerCase()}. Sending a message will reopen it.
                  </p>
                )}
                <div className="flex gap-2">
                  <textarea
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    onKeyDown={onKeyDown}
                    rows={2}
                    placeholder={`Type your reply… (${SEND_HINT})`}
                    className="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <button
                    onClick={sendReply}
                    disabled={saving || !reply.trim()}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors self-end"
                  >
                    {saving
                      ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin block" />
                      : <Send className="w-4 h-4" />}
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
