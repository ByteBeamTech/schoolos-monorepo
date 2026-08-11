"use client";
// frontend/src/app/dashboard/(finance)/billing/fee-structure/plans/[id]/page.tsx
//
// New: the Fee Plan detail/configuration view the audit found entirely
// missing -- the plan grid on Fee Structure had no click-through at
// all. Built against the real, current backend contract throughout:
// GET /billing/fee-plans/:id (feeItems + bare assignments, confirmed
// directly against fee-plans.service.ts's findById()), POST .../fee-items,
// PATCH .../fee-items/:id/supersede. FeeHead and BillingRule names are
// joined client-side against separately-fetched lists purely for
// display -- feeItems only carries feeHeadId/billingRuleId, not nested
// names (confirmed) -- this is a UI-layer lookup, not fee-plan
// resolution logic, which stays entirely server-side.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useFeePlan, useBranches, useFeeHeads, type FeeItem, type FeeHead as FeeHeadType } from "@/lib/hooks";
import { useToast } from "@/lib/use-toast";
import {
  useBillingRules, billingRuleLabel, createFeeItem, supersedeFeeItem,
  type BillingRule,
} from "@/lib/billing/fee-plan-config";

function fmt(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function FeePlanDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { toast } = useToast();

  const { data: plan, loading, error, refetch } = useFeePlan(id);
  const { data: feeHeads } = useFeeHeads();
  const { data: billingRules } = useBillingRules();
  const { data: branches } = useBranches();

  const [showAddItem, setShowAddItem] = useState(false);
  const [supersedingId, setSupersedingId] = useState<string | null>(null);

  const feeHeadName = (id?: string | null) => feeHeads?.find((h) => h.id === id)?.name ?? "—";
  const billingRuleById = (id?: string | null) => billingRules?.find((r) => r.id === id);
  const branchName = (id?: string) => branches?.find((b) => b.id === id)?.name ?? id ?? "—";

  if (loading) {
    return (
      <div>
        <PageHeader title="Fee Plan" subtitle="Loading…" />
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div>
        <PageHeader title="Fee Plan" />
        <EmptyState title="Fee plan not found" message={error ?? "This plan may have been removed."} />
      </div>
    );
  }

  const items = plan.feeItems ?? [];

  return (
    <div>
      <button
        onClick={() => router.push("/dashboard/billing/fee-structure")}
        className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 text-sm mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Fee Structure
      </button>

      <PageHeader
        title={plan.name}
        subtitle={`${plan.academicYear} · ${branchName(plan.branchId)}`}
        showBack={false}
        action={<Badge label={plan.isActive ? "Active" : "Inactive"} variant={plan.isActive ? "success" : "neutral"} />}
      />

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Fee Items</h3>
          <button
            onClick={() => setShowAddItem((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Fee Item
          </button>
        </div>

        {showAddItem && (
          <AddFeeItemForm
            feePlanId={plan.id}
            feeHeads={feeHeads ?? []}
            billingRules={billingRules ?? []}
            onDone={() => { setShowAddItem(false); refetch(); }}
            onCancel={() => setShowAddItem(false)}
          />
        )}

        {items.length === 0 ? (
          <EmptyState title="No fee items yet" message="Add the first fee item using the button above." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                <th className="px-5 py-2.5">Fee Head</th>
                <th className="px-5 py-2.5">Billing Rule</th>
                <th className="px-5 py-2.5 text-right">Amount</th>
                <th className="px-5 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <FeeItemRow
                  key={item.id}
                  item={item}
                  planId={plan.id}
                  feeHeadLabel={feeHeadName(item.feeHeadId)}
                  billingRuleLabel={billingRuleLabel(billingRuleById(item.billingRuleId))}
                  billingRules={billingRules ?? []}
                  isSuperseding={supersedingId === item.id}
                  onStartSupersede={() => setSupersedingId(item.id)}
                  onCancelSupersede={() => setSupersedingId(null)}
                  onDone={() => { setSupersedingId(null); refetch(); }}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Add Fee Item form ────────────────────────────────────────────────────
function AddFeeItemForm({
  feePlanId, feeHeads, billingRules, onDone, onCancel,
}: {
  feePlanId: string; feeHeads: FeeHeadType[]; billingRules: BillingRule[];
  onDone: () => void; onCancel: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [feeHeadId, setFeeHeadId] = useState("");
  const [billingRuleId, setBillingRuleId] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feeHeadId || !billingRuleId) { toast.error("Select a Fee Head and Billing Rule"); return; }
    setSaving(true);
    try {
      await createFeeItem(feePlanId, { name, amount: parseFloat(amount), feeHeadId, billingRuleId });
      toast.success("Fee item added.");
      setName(""); setAmount(""); setFeeHeadId(""); setBillingRuleId("");
      onDone();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to add fee item");
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="px-5 py-4 border-b border-slate-100 bg-slate-50 grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Name *</label>
        <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tuition Fee"
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Fee Head *</label>
        <select required value={feeHeadId} onChange={(e) => setFeeHeadId(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Select…</option>
          {feeHeads.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Billing Rule *</label>
        <select required value={billingRuleId} onChange={(e) => setBillingRuleId(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Select…</option>
          {billingRules.map((r) => <option key={r.id} value={r.id}>{billingRuleLabel(r)}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Amount *</label>
        <input required type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={saving}
          className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium disabled:opacity-50">
          {saving ? "Adding…" : "Add"}
        </button>
        <button type="button" onClick={onCancel}
          className="px-3 py-2 bg-white border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Fee item row + inline supersede ──────────────────────────────────────
function FeeItemRow({
  item, planId, feeHeadLabel, billingRuleLabel: ruleLabel, billingRules,
  isSuperseding, onStartSupersede, onCancelSupersede, onDone,
}: {
  item: FeeItem; planId: string; feeHeadLabel: string; billingRuleLabel: string; billingRules: BillingRule[];
  isSuperseding: boolean; onStartSupersede: () => void; onCancelSupersede: () => void; onDone: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(item.name);
  const [amount, setAmount] = useState(String(item.amount));
  const [billingRuleId, setBillingRuleId] = useState(item.billingRuleId ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!item.feeHeadId || !billingRuleId) { toast.error("A Fee Head and Billing Rule are required"); return; }
    setSaving(true);
    try {
      await supersedeFeeItem(item.id, {
        name, amount: parseFloat(amount), feeHeadId: item.feeHeadId, billingRuleId,
      });
      toast.success("Fee item superseded.");
      onDone();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to supersede fee item");
    } finally { setSaving(false); }
  };

  if (isSuperseding) {
    return (
      <tr className="border-b border-slate-50 bg-amber-50">
        <td className="px-5 py-3">
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full px-2 py-1 text-sm border border-slate-200 rounded" />
          <p className="text-[11px] text-slate-400 mt-1">Fee Head: {feeHeadLabel} (fixed — supersede can't change the head)</p>
        </td>
        <td className="px-5 py-3">
          <select value={billingRuleId} onChange={(e) => setBillingRuleId(e.target.value)}
            className="w-full px-2 py-1 text-sm border border-slate-200 rounded">
            {billingRules.map((r) => <option key={r.id} value={r.id}>{billingRuleLabel(r)}</option>)}
          </select>
        </td>
        <td className="px-5 py-3 text-right">
          <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
            className="w-28 px-2 py-1 text-sm border border-slate-200 rounded text-right" />
        </td>
        <td className="px-5 py-3 text-right whitespace-nowrap">
          <button onClick={submit} disabled={saving} className="text-xs text-blue-600 hover:text-blue-800 font-medium mr-3 disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={onCancelSupersede} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-slate-50">
      <td className="px-5 py-3 text-slate-700">{item.name} <span className="text-slate-400">({feeHeadLabel})</span></td>
      <td className="px-5 py-3 text-slate-500">{ruleLabel}</td>
      <td className="px-5 py-3 text-right font-medium text-slate-800">{fmt(Number(item.amount))}</td>
      <td className="px-5 py-3 text-right">
        <button onClick={onStartSupersede} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium ml-auto">
          <RotateCcw className="w-3 h-3" /> Supersede
        </button>
      </td>
    </tr>
  );
}
