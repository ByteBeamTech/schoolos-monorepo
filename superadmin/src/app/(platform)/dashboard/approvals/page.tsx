"use client";
import { useState }   from "react";
import { useApi }     from "@/lib/hooks";
import { api }        from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { Badge }      from "@/components/ui/badge";
import { formatDate, formatRelative, formatCurrency } from "@/lib/utils";
import {
  Check, X, Clock, ChevronDown, ChevronUp,
  AlertTriangle, Zap, Shield, RotateCcw,
  TrendingUp, Calendar, User, Building2,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface OverrideRequest {
  id:             string;
  flag:           { name: string; label: string; category: string; description: string };
  targetType:     string;
  targetId:       string;
  targetName:     string | null;
  isEnabled:      boolean;
  requestedBy:    string;
  requestedAt:    string;
  requestReason:  string;
  activationMode: string;
  trialDays:      number | null;
  gracePeriodDays: number | null;
  autoRevokeIfNotUpgradedDays: number | null;
  activatesAt:    string | null;
  status:         string;
  approvedBy:     string | null;
  approvedAt:     string | null;
  approverNote:   string | null;
  rejectedBy:     string | null;
  rejectedAt:     string | null;
  rejectionReason: string | null;
  revokedAt:      string | null;
  revokeReason:   string | null;
  slaDeadlineAt:  string | null;
  escalatedAt:    string | null;
  planSnapshotAtApproval: any;
  inGracePeriod:  boolean;
  graceEndsAt:    string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_VARIANT: Record<string, any> = {
  PENDING: "warning", APPROVED: "success", ACTIVE: "success",
  REJECTED: "error",  CANCELLED: "neutral", EXPIRED: "neutral", REVOKED: "error",
};

const MODE_META: Record<string, { label: string; icon: any; color: string }> = {
  IMMEDIATE:     { label: "Immediate",      icon: Zap,       color: "text-blue-400"   },
  SCHEDULED:     { label: "Scheduled",      icon: Calendar,  color: "text-purple-400" },
  TRIAL:         { label: "Trial window",   icon: Clock,     color: "text-amber-400"  },
  UPGRADE_GATED: { label: "Upgrade-gated",  icon: TrendingUp,color: "text-orange-400" },
};

const TARGET_ICON: Record<string, any> = {
  TENANT: Building2, USER: User, ROLE: Shield, GLOBAL: Zap,
};

function slaBadge(req: OverrideRequest) {
  if (req.status !== "PENDING" || !req.slaDeadlineAt) return null;
  const hoursLeft = Math.round((new Date(req.slaDeadlineAt).getTime() - Date.now()) / 3600000);
  if (hoursLeft < 0)  return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">SLA BREACHED</span>;
  if (hoursLeft < 4)  return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">{hoursLeft}h left</span>;
  if (hoursLeft < 12) return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">{hoursLeft}h left</span>;
  return null;
}

// ── Lifecycle Timeline ────────────────────────────────────────────────────────
function LifecycleTimeline({ req }: { req: OverrideRequest }) {
  const steps = [
    {
      label:     "Requested",
      time:      req.requestedAt,
      actor:     req.requestedBy,
      done:      true,
      color:     "bg-blue-500",
      detail:    req.requestReason,
    },
    {
      label:     req.status === "REJECTED" ? "Rejected" : req.approvedAt ? "Approved" : "Awaiting approval",
      time:      req.approvedAt ?? req.rejectedAt ?? null,
      actor:     req.approvedBy ?? req.rejectedBy ?? null,
      done:      !!req.approvedAt || !!req.rejectedAt,
      color:     req.rejectedAt ? "bg-red-500" : req.approvedAt ? "bg-emerald-500" : "bg-slate-700",
      detail:    req.approverNote ?? req.rejectionReason ?? null,
    },
    ...(req.activationMode === "SCHEDULED" && req.activatesAt ? [{
      label:     "Scheduled activation",
      time:      req.activatesAt,
      actor:     null,
      done:      new Date(req.activatesAt) < new Date(),
      color:     "bg-purple-500",
      detail:    `Activates at ${formatDate(req.activatesAt)}`,
    }] : []),
    ...(req.inGracePeriod && req.graceEndsAt ? [{
      label:     "Grace period active",
      time:      req.graceEndsAt,
      actor:     null,
      done:      false,
      color:     "bg-amber-500",
      detail:    `Feature still accessible until ${formatDate(req.graceEndsAt)}`,
    }] : []),
    ...(req.trialDays ? [{
      label:     "Trial window",
      time:      req.approvedAt
        ? new Date(new Date(req.approvedAt).getTime() + req.trialDays * 86400000).toISOString()
        : null,
      actor:     null,
      done:      false,
      color:     "bg-amber-500",
      detail:    `${req.trialDays}-day trial — auto-expires`,
    }] : []),
    ...(req.autoRevokeIfNotUpgradedDays ? [{
      label:     "Upgrade deadline",
      time:      req.approvedAt
        ? new Date(new Date(req.approvedAt).getTime() + req.autoRevokeIfNotUpgradedDays * 86400000).toISOString()
        : null,
      actor:     null,
      done:      false,
      color:     "bg-orange-500",
      detail:    `Auto-revokes if school doesn't upgrade within ${req.autoRevokeIfNotUpgradedDays} days`,
    }] : []),
    ...(req.revokedAt ? [{
      label:     "Revoked",
      time:      req.revokedAt,
      actor:     null,
      done:      true,
      color:     "bg-red-500",
      detail:    req.revokeReason ?? null,
    }] : []),
  ];

  return (
    <div className="relative pl-6">
      {steps.map((step, i) => (
        <div key={i} className="relative mb-4 last:mb-0">
          {/* Connector line */}
          {i < steps.length - 1 && (
            <div className="absolute left-[-16px] top-5 w-0.5 h-full bg-slate-800" />
          )}
          {/* Dot */}
          <div className={`absolute left-[-20px] top-1 w-3 h-3 rounded-full border-2 border-slate-900 ${step.done ? step.color : "bg-slate-700"}`} />

          <div>
            <div className="flex items-center gap-2">
              <p className={`text-xs font-semibold ${step.done ? "text-slate-200" : "text-slate-500"}`}>
                {step.label}
              </p>
              {step.time && (
                <span className="text-xs text-slate-600">{formatRelative(step.time)}</span>
              )}
            </div>
            {step.actor && (
              <p className="text-xs text-slate-500 mt-0.5">by {step.actor}</p>
            )}
            {step.detail && (
              <p className="text-xs text-slate-400 mt-1 italic">"{step.detail}"</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Usage sparkline mini-chart ─────────────────────────────────────────────────
function UsageMini({ flagName, tenantId }: { flagName: string; tenantId: string }) {
  const { data } = useApi<any[]>(`/flags/analytics/usage?flagName=${flagName}&tenantId=${tenantId}&days=7`);
  if (!data || data.length === 0) return <span className="text-xs text-slate-600">No usage data</span>;

  const max = Math.max(...data.map((d: any) => d._sum?.callCount ?? 0), 1);
  return (
    <div className="flex items-end gap-0.5 h-6">
      {data.slice(-7).map((d: any, i: number) => {
        const h = Math.round(((d._sum?.callCount ?? 0) / max) * 24);
        return (
          <div key={i} title={`${d._sum?.callCount ?? 0} calls`}
            className="w-2 bg-orange-500/60 rounded-sm" style={{ height: `${Math.max(h, 2)}px` }} />
        );
      })}
      <span className="text-xs text-slate-500 ml-1 self-end">
        {data.reduce((s: number, d: any) => s + (d._sum?.callCount ?? 0), 0)} calls/7d
      </span>
    </div>
  );
}

// ── Request card ──────────────────────────────────────────────────────────────
function RequestCard({ req, onDone }: { req: OverrideRequest; onDone: () => void }) {
  const [expanded,    setExpanded]    = useState(false);
  const [acting,      setActing]      = useState("");
  const [approveNote, setApproveNote] = useState("");
  const [rejectNote,  setRejectNote]  = useState("");
  const [revokeNote,  setRevokeNote]  = useState("");
  const [showReject,  setShowReject]  = useState(false);
  const [showRevoke,  setShowRevoke]  = useState(false);
  const [graceOnRevoke, setGraceOnRevoke] = useState(false);

  const ModeIcon = MODE_META[req.activationMode]?.icon ?? Clock;
  const TargetIcon = TARGET_ICON[req.targetType] ?? Building2;

  const act = async (action: string, body: any) => {
    setActing(action);
    try {
      await api.patch(`/flags/requests/${req.id}/${action}`, body);
      onDone();
    } catch (e: any) { alert(e.message); }
    finally { setActing(""); }
  };

  const isPending  = req.status === "PENDING";
  const isApproved = req.status === "APPROVED";
  const isSLABreach = req.slaDeadlineAt && new Date(req.slaDeadlineAt) < new Date() && isPending;

  return (
    <div className={`bg-slate-900 rounded-xl border overflow-hidden transition-colors ${
      isSLABreach ? "border-red-500/40" : "border-slate-800"
    }`}>
      {/* Card header */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Flag info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                req.flag.category === "MODULE"  ? "bg-blue-500/10 text-blue-400" :
                req.flag.category === "FEATURE" ? "bg-purple-500/10 text-purple-400" :
                "bg-amber-500/10 text-amber-400"
              }`}>{req.flag.category}</span>

              <p className="text-sm font-bold text-white">{req.flag.label}</p>

              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                req.isEnabled ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
              }`}>{req.isEnabled ? "ENABLE" : "DISABLE"}</span>

              <Badge label={req.status} variant={STATUS_VARIANT[req.status] ?? "neutral"} />
              {slaBadge(req)}
            </div>

            {/* Target */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
              <TargetIcon className="w-3 h-3 text-slate-500" />
              <span>{req.targetType}</span>
              <span className="text-slate-600">→</span>
              <span className="font-medium text-slate-300">{req.targetName ?? req.targetId}</span>
            </div>

            {/* Mode + timing */}
            <div className="flex items-center gap-4 flex-wrap text-xs text-slate-500">
              <div className="flex items-center gap-1">
                <ModeIcon className={`w-3 h-3 ${MODE_META[req.activationMode]?.color}`} />
                <span className={MODE_META[req.activationMode]?.color}>{MODE_META[req.activationMode]?.label}</span>
                {req.trialDays && <span>· {req.trialDays}d</span>}
                {req.gracePeriodDays && <span>· {req.gracePeriodDays}d grace</span>}
                {req.autoRevokeIfNotUpgradedDays && <span>· revoke in {req.autoRevokeIfNotUpgradedDays}d</span>}
              </div>
              <span>Requested {formatRelative(req.requestedAt)}</span>
              {req.slaDeadlineAt && isPending && (
                <span className="text-slate-600">SLA: {formatDate(req.slaDeadlineAt)}</span>
              )}
            </div>

            {/* Reason */}
            <div className="mt-3 bg-slate-800/50 rounded-lg px-3 py-2">
              <p className="text-xs text-slate-400 italic">"{req.requestReason}"</p>
            </div>

            {/* Plan snapshot at request time */}
            {req.planSnapshotAtApproval && (
              <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3" />
                Plan at request: <strong className="text-slate-300">{req.planSnapshotAtApproval.tier}</strong>
                {req.inGracePeriod && req.graceEndsAt && (
                  <span className="ml-2 text-amber-400 font-medium">
                    ⚡ Grace period until {formatDate(req.graceEndsAt)}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex-shrink-0 space-y-2 w-44">
            {isPending && (
              <>
                <input value={approveNote} onChange={e => setApproveNote(e.target.value)}
                  placeholder="Approval note (optional)"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg focus:outline-none focus:border-emerald-500 placeholder-slate-600" />
                <button onClick={() => act("approve", { approverNote: approveNote || undefined })}
                  disabled={!!acting}
                  className="w-full flex items-center justify-center gap-1.5 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-lg hover:bg-emerald-500/20 disabled:opacity-50 transition-colors">
                  <Check className="w-3 h-3" />
                  {acting === "approve" ? "Approving..." : "Approve"}
                </button>
                <button onClick={() => setShowReject(!showReject)}
                  className="w-full py-2 bg-slate-800 border border-slate-700 text-slate-400 text-xs rounded-lg hover:bg-slate-700 transition-colors">
                  Reject
                </button>
                {showReject && (
                  <>
                    <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                      rows={2} placeholder="Rejection reason *"
                      className="w-full px-3 py-2 bg-slate-800 border border-red-500/30 text-slate-200 text-xs rounded-lg focus:outline-none resize-none placeholder-slate-600" />
                    <button onClick={() => act("reject", { rejectionReason: rejectNote })}
                      disabled={!!acting || !rejectNote.trim()}
                      className="w-full py-2 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium rounded-lg hover:bg-red-500/20 disabled:opacity-50">
                      {acting === "reject" ? "Rejecting..." : "Confirm Reject"}
                    </button>
                  </>
                )}
              </>
            )}

            {isApproved && (
              <>
                {req.gracePeriodDays && (
                  <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                    <input type="checkbox" checked={graceOnRevoke} onChange={e => setGraceOnRevoke(e.target.checked)}
                      className="accent-orange-500" />
                    Start grace period
                  </label>
                )}
                <input value={revokeNote} onChange={e => setRevokeNote(e.target.value)}
                  placeholder="Revoke reason"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg focus:outline-none placeholder-slate-600" />
                <button onClick={() => act("revoke", { revokeReason: revokeNote || "Manually revoked", startGracePeriod: graceOnRevoke })}
                  disabled={!!acting}
                  className="w-full flex items-center justify-center gap-1.5 py-2 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium rounded-lg hover:bg-red-500/20 disabled:opacity-50">
                  <RotateCcw className="w-3 h-3" />
                  {acting === "revoke" ? "Revoking..." : graceOnRevoke ? "Revoke + Grace" : "Revoke Now"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Expand toggle */}
        <button onClick={() => setExpanded(!expanded)}
          className="mt-3 text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors">
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? "Hide" : "Show"} timeline & usage
        </button>
      </div>

      {/* Expanded: timeline + usage */}
      {expanded && (
        <div className="border-t border-slate-800 p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Lifecycle timeline</p>
            <LifecycleTimeline req={req} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Usage (last 7 days)</p>
            <UsageMini flagName={req.flag.name} tenantId={req.targetId} />
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Flag details</p>
              <p className="text-xs text-slate-400">{req.flag.description}</p>
              <p className="text-xs font-mono text-slate-600">{req.flag.name}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Analytics panel ───────────────────────────────────────────────────────────
function AnalyticsPanel() {
  const { data: usage } = useApi<any[]>("/flags/analytics/usage?days=30");
  const top = (usage ?? []).slice(0, 5);

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">Top blocked flags (30d)</p>
      {top.length === 0 ? (
        <p className="text-slate-600 text-sm">No usage data yet</p>
      ) : top.map((u: any, i) => (
        <div key={i} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
          <p className="text-xs text-slate-400 font-mono truncate flex-1">{u.flagName}</p>
          <div className="flex gap-4 text-xs flex-shrink-0">
            <span className="text-slate-500">{(u._sum?.callCount ?? 0).toLocaleString()} calls</span>
            <span className="text-red-400">{(u._sum?.missCount ?? 0).toLocaleString()} blocked</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ApprovalInboxPage() {
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [myOnly,       setMyOnly]       = useState(false);

  const url = `/flags/requests?status=${statusFilter}${myOnly ? "&myRequests=true" : ""}&limit=50`;
  const { data, loading, refetch } = useApi<{ data: OverrideRequest[]; meta: any }>(url, [statusFilter, myOnly]);
  const { data: pending }          = useApi<{ count: number }>("/flags/requests/pending");

  const requests = data?.data ?? [];
  const pending_count = pending?.count ?? 0;

  return (
    <div>
      <PageHeader
        title="Approval Inbox"
        subtitle="Feature override requests awaiting action"
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main list */}
        <div className="lg:col-span-3">
          {/* Filters */}
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            {["PENDING", "APPROVED", "REJECTED", "REVOKED", "EXPIRED", "CANCELLED"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-2 text-xs rounded-lg border font-medium transition-colors ${
                  statusFilter === s
                    ? "bg-orange-500/10 border-orange-500 text-orange-400"
                    : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600"
                }`}>
                {s}
                {s === "PENDING" && pending_count > 0 && (
                  <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                    {pending_count}
                  </span>
                )}
              </button>
            ))}
            <label className="flex items-center gap-2 text-xs text-slate-400 ml-auto cursor-pointer">
              <input type="checkbox" checked={myOnly} onChange={e => setMyOnly(e.target.checked)}
                className="accent-orange-500" />
              My requests only
            </label>
          </div>

          {/* SLA warning banner */}
          {statusFilter === "PENDING" && pending_count > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <p className="text-xs text-amber-400">
                <strong>{pending_count} request{pending_count > 1 ? "s" : ""}</strong> pending approval.
                SLA is {24}h — breached requests auto-escalate.
              </p>
            </div>
          )}

          {/* Request list */}
          <div className="space-y-3">
            {loading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="h-40 bg-slate-800 rounded-xl animate-pulse" />
              ))
            ) : requests.length === 0 ? (
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-16 text-center">
                <Check className="w-10 h-10 text-emerald-500/30 mx-auto mb-3" />
                <p className="text-slate-400 font-medium">No {statusFilter.toLowerCase()} requests</p>
                {statusFilter === "PENDING" && (
                  <p className="text-slate-600 text-sm mt-1">Inbox is clear — all caught up.</p>
                )}
              </div>
            ) : (
              requests.map(req => (
                <RequestCard key={req.id} req={req} onDone={refetch} />
              ))
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Summary stats */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">Summary</p>
            {[
              { label: "Pending",  value: pending_count,           color: "text-amber-400"  },
              { label: "Total",    value: data?.meta?.total ?? 0,  color: "text-white"      },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex justify-between py-2 border-b border-slate-800 last:border-0">
                <span className="text-xs text-slate-500">{label}</span>
                <span className={`text-sm font-bold ${color}`}>{value}</span>
              </div>
            ))}
          </div>

          <AnalyticsPanel />
        </div>
      </div>
    </div>
  );
}
