"use client";
// frontend/src/app/dashboard/(finance)/billing/late-fee/page.tsx
//
// Late Fee Module FDD v2 (docs/product/LATE_FEE_FDD.md) Sections 6.1-6.5 /
// Implementation Roadmap v2 Sprint 4. Rebuilt against the real,
// smoke-tested endpoints Sprints 1-3 built -- closes every concrete
// finding from the original audit: the Rules tab previously called three
// endpoints that never existed; the Waive tab's one action had a wrong
// URL, a wrong ID, and a missing required field.

import { useState } from "react";
import { Clock, Plus, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useApi, useBranches, useFeePlans } from "@/lib/hooks";
import { apiClient } from "@/lib/api";
import { useToast } from "@/lib/use-toast";
import { previewLateFeeRule, type LateFeeRule, type LateFeeWaiver, type LateFeeCalculationMethod, type LateFeePenaltyType } from "@/lib/billing/late-fee-rule";

function fmt(n: number | string) {
  return `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
function fmtDateTime(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function scopeLabel(rule: LateFeeRule, branchName?: string, feePlanName?: string): string {
  if (rule.feePlanId) return `Fee Plan: ${feePlanName ?? rule.feePlanId}`;
  if (rule.branchId) return `Branch: ${branchName ?? rule.branchId}`;
  return "Tenant-wide (default)";
}

function calcSummary(rule: LateFeeRule): string {
  const penalty = rule.penaltyType === "PERCENTAGE" ? `${rule.penaltyValue}% monthly` : `${fmt(rule.penaltyValue)} flat`;
  const cap = rule.maxPenalty ? `, capped at ${fmt(rule.maxPenalty)}` : "";
  return `${penalty}, ${rule.gracePeriodDays}-day grace${cap}`;
}

const emptyForm = () => ({
  branchId: "", feePlanId: "",
  calculationMethod: "PERCENTAGE" as LateFeeCalculationMethod,
  penaltyType: "PERCENTAGE" as LateFeePenaltyType,
  penaltyValue: "2", gracePeriodDays: "7", maxPenalty: "500", compoundDaily: false,
});

export default function LateFeesPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"rules" | "waive">("rules");

  const { data: rules, loading: rulesLoading, refetch: refetchRules } = useApi<LateFeeRule[]>("/billing/late-fees/rules", []);
  const { data: overdueInvoices, loading: invLoading, refetch: refetchInv } = useApi<any[]>("/billing/invoices/overdue", []);
  const { data: fallbackFees } = useApi<any[]>("/billing/late-fees?usedFallbackConfig=true", []);
  const { data: branches } = useBranches();
  const { data: feePlansAll } = useFeePlans();

  const ruleList = Array.isArray(rules) ? rules : [];
  const overdueList = Array.isArray(overdueInvoices) ? overdueInvoices : [];
  const fallbackList = Array.isArray(fallbackFees) ? fallbackFees : [];

  const branchName = (id: string | null) => branches?.find((b) => b.id === id)?.name;
  const feePlanName = (id: string | null) => (feePlansAll as any[])?.find((p) => p.id === id)?.name;

  return (
    <div>
      <PageHeader title="Late Fees" subtitle="Configure rules and waive late fees" />

      {/* FDD Section 2.3: admin fallback banner -- visible regardless of
          tab, since it's an actionable alert, not a Rules-tab-only detail. */}
      {fallbackList.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 mb-6 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            {fallbackList.length} late fee{fallbackList.length === 1 ? " was" : "s were"} assessed using the
            system default because no rule was configured for that tenant/branch/fee-plan. Configure a rule below
            to stop this from happening going forward.
          </span>
        </div>
      )}

      <div className="flex border-b border-slate-200 mb-6">
        {([
          { key: "rules", label: "Late Fee Rules" },
          { key: "waive", label: `Waive Late Fees${overdueList.filter((i) => i.lateFees?.length > 0).length > 0 ? ` (${overdueList.filter((i) => i.lateFees?.length > 0).length})` : ""}` },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key ? "text-blue-600 border-blue-600" : "text-slate-500 border-transparent hover:text-slate-700"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "rules" && (
        <RulesTab
          rules={ruleList} loading={rulesLoading} refetch={refetchRules}
          branches={branches ?? []} feePlans={(feePlansAll as any[]) ?? []}
          branchName={branchName} feePlanName={feePlanName}
        />
      )}
      {tab === "waive" && (
        <WaiveTab overdueList={overdueList} loading={invLoading} refetch={refetchInv} />
      )}
    </div>
  );
}

// ── Rules tab ────────────────────────────────────────────────────────────
function RulesTab({
  rules, loading, refetch, branches, feePlans, branchName, feePlanName,
}: {
  rules: LateFeeRule[]; loading: boolean; refetch: () => void;
  branches: { id: string; name: string }[]; feePlans: { id: string; name: string }[];
  branchName: (id: string | null) => string | undefined; feePlanName: (id: string | null) => string | undefined;
}) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const v = e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value;
    setForm((p) => ({ ...p, [k]: v }));
    setPreview(null);
  };

  // FDD Section 6.2: live preview, calling the real backend endpoint --
  // no calculation logic in this component at all.
  const runPreview = async () => {
    if (!form.penaltyValue || !form.gracePeriodDays) return;
    setPreviewing(true);
    try {
      const result = await previewLateFeeRule({
        penaltyType: form.penaltyType, penaltyValue: parseFloat(form.penaltyValue),
        gracePeriodDays: parseInt(form.gracePeriodDays),
        maxPenalty: form.maxPenalty ? parseFloat(form.maxPenalty) : undefined,
        compoundDaily: form.compoundDaily,
        dueAmount: 5000, daysOverdue: 20,
      });
      setPreview(result.lateFee);
    } catch {
      setPreview(null);
    } finally { setPreviewing(false); }
  };

  const createRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.post("/billing/late-fees/rules", {
        branchId: form.branchId || undefined,
        feePlanId: form.feePlanId || undefined,
        calculationMethod: form.calculationMethod,
        penaltyType: form.penaltyType,
        penaltyValue: parseFloat(form.penaltyValue),
        gracePeriodDays: parseInt(form.gracePeriodDays),
        maxPenalty: form.maxPenalty ? parseFloat(form.maxPenalty) : undefined,
        compoundDaily: form.compoundDaily,
      });
      setShowForm(false);
      setForm(emptyForm());
      setPreview(null);
      refetch();
      toast.success("Late fee rule created");
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to create rule");
    } finally { setSaving(false); }
  };

  // FDD Section 6.2 / DeactivateLateFeeRuleDto: no calculation fields
  // sent, ever -- matches the DTO's own shape, which structurally cannot
  // carry one.
  const deactivate = async (ruleId: string) => {
    try {
      await apiClient.patch(`/billing/late-fees/rules/${ruleId}`, {});
      refetch();
      toast.success("Rule deactivated");
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to deactivate rule");
    }
  };

  // FDD Section 6.1: grouped by scope level, Tenant default first.
  const tenantRules = rules.filter((r) => !r.branchId && !r.feePlanId);
  const branchRules = rules.filter((r) => r.branchId && !r.feePlanId);
  const planRules = rules.filter((r) => r.feePlanId);

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowForm((p) => !p)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors">
          <Plus className="w-4 h-4" /> New Rule
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">New Late Fee Rule</h3>
          <form onSubmit={createRule}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Branch (optional)</label>
                <select value={form.branchId} onChange={(e) => { f("branchId")(e); setForm((p) => ({ ...p, feePlanId: "" })); }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">None (tenant-wide)</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Fee Plan (optional) <span className="text-slate-400">requires Branch</span>
                </label>
                <select value={form.feePlanId} onChange={f("feePlanId")} disabled={!form.branchId}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400">
                  <option value="">None (branch-wide)</option>
                  {feePlans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Calculation Method</label>
                <select value={form.calculationMethod} onChange={f("calculationMethod")}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="FLAT">Flat Amount</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Grace Period (days) *</label>
                <input required type="number" min="0" value={form.gracePeriodDays} onChange={f("gracePeriodDays")}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Penalty Value * {form.penaltyType === "PERCENTAGE" ? "(% monthly)" : "(₹)"}
                </label>
                <input required type="number" min="0" step="0.01" value={form.penaltyValue} onChange={f("penaltyValue")}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Max Penalty (₹, optional)</label>
                <input type="number" min="0" step="0.01" placeholder="No cap" value={form.maxPenalty} onChange={f("maxPenalty")}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-600 mb-4">
              <input type="checkbox" checked={form.compoundDaily} onChange={f("compoundDaily")} />
              Compound daily (instead of a flat monthly step)
            </label>

            {/* Live preview -- FDD 6.2, calls the real backend endpoint */}
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 mb-4 text-sm flex items-center justify-between">
              <span className="text-slate-500">
                Preview: an invoice due ₹5,000, 20 days overdue, under this rule, would owe
              </span>
              <div className="flex items-center gap-2">
                {preview !== null && <span className="font-semibold text-slate-900">{fmt(preview)}</span>}
                <button type="button" onClick={runPreview} disabled={previewing}
                  className="text-xs text-blue-600 hover:underline disabled:opacity-50">
                  {previewing ? "Calculating…" : "Preview"}
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors">
                {saving ? "Creating..." : "Create Rule"}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setForm(emptyForm()); setPreview(null); }}
                className="px-4 py-2 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : rules.length === 0 ? (
        <EmptyState title="No late fee rules" message="Create a rule to automatically apply late fees to overdue invoices." icon={<Clock className="w-10 h-10" />} />
      ) : (
        <div className="space-y-4">
          {[
            { label: "Tenant Default", rows: tenantRules },
            { label: "Branch Rules", rows: branchRules },
            { label: "Fee Plan Rules", rows: planRules },
          ].filter((g) => g.rows.length > 0).map((group) => (
            <div key={group.label}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{group.label}</p>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {group.rows.map((rule, i) => (
                  <div key={rule.id} className={`flex items-center justify-between p-5 ${i > 0 ? "border-t border-slate-100" : ""} ${!rule.isActive ? "opacity-50" : ""}`}>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-slate-800">{calcSummary(rule)}</p>
                        <Badge label={rule.isActive ? "Active" : "Superseded"} variant={rule.isActive ? "success" : "neutral"} />
                      </div>
                      <p className="text-xs text-slate-400">{scopeLabel(rule, branchName(rule.branchId), feePlanName(rule.feePlanId))}</p>
                    </div>
                    {rule.isActive && (
                      <button onClick={() => deactivate(rule.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors">
                        Deactivate
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Waive tab ────────────────────────────────────────────────────────────
function WaiveTab({ overdueList, loading, refetch }: { overdueList: any[]; loading: boolean; refetch: () => void }) {
  const { toast } = useToast();
  const [waivedIds, setWaivedIds] = useState<Set<string>>(new Set());
  const [waivingFor, setWaivingFor] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

  const invoicesWithLF = overdueList.filter((i: any) => i.lateFees?.length > 0 && !waivedIds.has(i.lateFees[0].id));

  const startWaive = (lateFeeId: string, outstanding: number) => {
    setWaivingFor(lateFeeId);
    setAmount(String(outstanding));
    setReason("");
  };

  // FDD Section 6.5 / the original audit's three concrete findings, fixed:
  // correct URL shape (:id/waive, not waive/:invoiceId), correct ID (the
  // LateFee's own id, not the invoice's), and the required amount field
  // actually sent.
  const submitWaive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waivingFor || !reason.trim()) return;
    setSaving(true);
    try {
      await apiClient.patch(`/billing/late-fees/${waivingFor}/waive`, {
        amount: parseFloat(amount), reason: reason.trim(),
      });
      setWaivedIds((prev) => new Set([...prev, waivingFor]));
      setWaivingFor(null);
      refetch();
      toast.success("Late fee waived");
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to waive");
    } finally { setSaving(false); }
  };

  return (
    <>
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : invoicesWithLF.length === 0 ? (
        <EmptyState title="No late fees to waive" message="No overdue invoices currently have late fees applied." icon={<CheckCircle2 className="w-10 h-10" />} />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {invoicesWithLF.map((inv: any, i: number) => {
            const lateFee = inv.lateFees[0];
            const outstanding = Number(lateFee.amount) - Number(lateFee.amountWaived ?? 0) - Number(lateFee.paidAmount ?? 0);
            return (
              <div key={inv.id} className={i > 0 ? "border-t border-slate-100" : ""}>
                <div className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {inv.student?.firstName} {inv.student?.lastName}
                      <span className="font-mono text-xs text-slate-400 ml-2">{inv.invoiceNumber}</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Principal: {fmt(inv.dueAmount)} · <span className="text-red-500 font-medium">Late fee outstanding: {fmt(outstanding)}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setExpandedHistory((p) => (p === lateFee.id ? null : lateFee.id))}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
                      {expandedHistory === lateFee.id ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      History
                    </button>
                    <button onClick={() => startWaive(lateFee.id, outstanding)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg font-medium transition-colors">
                      <XCircle className="w-3.5 h-3.5" /> Waive
                    </button>
                  </div>
                </div>

                {waivingFor === lateFee.id && (
                  <form onSubmit={submitWaive} className="px-5 pb-5 flex gap-3 items-end">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Amount</label>
                      <input required type="number" min="0.01" max={outstanding} step="0.01" value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-32 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Reason *</label>
                      <input required type="text" value={reason} onChange={(e) => setReason(e.target.value)}
                        placeholder="Required -- explain why this is being waived"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <button type="submit" disabled={saving}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-lg font-medium disabled:opacity-50">
                      {saving ? "Waiving…" : "Confirm Waive"}
                    </button>
                    <button type="button" onClick={() => setWaivingFor(null)}
                      className="px-3 py-2 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200">
                      Cancel
                    </button>
                  </form>
                )}

                {expandedHistory === lateFee.id && <WaiverHistory lateFeeId={lateFee.id} />}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// FDD Section 1.4/6.5: the audit-trail history Sprint 1 built, now
// actually visible -- one row per waiver event, not a summary that could
// silently overwrite a previous waiver's attribution.
function WaiverHistory({ lateFeeId }: { lateFeeId: string }) {
  const { data: waivers, loading } = useApi<LateFeeWaiver[]>(`/billing/late-fees/${lateFeeId}/waivers`, [lateFeeId]);
  const list = Array.isArray(waivers) ? waivers : [];

  return (
    <div className="px-5 pb-5 bg-slate-50 -mt-1">
      {loading ? (
        <p className="text-xs text-slate-400 py-3">Loading history…</p>
      ) : list.length === 0 ? (
        <p className="text-xs text-slate-400 py-3">No waivers recorded for this fee yet.</p>
      ) : (
        <div className="divide-y divide-slate-200">
          {list.map((w) => (
            <div key={w.id} className="py-2.5 text-xs flex items-center justify-between">
              <div>
                <span className="font-medium text-slate-700">{fmt(w.amount)}</span>
                <span className="text-slate-400 ml-2">{w.reason}</span>
              </div>
              <span className="text-slate-400">{fmtDateTime(w.waivedAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
