"use client";
import { HelpTip } from "@/components/ui/help-tip";
import { HELP }    from "@/lib/help-content";
import { useState }   from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge }      from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useApi }     from "@/lib/hooks";
import { MessageSquare, Plus, Clock, CheckCircle, AlertCircle, Send, X } from "lucide-react";
import { useToast } from '@/lib/use-toast';


const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://192.168.1.50:3000/api/v1";

function authHeaders(): Record<string, string> {
  const token    = typeof window !== "undefined" ? localStorage.getItem("accessToken")  : "";
  const tenantId = typeof window !== "undefined" ? localStorage.getItem("tenantId") : "";
  return {
    "Content-Type":  "application/json",
    "Authorization": `Bearer ${token}`,
    "x-tenant-id":   tenantId ?? "",
  };
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: { ...authHeaders(), ...(opts.headers ?? {}) },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? `HTTP ${res.status}`);
  return json;
}

const STATUS_V: Record<string, any> = {
  OPEN: "error", IN_PROGRESS: "warning", WAITING_CUSTOMER: "info",
  RESOLVED: "success", CLOSED: "neutral",
};
const PRIORITY_V: Record<string, any> = {
  CRITICAL: "error", HIGH: "warning", MEDIUM: "info", LOW: "neutral",
};

export default function SupportPage() {
  const { toast } = useToast();

  const [showForm,  setShowForm]  = useState(false);
  const [selected,  setSelected]  = useState<string | null>(null);
  const [reply,     setReply]     = useState("");
  const [saving,    setSaving]    = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", category: "TECHNICAL", priority: "MEDIUM",
  });

  const { data: tickets, loading, refetch } = useApi<any[]>("/support/tickets");
  const { data: ticket,  refetch: refetchTicket } = useApi<any>(
    selected ? `/support/tickets/${selected}` : "", [selected]
  );

  const list = Array.isArray(tickets) ? tickets : [];
  const f    = (k: string) => (e: React.ChangeEvent<any>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const createTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) return;
    setSaving(true);
    try {
      const created = await apiFetch("/support/tickets", {
        method: "POST",
        body:   JSON.stringify(form),
      });
      setShowForm(false);
      setForm({ title: "", description: "", category: "TECHNICAL", priority: "MEDIUM" });
      await refetch();
      setSelected(created.id);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create ticket");
    } finally { setSaving(false); }
  };

  const sendReply = async () => {
    if (!reply.trim() || !selected) return;
    setSaving(true);
    try {
      await apiFetch(`/support/tickets/${selected}/messages`, {
        method: "POST",
        body:   JSON.stringify({ message: reply }),
      });
      setReply("");
      refetchTicket();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to send reply");
    } finally { setSaving(false); }
  };

  const openCount     = list.filter(t => t.status === "OPEN").length;
  const inProgCount   = list.filter(t => ["IN_PROGRESS","WAITING_CUSTOMER"].includes(t.status)).length;
  const resolvedCount = list.filter(t => t.status === "RESOLVED").length;

  return (
    <div>
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
          { label:"Open",       value:openCount,     icon:<AlertCircle className="w-4 h-4 text-red-500"     />, color:"text-red-600"     },
          { label:"In Progress",value:inProgCount,   icon:<Clock       className="w-4 h-4 text-amber-500"   />, color:"text-amber-600"   },
          { label:"Resolved",   value:resolvedCount, icon:<CheckCircle className="w-4 h-4 text-emerald-500" />, color:"text-emerald-600" },
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

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-6 mb-6">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-600" />
            New Support Ticket
          </h3>
          <form onSubmit={createTicket} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Subject *</label>
              <input
                type="text" required value={form.title} onChange={f("title")}
                placeholder="Brief description of the issue"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Category</label>
                <select value={form.category} onChange={f("category")}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {["BILLING","TECHNICAL","FEATURE_REQUEST","ONBOARDING","BUG","OTHER"].map(c => (
                    <option key={c} value={c}>{c.replace(/_/g," ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1.5"><label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Priority</label><HelpTip content={HELP["support-priority"]} size="sm" /></div>
                <select value={form.priority} onChange={f("priority")}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {["LOW","MEDIUM","HIGH","CRITICAL"].map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Description *</label>
              <textarea
                required rows={4} value={form.description} onChange={f("description")}
                placeholder="Describe the issue in detail. Include error messages, steps to reproduce, and what you expected."
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div className="flex gap-3 pt-2 border-t border-slate-100">
              <button type="submit" disabled={saving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors flex items-center gap-2">
                {saving && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {saving ? "Submitting..." : "Submit Ticket"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Panel */}
      <div className="grid grid-cols-5 gap-4">
        {/* List */}
        <div className="col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-50">
            <p className="text-sm font-semibold text-slate-700">Your Tickets ({list.length})</p>
          </div>
          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />)}
            </div>
          ) : list.length === 0 ? (
            <EmptyState title="No tickets yet" message="Create a ticket to get help." icon={<MessageSquare className="w-10 h-10" />} />
          ) : (
            <div className="divide-y divide-slate-50 overflow-y-auto max-h-[500px]">
              {list.map((t: any) => (
                <button key={t.id} onClick={() => { setSelected(t.id); setShowForm(false); }}
                  className={`w-full text-left px-4 py-3.5 hover:bg-slate-50 transition-colors ${selected === t.id ? "bg-blue-50 border-l-2 border-blue-500" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{t.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{t.ticketNumber} · {t.category?.replace(/_/g," ")}</p>
                      {t.messages?.[0] && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">
                          {t.messages[0].senderRole === "SUPER_ADMIN" ? "💬 Support: " : "You: "}
                          {t.messages[0].message}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <Badge label={t.status.replace(/_/g," ")} variant={STATUS_V[t.status]} />
                      <Badge label={t.priority} variant={PRIORITY_V[t.priority]} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="col-span-3 bg-white rounded-xl border border-slate-100 shadow-sm flex flex-col min-h-[400px]">
          {!selected || !ticket ? (
            <div className="flex-1 flex items-center justify-center p-12">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 text-sm font-medium">Select a ticket to view</p>
                <p className="text-slate-300 text-xs mt-1">or create a new one above</p>
              </div>
            </div>
          ) : (
            <>
              <div className="px-5 py-4 border-b border-slate-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">{ticket.title}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400">{ticket.ticketNumber}</span>
                      <span className="text-slate-200">·</span>
                      <span className="text-xs text-slate-400">{ticket.category?.replace(/_/g," ")}</span>
                    </div>
                    {ticket.slaResolutionDueAt && !["RESOLVED","CLOSED"].includes(ticket.status) && (
                      <p className={`text-xs mt-1 ${ticket.slaResolutionBreached ? "text-red-500 font-medium" : "text-slate-400"}`}>
                        {ticket.slaResolutionBreached
                          ? "⚠️ SLA exceeded — our team has been alerted"
                          : `Expected resolution by ${new Date(ticket.slaResolutionDueAt).toLocaleString("en-IN")}`}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge label={ticket.status.replace(/_/g," ")} variant={STATUS_V[ticket.status]} />
                    <Badge label={ticket.priority} variant={PRIORITY_V[ticket.priority]} />
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-80">
                <div className="bg-slate-50 rounded-lg p-3.5">
                  <p className="text-xs text-slate-400 font-medium mb-1.5">Your original request</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{ticket.description}</p>
                </div>
                {(ticket.messages ?? []).filter((m: any) => !m.isInternal).map((msg: any) => (
                  <div key={msg.id} className={`rounded-lg p-3.5 ${
                    msg.senderRole !== "SUPER_ADMIN" ? "bg-blue-50 ml-8" : "bg-slate-50 mr-8 border border-slate-100"
                  }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-xs font-semibold ${msg.senderRole !== "SUPER_ADMIN" ? "text-blue-600" : "text-slate-600"}`}>
                        {msg.senderRole !== "SUPER_ADMIN" ? "You" : "🎧 SchoolOS Support"}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(msg.createdAt).toLocaleString("en-IN", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{msg.message}</p>
                  </div>
                ))}
              </div>

              {!["RESOLVED","CLOSED"].includes(ticket.status) ? (
                <div className="p-4 border-t border-slate-100">
                  <div className="flex gap-2">
                    <textarea
                      value={reply} onChange={e => setReply(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendReply(); }}
                      rows={2} placeholder="Type your reply... (Ctrl+Enter to send)"
                      className="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                    <button onClick={sendReply} disabled={saving || !reply.trim()}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors">
                      {saving
                        ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin block" />
                        : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 border-t border-slate-100 text-center">
                  <p className="text-sm text-slate-400 flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    Ticket {ticket.status.toLowerCase()} — send a message to reopen
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
