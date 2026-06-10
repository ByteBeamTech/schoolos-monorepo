"use client";
// frontend/src/app/dashboard/(finance)/billing/late-fees/page.tsx
// Late fee rules list, create rule, waive late fee on invoice

import { useState }   from "react";
import {
  Clock, Plus, AlertTriangle,
  CheckCircle2, XCircle, RefreshCw,
} from "lucide-react";
import { PageHeader }  from "@/components/ui/page-header";
import { Badge }       from "@/components/ui/badge";
import { EmptyState }  from "@/components/ui/empty-state";
import { useApi }      from "@/lib/hooks";
import { apiClient }   from "@/lib/api";
import { useToast }    from "@/lib/use-toast";

function fmt(n: number | string) {
  return `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const emptyRule = () => ({
  gracePeriodDays: "5",
  penaltyType:     "PERCENTAGE",
  penaltyValue:    "2",
  maxPenalty:      "",
  frequency:       "MONTHLY",
  description:     "",
});

export default function LateFeesPage() {
  const { toast } = useToast();

  const { data: lateFees, loading: lfLoading, refetch: refetchLF } =
    useApi<any[]>("/billing/late-fees");

  const { data: overdueInvoices, loading: invLoading, refetch: refetchInv } =
    useApi<any[]>("/billing/invoices/overdue");

  const lateList     = Array.isArray(lateFees)       ? lateFees       : [];
  const overdueList  = Array.isArray(overdueInvoices) ? overdueInvoices : [];

  const [tab, setTab]           = useState<"rules" | "waive">("rules");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(emptyRule());
  const [saving, setSaving]     = useState(false);
  const [waivedIds, setWaivedIds] = useState<Set<string>>(new Set());

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const createRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.post("/billing/late-fees/rules", {
        gracePeriodDays: parseInt(form.gracePeriodDays),
        penaltyType:     form.penaltyType,
        penaltyValue:    parseFloat(form.penaltyValue),
        maxPenalty:      form.maxPenalty ? parseFloat(form.maxPenalty) : undefined,
        frequency:       form.frequency,
        description:     form.description || undefined,
      });
      setShowForm(false);
      setForm(emptyRule());
      refetchLF();
      toast.success("Late fee rule created");
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to create rule");
    } finally { setSaving(false); }
  };

  const waiveLateFee = async (invoiceId: string, invoiceNumber: string) => {
    const reason = window.prompt(`Reason for waiving late fee on ${invoiceNumber}:`);
    if (!reason) return;
    try {
      await apiClient.patch(`/billing/late-fees/waive/${invoiceId}`, { reason });
      setWaivedIds(prev => new Set([...prev, invoiceId]));
      refetchInv();
      toast.success(`Late fee waived for ${invoiceNumber}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to waive");
    }
  };

  const invoicesWithLF = overdueList.filter(
    (i: any) => i.lateFees?.length > 0 && !waivedIds.has(i.id)
  );

  return (
    <div>
      <PageHeader
        title="Late Fees"
        subtitle="Configure rules and waive late fees"
        action={tab === "rules" ? (
          <button onClick={() => setShowForm(p => !p)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors">
            <Plus className="w-4 h-4" /> New Rule
          </button>
        ) : undefined}
      />

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6">
        {([
          { key: "rules", label: "Late Fee Rules" },
          { key: "waive", label: `Waive Late Fees${invoicesWithLF.length > 0 ? ` (${invoicesWithLF.length})` : ""}` },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key ? "text-blue-600 border-blue-600" : "text-slate-500 border-transparent hover:text-slate-700"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* RULES TAB */}
      {tab === "rules" && (
        <>
          {/* Create form */}
          {showForm && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">New Late Fee Rule</h3>
              <form onSubmit={createRule}>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Grace Period (days) *</label>
                    <input required type="number" min="0" value={form.gracePeriodDays} onChange={f("gracePeriodDays")}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Penalty Type</label>
                    <select value={form.penaltyType} onChange={f("penaltyType")}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="PERCENTAGE">Percentage (%)</option>
                      <option value="FLAT">Flat Amount (₹)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                      Penalty Value * {form.penaltyType === "PERCENTAGE" ? "(%)" : "(₹)"}
                    </label>
                    <input required type="number" min="0" step="0.01" value={form.penaltyValue} onChange={f("penaltyValue")}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Max Penalty (₹, optional)</label>
                    <input type="number" min="0" step="0.01" placeholder="No cap" value={form.maxPenalty} onChange={f("maxPenalty")}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Frequency</label>
                    <select value={form.frequency} onChange={f("frequency")}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="ONCE">Once</option>
                      <option value="DAILY">Daily</option>
                      <option value="WEEKLY">Weekly</option>
                      <option value="MONTHLY">Monthly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Description</label>
                    <input type="text" placeholder="Internal note" value={form.description} onChange={f("description")}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={saving}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors">
                    {saving ? "Creating..." : "Create Rule"}
                  </button>
                  <button type="button" onClick={() => { setShowForm(false); setForm(emptyRule()); }}
                    className="px-4 py-2 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Rules list */}
          {lfLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
            </div>
          ) : lateList.length === 0 ? (
            <EmptyState
              title="No late fee rules"
              message="Create a rule to automatically apply late fees to overdue invoices."
              icon={<Clock className="w-10 h-10" />}
            />
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {lateList.map((rule: any, i: number) => (
                <div key={rule.id} className={`flex items-center justify-between p-5 ${i > 0 ? "border-t border-slate-100" : ""}`}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-slate-800">
                        {rule.penaltyType === "PERCENTAGE" ? `${rule.penaltyValue}% penalty` : `₹${rule.penaltyValue} flat`}
                        {" · "}
                        <span className="font-normal text-slate-500">{rule.frequency?.toLowerCase()}</span>
                      </p>
                      <Badge
                        label={rule.isActive ? "Active" : "Disabled"}
                        variant={rule.isActive ? "success" : "neutral"}
                      />
                    </div>
                    <p className="text-xs text-slate-400">
                      Grace period: {rule.gracePeriodDays}d
                      {rule.maxPenalty ? ` · Max: ${fmt(rule.maxPenalty)}` : ""}
                      {rule.description ? ` · ${rule.description}` : ""}
                    </p>
                  </div>
                  {rule.isActive && (
                    <button
                      onClick={async () => {
                        try {
                          await apiClient.patch(`/billing/late-fees/rules/${rule.id}`, { isActive: false });
                          refetchLF();
                          toast.success("Rule disabled");
                        } catch (err: any) {
                          toast.error(err?.response?.data?.message ?? "Failed");
                        }
                      }}
                      className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors">
                      Disable
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* WAIVE TAB */}
      {tab === "waive" && (
        <>
          {invLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
            </div>
          ) : invoicesWithLF.length === 0 ? (
            <EmptyState
              title="No late fees to waive"
              message="No overdue invoices currently have late fees applied."
              icon={<CheckCircle2 className="w-10 h-10" />}
            />
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {invoicesWithLF.map((inv: any, i: number) => {
                const totalLF = inv.lateFees?.reduce((s: number, lf: any) => s + Number(lf.amount), 0) ?? 0;
                return (
                  <div key={inv.id} className={`flex items-center justify-between p-5 ${i > 0 ? "border-t border-slate-100" : ""}`}>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {inv.student?.firstName} {inv.student?.lastName}
                        <span className="font-mono text-xs text-slate-400 ml-2">{inv.invoiceNumber}</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Due: {fmtDate(inv.dueDate)} · Principal: {fmt(inv.dueAmount)}
                        · <span className="text-red-500 font-medium">Late fee: {fmt(totalLF)}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => waiveLateFee(inv.id, inv.invoiceNumber)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg font-medium transition-colors">
                      <XCircle className="w-3.5 h-3.5" /> Waive
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
