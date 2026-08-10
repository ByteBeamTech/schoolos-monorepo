"use client";
// frontend/src/app/dashboard/(finance)/billing/runs/[id]/page.tsx

import { use, useState } from "react";
import Link from "next/link";
import { PlayCircle, RotateCcw, Users, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useApi } from "@/lib/hooks";
import { useToast } from "@/lib/use-toast";
import {
  executeBillingRun, retryFailedAttempts, statusVariant, attemptStatusVariant,
  type BillingRunDetail, type BillingRunAttempt, type AttemptStatus, type BillingRunStatus,
} from "@/lib/billing/billing-run";

function fmtDateTime(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

const statusLabel: Record<BillingRunStatus, string> = {
  PENDING: "Pending", IN_PROGRESS: "In Progress", COMPLETED: "Completed",
  PARTIALLY_COMPLETED: "Partially Completed", FAILED: "Failed",
};
const attemptStatusLabel: Record<AttemptStatus, string> = {
  PENDING: "Pending", PROCESSING: "Processing", SUCCEEDED: "Succeeded", FAILED: "Failed",
};

export default function BillingRunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { toast } = useToast();
  const [attemptFilter, setAttemptFilter] = useState<AttemptStatus | "ALL">("ALL");
  const [confirmAction, setConfirmAction] = useState<"execute" | "retry" | null>(null);
  const [working, setWorking] = useState(false);

  const { data: run, loading, error, refetch: refetchRun } = useApi<BillingRunDetail>(`/billing/runs/${id}`, [id]);
  const attemptsUrl = attemptFilter === "ALL" ? `/billing/runs/${id}/attempts` : `/billing/runs/${id}/attempts?status=${attemptFilter}`;
  const { data: attempts, loading: attemptsLoading, refetch: refetchAttempts } = useApi<BillingRunAttempt[]>(attemptsUrl, [id, attemptFilter]);
  const attemptList = Array.isArray(attempts) ? attempts : [];

  const refetchAll = () => { refetchRun(); refetchAttempts(); };

  const counts = run?.attemptCounts ?? {};
  const failedCount = counts.FAILED ?? 0;
  const pendingCount = counts.PENDING ?? 0;
  const canExecute = run && (run.status === "PENDING" || pendingCount > 0);
  const canRetry = run && failedCount > 0 && run.status !== "IN_PROGRESS";

  // Execute/retry both act on every pending or failed attempt in this
  // run at once -- not reversible once run (invoices get created), so
  // both go through the same explicit confirm step as triggering does.
  const runAction = async () => {
    if (!confirmAction) return;
    setWorking(true);
    try {
      if (confirmAction === "execute") {
        await executeBillingRun(id);
        toast.success("Billing run executed.");
      } else {
        await retryFailedAttempts(id);
        toast.success("Failed attempts retried.");
      }
      refetchAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Action failed");
    } finally {
      setWorking(false);
      setConfirmAction(null);
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Billing Run" subtitle="Loading…" />
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div>
        <PageHeader title="Billing Run" />
        <EmptyState title="Billing run not found" message={error ?? "This run may have been removed, or you may not have access to it."} icon={<AlertTriangle className="w-10 h-10" />} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={run.periodLabel}
        subtitle={`${run.triggeredBy === "MANUAL" ? "Manually triggered" : "Scheduled"} · ${fmtDateTime(run.createdAt)}`}
        action={
          <div className="flex items-center gap-2">
            <Badge label={statusLabel[run.status]} variant={statusVariant(run.status)} />
            {canExecute && (
              <button onClick={() => setConfirmAction("execute")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors">
                <PlayCircle className="w-3.5 h-3.5" /> Execute
              </button>
            )}
            {canRetry && (
              <button onClick={() => setConfirmAction("retry")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg font-medium transition-colors">
                <RotateCcw className="w-3.5 h-3.5" /> Retry Failed ({failedCount})
              </button>
            )}
          </div>
        }
      />

      {confirmAction && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 mb-6">
          <p className="text-sm text-amber-800 mb-3">
            {confirmAction === "execute"
              ? `Confirm: execute this billing run? This generates real invoices for every pending student and cannot be undone.`
              : `Confirm: retry the ${failedCount} failed attempt${failedCount === 1 ? "" : "s"} in this run?`}
          </p>
          <div className="flex gap-2">
            <button onClick={runAction} disabled={working}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-lg font-medium disabled:opacity-50">
              {working ? "Working…" : "Confirm"}
            </button>
            <button onClick={() => setConfirmAction(null)} disabled={working}
              className="px-3 py-2 bg-white border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Attempt counts summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {(["SUCCEEDED", "FAILED", "PENDING", "PROCESSING"] as AttemptStatus[]).map((s) => (
          <div key={s} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs text-slate-400 mb-1">{attemptStatusLabel[s]}</p>
            <p className="text-2xl font-semibold text-slate-800">{counts[s] ?? 0}</p>
          </div>
        ))}
      </div>

      {/* Attempts list */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
          <Users className="w-4 h-4 text-slate-400" /> Attempts
        </h3>
        <select value={attemptFilter} onChange={(e) => setAttemptFilter(e.target.value as AttemptStatus | "ALL")}
          className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="ALL">All statuses</option>
          {(["SUCCEEDED", "FAILED", "PENDING", "PROCESSING"] as AttemptStatus[]).map((s) => (
            <option key={s} value={s}>{attemptStatusLabel[s]}</option>
          ))}
        </select>
      </div>

      {attemptsLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : attemptList.length === 0 ? (
        <EmptyState title="No attempts" message="No attempts match this filter." icon={<Users className="w-10 h-10" />} />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {attemptList.map((a, i) => (
            <div key={a.id} className={`flex items-center justify-between p-4 ${i > 0 ? "border-t border-slate-100" : ""}`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-slate-600">{a.studentId}</span>
                  <Badge label={attemptStatusLabel[a.status]} variant={attemptStatusVariant(a.status)} />
                  {a.retryCount > 0 && <span className="text-xs text-slate-400">retried {a.retryCount}×</span>}
                </div>
                {a.errorMessage && <p className="text-xs text-red-500 mt-1">{a.errorMessage}</p>}
              </div>
              {a.invoiceId && (
                <Link href={`/dashboard/billing/invoices/${a.invoiceId}`} className="text-xs text-blue-600 hover:underline font-medium">
                  View Invoice →
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
