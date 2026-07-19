"use client";
import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { useApi } from "@/lib/hooks";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { formatDate, formatRelative } from "@/lib/utils";
import {
  UserCog, Plus, Search, MoreVertical, KeyRound, Ban, CheckCircle2,
  Trash2, ShieldAlert, X,
} from "lucide-react";

// Administration > Users (Phase 1 of the Administration/Settings split).
// Manages SchoolOS's own platform staff (SUPER_ADMIN / SAAS_OWNER /
// ACCOUNT_MANAGER) -- distinct from All Schools' tenant/school users.
// Deliberately scoped to these 3 fixed enum roles only; custom/dynamic
// roles are an explicitly deferred Phase 3 (see the Administration
// planning conversation this came from).

const ROLES = ["SUPER_ADMIN", "SAAS_OWNER", "ACCOUNT_MANAGER"] as const;
const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin", SAAS_OWNER: "SaaS Owner", ACCOUNT_MANAGER: "Account Manager",
};
const ROLE_COLOR: Record<string, any> = {
  SUPER_ADMIN: "error", SAAS_OWNER: "warning", ACCOUNT_MANAGER: "info",
};

interface PlatformUser {
  id: string; email: string; firstName: string; lastName: string; role: string;
  isActive: boolean; isDeleted: boolean; lastLoginAt: string | null; createdAt: string;
}

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const [tempPasswordModal, setTempPasswordModal] = useState<{ email: string; password: string } | null>(null);

  const url = `/superadmin/platform-users?search=${encodeURIComponent(search)}&role=${roleFilter}&status=${statusFilter}`;
  const { data: users, loading, refetch } = useApi<PlatformUser[]>(url, [search, roleFilter, statusFilter]);
  const list = Array.isArray(users) ? users : [];

  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", role: "ACCOUNT_MANAGER" });
  const [creating, setCreating] = useState(false);

  const createUser = async () => {
    if (!form.email || !form.firstName || !form.lastName) {
      toast({ description: "Email, first name, and last name are required.", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const res: any = await api.post("/superadmin/platform-users", form);
      setShowCreate(false);
      setForm({ email: "", firstName: "", lastName: "", role: "ACCOUNT_MANAGER" });
      refetch();
      setTempPasswordModal({ email: res.user.email, password: res.tempPassword });
    } catch (e: any) {
      toast({ description: e.message || "Failed to create user.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const toggleStatus = async (u: PlatformUser) => {
    try {
      await api.patch(`/superadmin/platform-users/${u.id}/status`, { isActive: !u.isActive });
      toast({ description: `${u.firstName} ${u.isActive ? "disabled" : "enabled"}.` });
      refetch();
    } catch (e: any) {
      toast({ description: e.message || "Failed to update status.", variant: "destructive" });
    }
    setMenuOpenFor(null);
  };

  const resetPassword = async (u: PlatformUser) => {
    try {
      const res: any = await api.post(`/superadmin/platform-users/${u.id}/reset-password`, {});
      setTempPasswordModal({ email: u.email, password: res.tempPassword });
      refetch();
    } catch (e: any) {
      toast({ description: e.message || "Failed to reset password.", variant: "destructive" });
    }
    setMenuOpenFor(null);
  };

  const forcePasswordChange = async (u: PlatformUser) => {
    try {
      await api.patch(`/superadmin/platform-users/${u.id}/force-password-change`, {});
      toast({ description: `${u.firstName} will be asked to change their password at next login.` });
    } catch (e: any) {
      toast({ description: e.message || "Failed to set force-password-change.", variant: "destructive" });
    }
    setMenuOpenFor(null);
  };

  const revokeSessions = async (u: PlatformUser) => {
    try {
      await api.post(`/superadmin/platform-users/${u.id}/revoke-sessions`, {});
      toast({ description: `All sessions revoked for ${u.firstName}.` });
    } catch (e: any) {
      toast({ description: e.message || "Failed to revoke sessions.", variant: "destructive" });
    }
    setMenuOpenFor(null);
  };

  const deleteUser = async (u: PlatformUser) => {
    if (!confirm(`Delete ${u.firstName} ${u.lastName}? This is a soft delete -- the account can be restored from the database if needed, but will disappear from this list.`)) return;
    try {
      await api.delete(`/superadmin/platform-users/${u.id}`);
      toast({ description: `${u.firstName} deleted.` });
      refetch();
    } catch (e: any) {
      toast({ description: e.message || "Failed to delete user.", variant: "destructive" });
    }
    setMenuOpenFor(null);
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <PageHeader title="Platform Users" subtitle="Manage SchoolOS's own platform staff -- not school/tenant users" />
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Create User
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email..."
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 text-slate-200 text-sm rounded-lg focus:outline-none focus:border-orange-500" />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="px-3 py-2 bg-slate-900 border border-slate-800 text-slate-300 text-sm rounded-lg focus:outline-none">
          <option value="">All roles</option>
          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-slate-900 border border-slate-800 text-slate-300 text-sm rounded-lg focus:outline-none">
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="DISABLED">Disabled</option>
          <option value="DELETED">Deleted</option>
        </select>
      </div>

      {/* List */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-slate-800 rounded animate-pulse" />)}</div>
        ) : list.length === 0 ? (
          <div className="p-16 text-center">
            <UserCog className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No platform users found.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">User</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Role</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Last Login</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {list.map(u => (
                <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="text-slate-200 font-medium">{u.firstName} {u.lastName}</p>
                    <p className="text-slate-500 text-xs">{u.email}</p>
                  </td>
                  <td className="px-5 py-3.5"><Badge label={ROLE_LABEL[u.role] ?? u.role} variant={ROLE_COLOR[u.role] ?? "neutral"} /></td>
                  <td className="px-5 py-3.5">
                    {u.isDeleted ? <Badge label="Deleted" variant="neutral" />
                      : u.isActive ? <Badge label="Active" variant="success" />
                      : <Badge label="Disabled" variant="error" />}
                  </td>
                  <td className="px-5 py-3.5 text-slate-400 text-xs">
                    {u.lastLoginAt ? formatRelative(u.lastLoginAt) : "Never"}
                  </td>
                  <td className="px-5 py-3.5 relative">
                    <button onClick={() => setMenuOpenFor(menuOpenFor === u.id ? null : u.id)}
                      className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-200">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {menuOpenFor === u.id && (
                      <div className="absolute right-5 top-10 z-10 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 w-56">
                        {!u.isDeleted && (
                          <>
                            <button onClick={() => toggleStatus(u)} className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2">
                              {u.isActive ? <><Ban className="w-3.5 h-3.5" /> Disable</> : <><CheckCircle2 className="w-3.5 h-3.5" /> Enable</>}
                            </button>
                            <button onClick={() => resetPassword(u)} className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2">
                              <KeyRound className="w-3.5 h-3.5" /> Reset Password
                            </button>
                            <button onClick={() => forcePasswordChange(u)} className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2">
                              <ShieldAlert className="w-3.5 h-3.5" /> Force Password Change
                            </button>
                            <button onClick={() => revokeSessions(u)} className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2">
                              <X className="w-3.5 h-3.5" /> Revoke All Sessions
                            </button>
                            <div className="border-t border-slate-700 my-1" />
                            <button onClick={() => deleteUser(u)} className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-slate-700 flex items-center gap-2">
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-xs uppercase font-mono font-black tracking-widest text-slate-400">Create Platform User</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-200"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="Email"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:outline-none focus:border-orange-500" />
              <div className="grid grid-cols-2 gap-2">
                <input value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} placeholder="First name"
                  className="px-3 py-2 bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:outline-none focus:border-orange-500" />
                <input value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} placeholder="Last name"
                  className="px-3 py-2 bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:outline-none focus:border-orange-500" />
              </div>
              <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:outline-none">
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
              <p className="text-[11px] text-slate-500">A temporary password will be generated and shown once -- the user will be required to change it at first login.</p>
            </div>
            <button onClick={createUser} disabled={creating}
              className="w-full px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg disabled:opacity-50 transition-colors">
              {creating ? "Creating..." : "Create User"}
            </button>
          </div>
        </div>
      )}

      {/* Temp password modal -- shown once, not retrievable after */}
      {tempPasswordModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-orange-500/40 rounded-2xl p-5 w-full max-w-sm space-y-4 shadow-2xl">
            <h3 className="text-xs uppercase font-mono font-black tracking-widest text-orange-400">Temporary Password</h3>
            <p className="text-xs text-slate-400">For <span className="text-slate-200">{tempPasswordModal.email}</span>. This is shown only once -- copy it now.</p>
            <div className="bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 font-mono text-orange-300 text-sm select-all">
              {tempPasswordModal.password}
            </div>
            <button onClick={() => setTempPasswordModal(null)}
              className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
