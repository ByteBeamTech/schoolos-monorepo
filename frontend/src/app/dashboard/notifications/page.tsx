"use client";
import { useState } from "react";
import { Bell, Send, Mail, MessageSquare } from "lucide-react";
import { PageHeader }         from "@/components/ui/page-header";
import { apiClient }          from "@/lib/api";
import { StatCard }           from "@/components/ui/stat-card";
import { Badge }              from "@/components/ui/badge";
import { EmptyState }         from "@/components/ui/empty-state";
import { useNotificationStats, useApi } from "@/lib/hooks";

interface Notification {
  id:        string;
  channel:   string;
  status:    string;
  subject?:  string;
  body:      string;
  createdAt: string;
  sentAt?:   string;
}

function channelVariant(channel: string) {
  if (channel === "EMAIL")    return "info";
  if (channel === "SMS")      return "success";
  if (channel === "WHATSAPP") return "success";
  return "neutral";
}

function statusVariant(status: string) {
  if (status === "SENT")    return "success";
  if (status === "FAILED")  return "error";
  if (status === "PENDING") return "warning";
  return "neutral";
}

export default function NotificationsPage() {
  const { data: stats, loading: statsLoading } = useNotificationStats();
  const { data: list,  loading: listLoading  } = useApi<Notification[]>("/notifications?limit=50");

  const [showSend, setShowSend] = useState(false);
  const [sendForm, setSendForm] = useState({ channel: "SMS", phone: "", email: "", subject: "", body: "" });
  const [sending,  setSending]  = useState(false);

  const sf = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setSendForm(prev => ({ ...prev, [k]: e.target.value }));

  const sendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await apiClient.post("/notifications/send", sendForm);
      setShowSend(false);
      setSendForm({ channel: "SMS", phone: "", email: "", subject: "", body: "" });
    } catch (err: any) {
      alert(err?.response?.data?.message ?? "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const notifications = Array.isArray(list) ? list : [];

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Email, SMS and WhatsApp delivery history"
        action={
          <button
            onClick={() => setShowSend(p => !p)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            <Send className="w-4 h-4" /> Send Notification
          </button>
        }
      />

      {showSend && (
        <div className="bg-white border border-blue-100 rounded-xl p-5 mb-6 shadow-sm">
          <h3 className="font-semibold text-slate-900 text-sm mb-4">Send Notification</h3>
          <form onSubmit={sendNotification} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Channel *</label>
              <select required value={sendForm.channel} onChange={sf("channel")}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                {["SMS", "EMAIL", "WHATSAPP", "PUSH"].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                {sendForm.channel === "EMAIL" ? "Email" : "Phone"}
              </label>
              <input type="text"
                value={sendForm.channel === "EMAIL" ? sendForm.email : sendForm.phone}
                onChange={sf(sendForm.channel === "EMAIL" ? "email" : "phone")}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {sendForm.channel === "EMAIL" && (
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Subject</label>
                <input type="text" value={sendForm.subject} onChange={sf("subject")}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Message *</label>
              <textarea required rows={3} value={sendForm.body} onChange={sf("body")}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" disabled={sending}
                className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium disabled:opacity-50">
                {sending ? "Sending..." : "Send"}
              </button>
              <button type="button" onClick={() => setShowSend(false)}
                className="px-5 py-2 bg-slate-100 text-slate-600 text-sm rounded-lg">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Sent"   value={stats?.sent        ?? 0} icon={<Send className="w-5 h-5" />}        color="blue"   loading={statsLoading} />
        <StatCard label="Delivered"    value={stats?.sent        ?? 0} icon={<Mail className="w-5 h-5" />}        color="green"  loading={statsLoading} />
        <StatCard label="Failed"       value={stats?.failed      ?? 0} icon={<Bell className="w-5 h-5" />}        color="red"    loading={statsLoading} />
        <StatCard label="Delivery Rate" value={`${stats?.deliveryRate ?? 0}%`} icon={<MessageSquare className="w-5 h-5" />} color="purple" loading={statsLoading} />
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Recent Notifications</h2>
        </div>
        {listLoading ? (
          <div className="p-8 space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />)}
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            title="No notifications yet"
            message="Send your first notification using the button above."
            icon={<Bell className="w-12 h-12" />}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Channel</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Message</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Sent At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {notifications.map((n: Notification) => (
                <tr key={n.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4"><Badge label={n.channel} variant={channelVariant(n.channel)} /></td>
                  <td className="px-6 py-4">
                    {n.subject && <p className="font-medium text-slate-900 text-xs">{n.subject}</p>}
                    <p className="text-slate-500 text-xs truncate max-w-xs">{n.body}</p>
                  </td>
                  <td className="px-6 py-4"><Badge label={n.status} variant={statusVariant(n.status)} /></td>
                  <td className="px-6 py-4 text-slate-500 text-xs">
                    {n.sentAt
                      ? new Date(n.sentAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
