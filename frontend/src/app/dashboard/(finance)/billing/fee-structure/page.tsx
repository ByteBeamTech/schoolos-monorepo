"use client";
// frontend/src/app/dashboard/(finance)/billing/fee-structure/page.tsx
//
// FDD Section 17 -- Fee Structure. FR-FEE-01: two tabs, Fee Plans and Fee
// Heads. Fee Plans is relocated here from the combined billing/page.tsx
// (Invoices + Fee Plans tabs), matching the FDD's own Information
// Architecture (Section 5): Invoices and Fee Structure are separate
// primary pages, not one page with three unrelated tabs. The Fee Plans
// tab's state, handlers, and JSX below are moved verbatim -- this is a
// relocation of already-working code, not a rewrite of its logic. Fee
// Heads (this tab) has no prior frontend at all, despite the backend
// (M9) fully supporting it -- confirmed by search before building this.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useFeePlans, useAcademicSessions, useFeeHeads, type FeeHead } from "@/lib/hooks";
import { apiClient } from "@/lib/api";
import { useToast } from "@/lib/use-toast";
import { createFeePlan } from "@/lib/billing/fee-plan-config";
import { AssignmentsTab } from "@/components/billing/FeePlanAssignments";

function fmt(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function FeeStructurePage() {
  return (
    <div>
      <PageHeader title="Fee Structure" subtitle="Fee plans, fee heads, and class/section assignments" />
      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">Fee Plans</TabsTrigger>
          <TabsTrigger value="heads">Fee Heads</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
        </TabsList>
        <TabsContent value="plans"><FeePlansTab /></TabsContent>
        <TabsContent value="heads"><FeeHeadsTab /></TabsContent>
        <TabsContent value="assignments"><AssignmentsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ── Fee Plans (relocated verbatim from billing/page.tsx) ──────────────────
function FeePlansTab() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: sessions } = useAcademicSessions();
  const currentSession = sessions?.find((s) => s.isCurrent) ?? sessions?.[0];
  const academicYear = currentSession?.name ?? "";

  const { data: feePlans, loading: pLoading } = useFeePlans(academicYear);

  const [showPlanForm, setShowPlanForm] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  // ROOT CAUSE FIX: this form previously collected fee items inline and
  // POSTed them as a `feeItems` array embedded in the plan-creation
  // body. The real, current CreateFeePlanDto (Phase 2, frozen) has no
  // such field at all -- confirmed directly against billing.dto.ts --
  // so those items were silently dropped; the plan was created with
  // none of them. Fee items are their own explicit step against an
  // existing plan (POST /billing/fee-plans/:id/fee-items, which requires
  // a real feeHeadId and billingRuleId this form never collected either)
  // -- matching the backend's own design, this form now only ever
  // creates the bare plan, then navigates to its detail page where items
  // are added one at a time with the pickers that step actually needs.
  const [planForm, setPlanForm] = useState({ name: "", grade: "", currency: "INR" });

  const createPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSession?.id) { toast.error("Select a session first"); return; }
    setSavingPlan(true);
    try {
      const plan = await createFeePlan({
        sessionId: currentSession.id,
        academicYear: academicYear || currentSession.id,
        name: planForm.name,
        grade: planForm.grade || undefined,
        currency: planForm.currency,
      });
      setShowPlanForm(false);
      setPlanForm({ name: "", grade: "", currency: "INR" });
      toast.success("Fee plan created. Add fee items on the next screen.");
      router.push(`/dashboard/billing/fee-structure/plans/${plan.id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to create fee plan");
    } finally { setSavingPlan(false); }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        {/* FDD Section 8.6 / FR-INV-04: create-new only -- no update/delete
            route exists for a Fee Plan once created (confirmed against
            fee-plans.controller.ts). This button never claims to be
            "edit" for that reason. */}
        <button onClick={() => setShowPlanForm((p) => !p)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          + New Fee Plan
        </button>
      </div>

      {showPlanForm && (
        <div className="bg-white border border-blue-100 rounded-xl p-5 mb-5 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4 text-sm">Create Fee Plan</h3>
          <p className="text-xs text-slate-400 mb-4">
            Fee items are added on the next screen, once the plan exists.
          </p>
          <form onSubmit={createPlan}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Plan Name *</label>
                <input required type="text" placeholder="e.g. Class 5 Standard"
                  value={planForm.name} onChange={(e) => setPlanForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Grade / Class</label>
                <input type="text" placeholder="e.g. Class 5"
                  value={planForm.grade} onChange={(e) => setPlanForm((p) => ({ ...p, grade: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Currency</label>
                <select value={planForm.currency} onChange={(e) => setPlanForm((p) => ({ ...p, currency: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {["INR", "USD", "GBP", "EUR"].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2 border-t border-slate-100">
              <button type="submit" disabled={savingPlan}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors">
                {savingPlan ? "Creating..." : "Create Plan"}
              </button>
              <button type="button" onClick={() => setShowPlanForm(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm rounded-lg transition-colors">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {pLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : !feePlans || feePlans.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400 text-sm">
          No fee plans yet. Create your first plan above.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {feePlans.map((plan) => {
            const items = plan.feeItems ?? [];
            const total = items.reduce((s, i) => s + Number(i.amount), 0);
            return (
              <Link
                key={plan.id}
                href={`/dashboard/billing/fee-structure/plans/${plan.id}`}
                className="text-left bg-white rounded-xl border border-slate-100 shadow-sm p-5 hover:border-blue-200 hover:shadow-md transition-all block"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-slate-900">{plan.name}</p>
                    {plan.grade && <p className="text-xs text-slate-400 mt-0.5">{plan.grade}</p>}
                  </div>
                  <span className="font-mono text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">{plan.currency}</span>
                </div>
                <div className="space-y-1.5 mb-4">
                  {items.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No fee items yet</p>
                  ) : items.map((item) => (
                    <div key={item.id} className="flex justify-between text-xs">
                      <span className="text-slate-600">{item.name}</span>
                      <span className="font-medium text-slate-900">{fmt(Number(item.amount))}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">Total: {fmt(total)}</span>
                  <Badge label={plan.isActive ? "Active" : "Inactive"} variant={plan.isActive ? "success" : "neutral"} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Fee Heads (new -- backend has existed since M9, no frontend until now) ─
const ACCOUNTING_NATURES = ["REVENUE", "LIABILITY"] as const;

function FeeHeadsTab() {
  const { toast } = useToast();
  const { data: heads, loading, refetch } = useFeeHeads();

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", accountingNature: "REVENUE", parentId: "" });

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.post("/billing/fee-heads", {
        name: form.name,
        code: form.code,
        accountingNature: form.accountingNature,
        parentId: form.parentId || undefined,
      });
      setShowForm(false);
      setForm({ name: "", code: "", accountingNature: "REVENUE", parentId: "" });
      refetch();
    } catch (err: any) {
      // FDD Section 8.6/24 item... : depth is capped at 2, enforced
      // server-side (Postgres can't express self-reference depth) -- the
      // backend's own message explains this precisely when it fires.
      toast.error(err?.response?.data?.message ?? "Failed to create fee head");
    } finally { setSaving(false); }
  };

  // FDD FR-FEE-02: accountingNature locks once referenced by an issued
  // invoice. Known, honest gap: the backend gives no proactive signal for
  // this (findAll/findById don't return a "locked" flag) -- only a 400 on
  // the update attempt itself. Adding a proactive check would mean either
  // a new backend endpoint (out of scope) or fetching all invoices to
  // cross-reference client-side (wrong at any real scale, the same
  // reasoning applied throughout this module). Implemented reactively:
  // the edit is attempted, and the backend's own precise error message is
  // what informs the user, not a UI guess made in advance.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNature, setEditNature] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const saveEdit = async (id: string) => {
    setSavingEdit(true);
    try {
      await apiClient.patch(`/billing/fee-heads/${id}`, { accountingNature: editNature });
      setEditingId(null);
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to update fee head");
    } finally { setSavingEdit(false); }
  };

  const roots = (heads ?? []).filter((h) => !h.parentId);
  const childrenOf = (id: string) => (heads ?? []).filter((h) => h.parentId === id);

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowForm((p) => !p)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          + New Fee Head
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-blue-100 rounded-xl p-5 mb-5 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4 text-sm">Create Fee Head</h3>
          <form onSubmit={create} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Name *</label>
              <input required type="text" placeholder="e.g. Transport Fees"
                value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Code *</label>
              <input required type="text" placeholder="e.g. TRANSPORT"
                value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Accounting Nature *</label>
              <select required value={form.accountingNature} onChange={(e) => setForm((p) => ({ ...p, accountingNature: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                {ACCOUNTING_NATURES.map((n) => <option key={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Parent <span className="text-slate-400">(depth capped at 2)</span>
              </label>
              <select value={form.parentId} onChange={(e) => setForm((p) => ({ ...p, parentId: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">None (top-level)</option>
                {roots.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-4 flex gap-3 pt-2 border-t border-slate-100">
              <button type="submit" disabled={saving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors">
                {saving ? "Creating..." : "Create"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm rounded-lg transition-colors">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />)}
        </div>
      ) : roots.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400 text-sm">
          No fee heads yet. Create your first one above.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm divide-y divide-slate-50">
          {roots.map((head) => (
            <div key={head.id}>
              <FeeHeadRow
                head={head}
                editingId={editingId} editNature={editNature} savingEdit={savingEdit}
                onEdit={() => { setEditingId(head.id); setEditNature(head.accountingNature); }}
                onCancelEdit={() => setEditingId(null)}
                onChangeNature={setEditNature}
                onSave={() => saveEdit(head.id)}
              />
              {childrenOf(head.id).map((child) => (
                <div key={child.id} className="pl-8 border-t border-slate-50">
                  <FeeHeadRow
                    head={child}
                    editingId={editingId} editNature={editNature} savingEdit={savingEdit}
                    onEdit={() => { setEditingId(child.id); setEditNature(child.accountingNature); }}
                    onCancelEdit={() => setEditingId(null)}
                    onChangeNature={setEditNature}
                    onSave={() => saveEdit(child.id)}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FeeHeadRow({
  head, editingId, editNature, savingEdit, onEdit, onCancelEdit, onChangeNature, onSave,
}: {
  head: FeeHead; editingId: string | null; editNature: string; savingEdit: boolean;
  onEdit: () => void; onCancelEdit: () => void; onChangeNature: (v: string) => void; onSave: () => void;
}) {
  const isEditing = editingId === head.id;
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <div>
        <p className="text-sm font-medium text-slate-900">{head.name}</p>
        <p className="text-xs text-slate-400 font-mono">{head.code}</p>
      </div>
      <div className="flex items-center gap-3">
        {isEditing ? (
          <>
            <select value={editNature} onChange={(e) => onChangeNature(e.target.value)}
              className="px-2 py-1 text-xs border border-slate-200 rounded-lg">
              {ACCOUNTING_NATURES.map((n) => <option key={n}>{n}</option>)}
            </select>
            <button onClick={onSave} disabled={savingEdit} className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50">
              {savingEdit ? "Saving…" : "Save"}
            </button>
            <button onClick={onCancelEdit} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
          </>
        ) : (
          <>
            <Badge label={head.accountingNature} variant={head.accountingNature === "REVENUE" ? "info" : "neutral"} />
            <Badge label={head.isActive ? "Active" : "Inactive"} variant={head.isActive ? "success" : "neutral"} />
            <button onClick={onEdit} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Edit</button>
          </>
        )}
      </div>
    </div>
  );
}
