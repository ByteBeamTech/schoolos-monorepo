"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useApi } from "@/lib/hooks";
import { apiClient } from "@/lib/api";
import { Building2, Plus, Trash2, Phone, Mail, MapPin, User, KeyRound } from "lucide-react";

export default function BranchesPage() {
  const { data, loading, refetch } = useApi<any[]>("/school-management/branches");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    principal: "",
    phone: "",
    email: "",
    city: "",
    address: "",
    licenseKey: "",
  });

  const f = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await apiClient.post("/school-management/branches", form);
      const result = response.data;
      setShow(false);
      setForm({
        name: "",
        code: "",
        principal: "",
        phone: "",
        email: "",
        city: "",
        address: "",
        licenseKey: "",
      });
      refetch();
      if (result?.message) alert(result.message);
    } catch (err: any) {
      alert(err?.response?.data?.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Deactivate this branch?")) return;
    await apiClient.delete(`/school-management/branches/${id}`);
    refetch();
  };

  const branches = Array.isArray(data) ? data : [];

  return (
    <div>
      <PageHeader
        title="Branches"
        subtitle="Manage your school's branches and campuses"
        action={
          <button
            onClick={() => setShow((prev) => !prev)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            {show ? "Cancel" : "Add Branch"}
          </button>
        }
      />

      {show && (
        <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-6 mb-6">
          <h3 className="font-semibold text-slate-900 mb-2">New Branch</h3>
          <p className="text-sm text-slate-500 mb-4">
            A valid license key activates the branch. If the key is missing or invalid, the branch is saved as a draft.
          </p>
          <form onSubmit={create}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              {[
                { key: "name", label: "Branch Name *", required: true },
                { key: "code", label: "Branch Code", required: false },
                { key: "principal", label: "Principal", required: false },
                { key: "phone", label: "Phone", required: false },
                { key: "email", label: "Email", required: false },
                { key: "city", label: "City", required: false },
              ].map(({ key, label, required }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>
                  <input
                    type="text"
                    required={required}
                    value={(form as any)[key]}
                    onChange={f(key)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">License Key</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={form.licenseKey}
                    onChange={f("licenseKey")}
                    placeholder="Required to activate this branch"
                    className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Address</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={f("address")}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2 border-t border-slate-100">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {saving && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {saving ? "Creating..." : "Create Branch"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-48 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : branches.length === 0 ? (
        <EmptyState title="No branches yet" message="Add your first branch or campus." icon={<Building2 className="w-10 h-10" />} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map((branch: any) => (
            <div key={branch.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{branch.name}</h3>
                    {branch.code && <p className="text-xs font-mono text-slate-400">{branch.code}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    label={branch.status ?? (branch.isActive ? "ACTIVE" : "INACTIVE")}
                    variant={branch.status === "DRAFT" ? "warning" : branch.isActive ? "success" : "neutral"}
                  />
                  <button onClick={() => remove(branch.id)} className="p-1.5 text-slate-300 hover:text-red-500 rounded transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 text-sm">
                {branch.principal && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    {branch.principal}
                  </div>
                )}
                {branch.phone && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {branch.phone}
                  </div>
                )}
                {branch.email && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {branch.email}
                  </div>
                )}
                {branch.city && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {branch.city}{branch.address ? ` - ${branch.address}` : ""}
                  </div>
                )}
                {branch.draftReason && (
                  <div className="mt-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-800">
                    {branch.draftReason}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
