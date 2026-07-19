"use client";
import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { useApi } from "@/lib/hooks";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { formatDate, formatRelative } from "@/lib/utils";
import { MailPlus, Plus, X, RotateCcw, Ban } from "lucide-react";

const ROLES = ["SUPER_ADMIN", "SAAS_OWNER", "ACCOUNT_MANAGER"] as const;
const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin", SAAS_OWNER: "SaaS Owner", ACCOUNT_MANAGER: "Account Manager",
};
const STATUS_VARIANT: Record<string, any> = {
  PENDING: "warning", ACCEPTED: "success", CANCELLED: "neutral", EXPIRED: "error",
};

interface Invitation {
  id: string; email: string; role: string; department: string | null;
  status: string; expiresAt: string; createdAt: string; acceptedAt: string | null;
}

export default function AdminInvitationsPage() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ email: "", role: "ACCOUNT_MANAGER", department: "" });
  const [sending, setSending] = useState(false);

  const { data: invites, loading, refetch } = useApi<Invitation[]>(
    `/superadmin/invitations?status=${statusFilter}`, [statusFilter]
  );
  const list = Array.isArray(invites) ? invites : [];

  const sendInvite = async () => {
    if (!form.email) { toast({ description: "Email is required.", variant: "destructive" }); return; }
    setSending(true);
    try {
      await api.post("/superadmin/invitations", form);
      toast({ description: `Invitation sent to ${form.email}.` });
      setShowInvite(false);
      setForm({ email: "", role: "ACCOUNT_MANAGER", department: "" });
      refetch();
    } catch (e: any) {
      toast({ description: e.message || "Failed to send invitation.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const resend = async (inv: Invitation) => {
    try {
      await api.post(`/superadmin/invitations/${inv.id}/resend`, {});
      toast({ description: `Invitation resent to ${inv.email}.` });
      refetch();
    } catch (e: any) {
      toast({ description: e.message || "Failed to resend.", variant: "destructive" });
    }
  };

  const cancel = async (inv: Invitation) => {
    if (!confirm(`Cancel the invitation for ${inv.email}?`)) return;
    try {
      await api.delete(`/superadmin/invitations/${inv.id}`);
      toast({ description: "Invitation cancelled." });
      refetch();
    } catch (e: any) {
      toast({ description: e.message || "Failed to cancel.", variant: "destructive" });
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <PageHeader title="Platform Invitations" subtitle="Invite new platform staff to SchoolOS" />
        <button onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Invite User
        </button>
      </div>

      <div className="flex items-center gap-3 mb-5">
        {["PENDING", "ACCEPTED", "CANCELLED", "EXPIRED"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
              statusFilter === s
                ? "bg-orange-500/10 border-orange-500 text-orange-400"
                : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600"
            }`}>{s}</button>
        ))}
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-slate-800 rounded animate-pulse" />)}</div>
        ) : list.length === 0 ? (
          <div className="p-16 text-center">
            <MailPlus className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No {statusFilter.toLowerCase()} invitations.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Email</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Role</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Expires</th>
                {statusFilter === "PENDING" && <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {list.map(inv => (
                <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3.5 text-slate-200">{inv.email}{inv.department && <span className="text-slate-500 text-xs block">{inv.department}</span>}</td>
                  <td className="px-5 py-3.5"><Badge label={ROLE_LABEL[inv.role] ?? inv.role} variant="neutral" /></td>
                  <td className="px-5 py-3.5"><Badge label={inv.status} variant={STATUS_VARIANT[inv.status]} /></td>
                  <td className="px-5 py-3.5 text-slate-400 text-xs">{formatRelative(inv.expiresAt)}</td>
                  {statusFilter === "PENDING" && (
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <button onClick={() => resend(inv)} title="Resend" className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-200"><RotateCcw className="w-3.5 h-3.5" /></button>
                        <button onClick={() => cancel(inv)} title="Cancel" className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-red-400"><Ban className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showInvite && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-xs uppercase font-mono font-black tracking-widest text-slate-400">Invite Platform User</h3>
              <button onClick={() => setShowInvite(false)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-200"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="Email"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:outline-none focus:border-orange-500" />
              <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:outline-none">
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
              <input value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} placeholder="Department (optional)"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:outline-none focus:border-orange-500" />
              <p className="text-[11px] text-slate-500">An invite link (valid 7 days) will be emailed. They set their own password when accepting.</p>
            </div>
            <button onClick={sendInvite} disabled={sending}
              className="w-full px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg disabled:opacity-50 transition-colors">
              {sending ? "Sending..." : "Send Invitation"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
