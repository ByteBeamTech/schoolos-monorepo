"use client";
// frontend/src/app/dashboard/(finance)/billing/runs/page.tsx
//
// Billing Runs. Built against the real BillingRun backend contract
// (backend/src/modules/student-billing/billing-run/), read directly
// before writing this, not assumed. GET /billing/runs is the one
// additive endpoint added alongside this page -- everything else here
// calls Phase 4's existing trigger/execute/retry-failed endpoints
// unchanged.

import { useState } from "react";
import Link from "next/link";
import { Play, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useApi } from "@/lib/hooks";
import { useToast } from "@/lib/use-toast";
import {
  triggerBillingRun, monthOptions, statusVariant,
  type PaginatedBillingRuns, type BillingRunStatus,
} from "@/lib/billing/billing-run";

function fmtDateTime(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

const statusLabel: Record<BillingRunStatus, string> = {
  PENDING: "Pending", IN_PROGRESS: "In Progress", COMPLETED: "Completed",
  PARTIALLY_COMPLETED: "Partially Completed", FAILED: "Failed",
};

export default function BillingRunsPage() {
  const [page, setPage] = useState(1);
  const [showTrigger, setShowTrigger] = useState(false);

  const { data, loading, error, refetch } = useApi<PaginatedBillingRuns>(`/billing/runs?page=${page}&limit=20`, [page]);
  const runs = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div>
      <PageHeader
        title="Billing Runs"
        subtitle="Trigger and monitor periodic billing for this branch"
        action={
          <button onClick={() => setShowTrigger((p) => !p)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors">
            <Plus className="w-4 h-4" /> Trigger Run
          </button>
        }
      />

      {showTrigger && (
        <TriggerForm
          onDone={() => { setShowTrigger(false); setPage(1); refetch(); }}
          onCancel={() => setShowTrigger(false)}
        />
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : runs.length === 0 ? (
        <EmptyState
          title="No billing runs yet"
          message="Trigger a billing run to generate invoices for every eligible student in this branch for a given month."
          icon={<Play className="w-10 h-10" />}
        />
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {runs.map((run, i) => (
              <Link key={run.id} href={`/dashboard/billing/runs/${run.id}`}
                className={`flex items-center justify-between p-5 hover:bg-slate-50 transition-colors ${i > 0 ? "border-t border-slate-100" : ""}`}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-slate-800">{run.periodLabel}</p>
                    <Badge label={statusLabel[run.status]} variant={statusVariant(run.status)} />
                    <span className="text-xs text-slate-400">{run.triggeredBy === "MANUAL" ? "Manual" : "Scheduled"}</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Triggered {fmtDateTime(run.createdAt)}
                    {run.completedAt && ` · Completed ${fmtDateTime(run.completedAt)}`}
                  </p>
                </div>
                <span className="text-xs text-blue-600 font-medium">View details →</span>
              </Link>
            ))}
          </div>

          {meta && meta.lastPage > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
              <span>Page {meta.page} of {meta.lastPage} · {meta.total} run{meta.total === 1 ? "" : "s"} total</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">
                  Previous
                </button>
                <button disabled={page >= meta.lastPage} onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Trigger form ────────────────────────────────────────────────────────
function TriggerForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { toast } = useToast();
  const now = new Date();
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await triggerBillingRun({ periodMonth, periodYear });
      toast.success("Billing run created. Open it to execute.");
      onDone();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to trigger billing run");
    } finally {
      setSaving(false);
      setConfirming(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
      <h3 className="text-sm font-semibold text-slate-700 mb-1">Trigger a Billing Run</h3>
      <p className="text-xs text-slate-400 mb-4">
        Creates one pending attempt per eligible student in this branch. Nothing is billed until you execute it from the run's detail page.
      </p>
      <div className="grid grid-cols-2 gap-4 mb-4 max-w-md">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Month</label>
          <select value={periodMonth} onChange={(e) => setPeriodMonth(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            {monthOptions().map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Year</label>
          <input type="number" min="2000" value={periodYear} onChange={(e) => setPeriodYear(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {!confirming ? (
        <div className="flex gap-2">
          <button onClick={() => setConfirming(true)}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors">
            Continue
          </button>
          <button onClick={onCancel}
            className="px-4 py-2 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 transition-colors">
            Cancel
          </button>
        </div>
      ) : (
        // Confirmation step -- triggering creates real, persisted
        // BillingRunAttempt rows for every eligible student in the
        // branch; this isn't destructive by itself (nothing is billed
        // until execute), but it's not a trivial no-op action either,
        // so it gets an explicit confirm rather than firing on one click.
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
          <p className="text-sm text-amber-800 mb-3">
            Confirm: trigger a billing run for <strong>{monthOptions().find((m) => m.value === periodMonth)?.label} {periodYear}</strong>?
          </p>
          <div className="flex gap-2">
            <button onClick={submit} disabled={saving}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-lg font-medium disabled:opacity-50">
              {saving ? "Triggering…" : "Confirm & Trigger"}
            </button>
            <button onClick={() => setConfirming(false)} disabled={saving}
              className="px-3 py-2 bg-white border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50">
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
