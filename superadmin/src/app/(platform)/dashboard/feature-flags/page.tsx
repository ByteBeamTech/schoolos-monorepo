"use client";
import { useState }   from "react";
import { useApi }     from "@/lib/hooks";
import { api }        from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { Badge }      from "@/components/ui/badge";
import { formatDate, formatRelative } from "@/lib/utils";
import {
  Plus, ChevronDown, ChevronUp, Check, X,
  Clock, AlertTriangle, Zap, Shield, RotateCcw,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface FlagDef {
  id:                string;
  name:              string;
  label:             string;
  description:       string;
  category:          "MODULE" | "FEATURE" | "SYSTEM";
  defaultValue:      boolean;
  allowedTiers:      string[];
  tenantControllable: boolean;
  overrides:         Override[];
  _count:            { overrideRequests: number };
}

interface Override {
  id:         string;
  targetType: string;
  targetId:   string;
  isEnabled:  boolean;
  expiresAt:  string | null;
  reason:     string | null;
  createdBy:  string | null;
  createdAt:  string;
}

interface OverrideRequest {
  id:             string;
  flag:           { name: string; label: string; category: string };
  targetType:     string;
  targetId:       string;
  targetName:     string | null;
  isEnabled:      boolean;
  requestedBy:    string;
  requestedAt:    string;
  requestReason:  string;
  activationMode: string;
  trialDays:      number | null;
  autoRevokeIfNotUpgradedDays: number | null;
  activatesAt:    string | null;
  status:         string;
  approvedBy:     string | null;
  approvedAt:     string | null;
  approverNote:   string | null;
  rejectionReason: string | null;
  revokeReason:   string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_VARIANT: Record<string, any> = {
  PENDING:  "warning", APPROVED: "success", ACTIVE: "success",
  REJECTED: "error",   CANCELLED: "neutral", EXPIRED: "neutral",
  REVOKED:  "error",
};

const MODE_LABEL: Record<string, string> = {
  IMMEDIATE:     "Immediate",
  SCHEDULED:     "Scheduled",
  TRIAL:         "Trial window",
  UPGRADE_GATED: "Upgrade-gated",
};

const CATEGORY_COLOR: Record<string, string> = {
  MODULE:  "bg-blue-500/10 text-blue-400 border-blue-500/20",
  FEATURE: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  SYSTEM:  "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

// ── New Request Modal ─────────────────────────────────────────────────────────
function RequestModal({
  flags, tenants, onClose, onSuccess,
}: {
  flags:     FlagDef[];
  tenants:   any[];
  onClose:   () => void;
  onSuccess: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    flagName: "", targetType: "TENANT", targetId: "",
    isEnabled: true, requestReason: "",
    activationMode: "IMMEDIATE",
    activatesAt: "", trialDays: "7",
    autoRevokeIfNotUpgradedDays: "30",
  });
  const f = (k: string) => (e: any) =>
    setForm(p => ({ ...p, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const selectedTenant = tenants.find(t => t.id === form.targetId);
  const selectedFlag   = flags.find(f => f.name === form.flagName);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/flags/requests", {
        flagName:      form.flagName,
        targetType:    form.targetType,
        targetId:      form.targetId,
        targetName:    selectedTenant?.name,
        isEnabled:     form.isEnabled,
        requestReason: form.requestReason,
        activationMode: form.activationMode,
        activatesAt:   form.activationMode === "SCHEDULED" ? form.activatesAt : undefined,
        trialDays:     form.activationMode === "TRIAL"     ? parseInt(form.trialDays) : undefined,
        autoRevokeIfNotUpgradedDays: form.activationMode === "UPGRADE_GATED"
          ? parseInt(form.autoRevokeIfNotUpgradedDays) : undefined,
      });
      onSuccess();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-slate-800 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-white">Request Feature Override</h2>
            <p className="text-slate-400 text-sm mt-0.5">Override requires approval from SaaS Owner or Account Manager</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>

        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          {/* Flag selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Feature / Module *</label>
            <select required value={form.flagName} onChange={f("flagName")}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:outline-none focus:border-orange-500">
              <option value="">— select a flag —</option>
              <optgroup label="Modules">
                {flags.filter(fl => fl.category === "MODULE").map(fl => (
                  <option key={fl.name} value={fl.name}>{fl.label} ({fl.allowedTiers.join(", ") || "all tiers"})</option>
                ))}
              </optgroup>
              <optgroup label="Features">
                {flags.filter(fl => fl.category === "FEATURE").map(fl => (
                  <option key={fl.name} value={fl.name}>{fl.label} ({fl.allowedTiers.join(", ") || "all tiers"})</option>
                ))}
              </optgroup>
            </select>
            {selectedFlag && (
              <p className="text-xs text-slate-500 mt-1">{selectedFlag.description}</p>
            )}
          </div>

          {/* Target */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Target type *</label>
              <select value={form.targetType} onChange={f("targetType")}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:outline-none focus:border-orange-500">
                <option value="TENANT">Specific School</option>
                <option value="ROLE">All users with Role</option>
                <option value="USER">Specific User</option>
                <option value="GLOBAL">All Schools (Global)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                {form.targetType === "TENANT" ? "School *" :
                 form.targetType === "ROLE"   ? "Role *" : "Target ID *"}
              </label>
              {form.targetType === "TENANT" ? (
                <select required value={form.targetId} onChange={f("targetId")}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:outline-none focus:border-orange-500">
                  <option value="">— select school —</option>
                  {tenants.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              ) : form.targetType === "ROLE" ? (
                <select required value={form.targetId} onChange={f("targetId")}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:outline-none focus:border-orange-500">
                  <option value="">— select role —</option>
                  {["TEACHER","CLASS_TEACHER","ACCOUNTANT","LIBRARIAN","NURSE","HR_MANAGER","RECEPTIONIST","TRANSPORT_MANAGER","PARENT","STUDENT"].map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              ) : form.targetType === "GLOBAL" ? (
                <input value="global" disabled
                  className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700 text-slate-500 text-sm rounded-lg" />
              ) : (
                <input required value={form.targetId} onChange={f("targetId")}
                  placeholder="User ID"
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:outline-none focus:border-orange-500" />
              )}
            </div>
          </div>

          {/* Enable / disable toggle */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Action</label>
            <div className="flex gap-2">
              {[true, false].map(v => (
                <button key={String(v)} type="button" onClick={() => setForm(p => ({ ...p, isEnabled: v }))}
                  className={`px-4 py-2 text-xs rounded-lg font-medium border transition-colors ${
                    form.isEnabled === v
                      ? v ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                           : "bg-red-500/20 border-red-500 text-red-400"
                      : "bg-slate-800 border-slate-700 text-slate-400"
                  }`}>
                  {v ? "Enable" : "Disable"}
                </button>
              ))}
            </div>
          </div>

          {/* Activation mode */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Activation mode *</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "IMMEDIATE",     label: "Immediate",      desc: "Activates when approved" },
                { value: "SCHEDULED",     label: "Scheduled",      desc: "Activates at a set date" },
                { value: "TRIAL",         label: "Trial window",   desc: "Auto-expires after N days" },
                { value: "UPGRADE_GATED", label: "Upgrade-gated",  desc: "Revoked if school doesn't upgrade" },
              ].map(m => (
                <button key={m.value} type="button" onClick={() => setForm(p => ({ ...p, activationMode: m.value }))}
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    form.activationMode === m.value
                      ? "border-orange-500 bg-orange-500/10"
                      : "border-slate-700 hover:border-slate-600"
                  }`}>
                  <p className="text-xs font-semibold text-slate-200">{m.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{m.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Mode-specific fields */}
          {form.activationMode === "SCHEDULED" && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Activates at *</label>
              <input type="datetime-local" required value={form.activatesAt} onChange={f("activatesAt")}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:outline-none focus:border-orange-500" />
            </div>
          )}
          {form.activationMode === "TRIAL" && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Trial duration (days) *</label>
              <input type="number" required min={1} max={365} value={form.trialDays} onChange={f("trialDays")}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:outline-none focus:border-orange-500" />
            </div>
          )}
          {form.activationMode === "UPGRADE_GATED" && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Auto-revoke if not upgraded within (days) *</label>
              <input type="number" required min={1} max={365} value={form.autoRevokeIfNotUpgradedDays} onChange={f("autoRevokeIfNotUpgradedDays")}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:outline-none focus:border-orange-500" />
              <p className="text-xs text-slate-500 mt-1">Feature will be automatically revoked if the school does not upgrade their plan within this window.</p>
            </div>
          )}

          {/* Reason — required */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Reason for override * <span className="text-slate-600 font-normal">(logged in audit trail)</span></label>
            <textarea required value={form.requestReason} onChange={f("requestReason")} rows={3}
              placeholder="e.g. School is evaluating our AI features before upgrading to PRO. Sales approved 14-day trial."
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:outline-none focus:border-orange-500 resize-none" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2">
              {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Submit for Approval
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Approve / reject inline ────────────────────────────────────────────────────
function ApprovalActions({ request, onDone }: { request: OverrideRequest; onDone: () => void }) {
  const [acting, setActing]   = useState("");
  const [note,   setNote]     = useState("");
  const [reason, setReason]   = useState("");
  const [open,   setOpen]     = useState(false);

  const approve = async () => {
    setActing("approve");
    try {
      await api.patch(`/flags/requests/${request.id}/approve`, { approverNote: note || undefined });
      onDone();
    } catch (e: any) { alert(e.message); }
    finally { setActing(""); }
  };

  const reject = async () => {
    if (!reason.trim()) { alert("Rejection reason required"); return; }
    setActing("reject");
    try {
      await api.patch(`/flags/requests/${request.id}/reject`, { rejectionReason: reason });
      onDone();
    } catch (e: any) { alert(e.message); }
    finally { setActing(""); }
  };

  const revoke = async () => {
    if (!confirm("Revoke this approved override? The feature will be disabled immediately.")) return;
    setActing("revoke");
    try {
      await api.patch(`/flags/requests/${request.id}/revoke`, { revokeReason: reason || "Manually revoked by approver" });
      onDone();
    } catch (e: any) { alert(e.message); }
    finally { setActing(""); }
  };

  if (request.status === "PENDING") return (
    <div className="space-y-2">
      <input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional approval note"
        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg focus:outline-none focus:border-orange-500 placeholder-slate-600" />
      <div className="flex gap-2">
        <button onClick={approve} disabled={!!acting}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium rounded-lg hover:bg-emerald-500/20 disabled:opacity-50 transition-colors">
          <Check className="w-3 h-3" /> {acting === "approve" ? "Approving..." : "Approve"}
        </button>
        <button onClick={() => setOpen(!open)} className="px-3 py-2 bg-slate-800 border border-slate-700 text-slate-400 text-xs rounded-lg hover:bg-slate-700">
          Reject
        </button>
      </div>
      {open && (
        <div className="space-y-2">
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
            placeholder="Rejection reason (required)"
            className="w-full px-3 py-2 bg-slate-800 border border-red-500/30 text-slate-200 text-xs rounded-lg focus:outline-none resize-none placeholder-slate-600" />
          <button onClick={reject} disabled={!!acting}
            className="w-full py-2 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium rounded-lg hover:bg-red-500/20 disabled:opacity-50">
            {acting === "reject" ? "Rejecting..." : "Confirm Reject"}
          </button>
        </div>
      )}
    </div>
  );

  if (request.status === "APPROVED" || request.status === "ACTIVE") return (
    <div className="space-y-2">
      <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Revoke reason"
        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg focus:outline-none placeholder-slate-600" />
      <button onClick={revoke} disabled={!!acting}
        className="w-full flex items-center justify-center gap-1.5 py-2 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium rounded-lg hover:bg-red-500/20 disabled:opacity-50">
        <RotateCcw className="w-3 h-3" /> {acting === "revoke" ? "Revoking..." : "Revoke Override"}
      </button>
    </div>
  );

  return null;
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FeatureFlagsPage() {
  const [tab,         setTab]         = useState<"flags" | "requests">("flags");
  const [statusFilter,setStatusFilter]= useState("PENDING");
  const [showModal,   setShowModal]   = useState(false);
  const [expanded,    setExpanded]    = useState<string | null>(null);
  const [catFilter,   setCatFilter]   = useState("");

  const { data: flagsData, loading: fLoading } = useApi<FlagDef[]>("/flags/admin/all");
  const { data: requestsData, loading: rLoading, refetch } =
    useApi<{ data: OverrideRequest[]; meta: any }>(`/flags/requests?status=${statusFilter}`, [statusFilter]);
  const { data: tenantsData } = useApi<any>("/onboarding/tenants?limit=200");
  const { data: pending }     = useApi<{ count: number }>("/flags/requests/pending");

  const flags   = flagsData ?? [];
  const requests = requestsData?.data ?? [];
  const tenants  = tenantsData?.data ?? [];

  const filteredFlags = catFilter
    ? flags.filter(f => f.category === catFilter)
    : flags;

  return (
    <div>
      <PageHeader
        title="Feature Flags"
        subtitle="Module gating, per-tenant overrides and approval workflows"
        action={
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Request Override
          </button>
        }
      />

      {showModal && (
        <RequestModal
          flags={flags}
          tenants={tenants}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); refetch(); setTab("requests"); setStatusFilter("PENDING"); }}
        />
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-800">
        {[
          { key: "flags",    label: "All Flags",   icon: Shield },
          { key: "requests", label: `Approval Requests${pending?.count ? ` (${pending.count})` : ""}`, icon: Clock },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key as any)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === key
                ? "text-orange-400 border-orange-400"
                : "text-slate-500 border-transparent hover:text-slate-300"
            }`}>
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* FLAGS TAB */}
      {tab === "flags" && (
        <div>
          <div className="flex gap-2 mb-4">
            {["", "MODULE", "FEATURE", "SYSTEM"].map(c => (
              <button key={c} onClick={() => setCatFilter(c)}
                className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                  catFilter === c
                    ? "bg-orange-500/10 border-orange-500 text-orange-400"
                    : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600"
                }`}>
                {c || "All"} {c && `(${flags.filter(f => f.category === c).length})`}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {fLoading ? [...Array(6)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-800 rounded-xl animate-pulse" />
            )) : filteredFlags.map(flag => (
              <div key={flag.id} className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-800/30 transition-colors"
                  onClick={() => setExpanded(expanded === flag.id ? null : flag.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-slate-200">{flag.label}</p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${CATEGORY_COLOR[flag.category]}`}>
                        {flag.category}
                      </span>
                      {flag.allowedTiers.length > 0 && (
                        <span className="text-xs text-slate-500">{flag.allowedTiers.join(" · ")}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 font-mono">{flag.name}</p>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    {flag.overrides.length > 0 && (
                      <span className="text-xs text-amber-400">{flag.overrides.length} override{flag.overrides.length > 1 ? "s" : ""}</span>
                    )}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      flag.defaultValue ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-700 text-slate-400"
                    }`}>
                      default: {flag.defaultValue ? "ON" : "OFF"}
                    </span>
                    {expanded === flag.id ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </div>
                </div>

                {expanded === flag.id && (
                  <div className="border-t border-slate-800 px-5 py-4">
                    <p className="text-xs text-slate-500 mb-4">{flag.description}</p>
                    {flag.overrides.length === 0 ? (
                      <p className="text-xs text-slate-600">No active overrides — all tenants use the default value.</p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Active overrides</p>
                        {flag.overrides.map(ov => (
                          <div key={ov.id} className="flex items-center gap-3 bg-slate-800/50 rounded-lg px-4 py-2.5">
                            <span className="text-xs text-slate-400 font-mono">{ov.targetType}</span>
                            <span className="text-xs text-slate-300 font-mono truncate flex-1">{ov.targetId}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              ov.isEnabled ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                            }`}>
                              {ov.isEnabled ? "ON" : "OFF"}
                            </span>
                            {ov.expiresAt && (
                              <span className="text-xs text-amber-400">expires {formatDate(ov.expiresAt)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REQUESTS TAB */}
      {tab === "requests" && (
        <div>
          <div className="flex gap-2 mb-5">
            {["PENDING", "APPROVED", "REJECTED", "CANCELLED", "REVOKED", "EXPIRED"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-2 text-xs rounded-lg border font-medium transition-colors ${
                  statusFilter === s
                    ? "bg-orange-500/10 border-orange-500 text-orange-400"
                    : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600"
                }`}>
                {s}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {rLoading ? [...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-slate-800 rounded-xl animate-pulse" />
            )) : requests.length === 0 ? (
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-12 text-center">
                <Clock className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">No {statusFilter.toLowerCase()} requests</p>
              </div>
            ) : requests.map(req => (
              <div key={req.id} className="bg-slate-900 rounded-xl border border-slate-800 p-5">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${CATEGORY_COLOR[req.flag.category] ?? ""}`}>
                        {req.flag.category}
                      </span>
                      <p className="text-sm font-semibold text-slate-200">{req.flag.label}</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        req.isEnabled ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                      }`}>
                        {req.isEnabled ? "ENABLE" : "DISABLE"}
                      </span>
                      <Badge label={req.status} variant={STATUS_VARIANT[req.status] ?? "neutral"} />
                    </div>

                    <p className="text-xs text-slate-500 font-mono">
                      {req.targetType} → {req.targetName ?? req.targetId}
                    </p>

                    <div className="flex items-center gap-4 mt-2 flex-wrap text-xs text-slate-500">
                      <span>Mode: <strong className="text-slate-300">{MODE_LABEL[req.activationMode]}</strong>
                        {req.trialDays             && ` · ${req.trialDays}d trial`}
                        {req.autoRevokeIfNotUpgradedDays && ` · revoke after ${req.autoRevokeIfNotUpgradedDays}d if no upgrade`}
                      </span>
                      <span>Requested {formatRelative(req.requestedAt)}</span>
                      {req.approvedAt  && <span className="text-emerald-400">Approved {formatRelative(req.approvedAt)}</span>}
                      {req.rejectionReason && <span className="text-red-400">Rejected: {req.rejectionReason}</span>}
                      {req.revokeReason    && <span className="text-red-400">Revoked: {req.revokeReason}</span>}
                    </div>

                    <div className="mt-2 bg-slate-800/50 rounded-lg px-3 py-2">
                      <p className="text-xs text-slate-400 italic">"{req.requestReason}"</p>
                    </div>

                    {req.approverNote && (
                      <div className="mt-2 bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2">
                        <p className="text-xs text-emerald-400">Approver note: {req.approverNote}</p>
                      </div>
                    )}
                  </div>

                  {/* Approval actions */}
                  <div className="w-52 flex-shrink-0">
                    <ApprovalActions request={req} onDone={refetch} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

