"use client";
import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, ExternalLink, Shield, CreditCard, Users, KeyRound, ScrollText, Terminal, X, CheckCircle, Search, Filter } from "lucide-react";
import { Badge }            from "@/components/ui/badge";
import { useApi, Tenant }   from "@/lib/hooks";
import { formatDate, formatCurrency } from "@/lib/utils";
import { api }              from "@/lib/api";
import { useToast }         from "@/components/ui/use-toast";

interface BillingInvoice {
  id:             string;
  invoiceNumber: string;
  status:        string;
  currency:      string;
  totalAmount:   number;
  paidAmount:    number;
  dueAmount:     number;
  periodStart:   string;
  periodEnd:     string;
  studentCount:  number | null;
  dueDate:       string;
  pdfUrl:        string | null;
  payments:      any[];
  createdAt:     string;
}

interface BillingData {
  subscription:      any;
  invoices:          BillingInvoice[];
  totalPaid:         number;
  totalOutstanding: number;
  totalInvoices:     number;
}

const FEATURE_FLAGS = [
  "FEATURE_AI_SMART_REMINDERS",
  "FEATURE_AI_DROPOUT_PREDICTION",
  "FEATURE_AI_CHATBOT",
  "FEATURE_BILLING_INSTALLMENT_PLANS",
  "FEATURE_BILLING_HYBRID_PRICING",
  "FEATURE_REPORTING_AI_INSIGHTS",
  "FEATURE_INTEGRATIONS_WHATSAPP",
];

function statusVariant(s: string) {
  if (s === "ACTIVE")    return "success" as const;
  if (s === "TRIAL")     return "info" as const;
  if (s === "SUSPENDED") return "warning" as const;
  return "error" as const;
}

function invoiceStatusVariant(s: string) {
  if (s === "PAID")           return "success" as const;
  if (s === "SENT")           return "info" as const;
  if (s === "OVERDUE")        return "error" as const;
  if (s === "PARTIALLY_PAID") return "warning" as const;
  return "neutral" as const;
}

// ── Tab Components ───────────────────────────────────────────────────────────
function BillingTab({ tenantId }: { tenantId: string }) {
  const { data, loading, error } = useApi<BillingData>(`/superadmin/tenants/${tenantId}/billing`);

  if (loading) return <div className="space-y-2"><div className="h-20 bg-slate-800 rounded-xl animate-pulse w-full" /></div>;
  if (error) return <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">Failed to load billing history ledger.</div>;
  if (!data?.subscription) return <div className="text-slate-500 text-xs py-4">No subscription found.</div>;

  const sub = data.subscription;
  const cur = sub.currency ?? "INR";

  return (
    <div className="space-y-4 font-mono text-xs">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800/40 p-4 rounded-xl">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Paid Invoices</p>
          <p className="text-lg font-bold text-emerald-400 mt-1">{formatCurrency(data.totalPaid, cur)}</p>
        </div>
        <div className="bg-slate-800/40 p-4 rounded-xl">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Outstanding Due</p>
          <p className="text-lg font-bold text-red-400 mt-1">{formatCurrency(data.totalOutstanding, cur)}</p>
        </div>
        <div className="bg-slate-800/40 p-4 rounded-xl">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Total Count</p>
          <p className="text-lg font-bold text-white mt-1">{data.totalInvoices}</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/20">
        {data.invoices.map(inv => (
          <div key={inv.id} className="border-b border-slate-800 last:border-0 p-4 flex justify-between items-center hover:bg-slate-800/20 transition-colors">
            <div>
              <span className="text-slate-300 font-bold">{inv.invoiceNumber}</span>
              <span className="ml-2"><Badge label={inv.status} variant={invoiceStatusVariant(inv.status)} /></span>
            </div>
            <span className="text-slate-200 font-black">{formatCurrency(inv.totalAmount, inv.currency)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditLogTab({ tenantId }: { tenantId: string }) {
  const [actionFilter, setActionFilter] = useState("");
  const [actorQuery, setActorQuery] = useState("");
  
  const { data, loading } = useApi<any>(
    `/superadmin/audit-logs?tenantId=${tenantId}${actionFilter ? `&action=${actionFilter}` : ""}`
  );

  const localFilteredLogs = useMemo(() => {
    if (!data?.logs) return [];
    return data.logs.filter((log: any) => 
      (log.actorEmail ?? "").toLowerCase().includes(actorQuery.toLowerCase())
    );
  }, [data, actorQuery]);

  if (loading) return <div className="h-20 bg-slate-800 animate-pulse rounded-xl" />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 pointer-events-none" />
          <input 
            type="text"
            placeholder="Filter logs by actor email..."
            value={actorQuery}
            onChange={(e) => setActorQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none"
          />
        </div>
        <div className="relative flex items-center">
          <Filter className="w-3.5 h-3.5 text-slate-500 absolute left-3 pointer-events-none" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 focus:outline-none"
          >
            <option value="">All Operational Actions</option>
            <option value="LOGIN">LOGIN</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>
      </div>

      <div className="space-y-2 font-mono text-[11px] bg-slate-950 p-4 rounded-xl border border-slate-800 max-h-[350px] overflow-y-auto scrollbar-none">
        {localFilteredLogs.length > 0 ? (
          localFilteredLogs.map((log: any) => (
            <div key={log.id} className="py-1.5 border-b border-slate-900 last:border-0 flex justify-between gap-4 text-slate-400">
              <div>
                <span className="text-orange-400 font-bold">[{log.action}]</span>{" "}
                <span className="text-slate-300">{log.actorEmail ?? "system"}</span>{" -> "}<span className="text-blue-400">{log.entityType}</span>
              </div>
              <span className="text-slate-600 shrink-0">{formatDate(log.createdAt)}</span>
            </div>
          ))
        ) : <p className="text-slate-600 text-xs italic">No matching stream records found.</p>}
      </div>
    </div>
  );
}

// ── Main Shell Page ───────────────────────────────────────────────────────────
export default function TenantDetailPage() {
  const router = useRouter();
  const { toast } = useToast();
  const params = useParams();
  const id = params.id as string;

  const { data: tenant, loading, refetch } = useApi<Tenant>(`/onboarding/tenants/${id}`);
  
  const [actionLoading, setActionLoading] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "billing" | "flags" | "audit">("overview");
  const [localFlags, setLocalFlags] = useState<Record<string, boolean>>({});
  
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [tempPasswordInput, setTempPasswordInput] = useState("");
  const [reasonImpersonateInput, setReasonImpersonateInput] = useState("");
  const [isImpersonatingMode, setIsImpersonatingMode] = useState(false);

  useEffect(() => {
    const tenantObj = tenant as any;
    if (tenantObj?.featureFlags) {
      const flagsMap: Record<string, boolean> = {};
      FEATURE_FLAGS.forEach(flag => {
        flagsMap[flag] = Array.isArray(tenantObj.featureFlags) 
          ? tenantObj.featureFlags.includes(flag) 
          : !!tenantObj.featureFlags[flag];
      });
      setLocalFlags(flagsMap);
    }
  }, [tenant]);

  const updateStatus = async (status: "ACTIVE" | "SUSPENDED" | "CANCELLED") => {
    setActionLoading(status);
    try {
      await api.patch(`/onboarding/tenants/${id}/status`, { status });
      toast({ description: `Tenant status updated to ${status}.` });
      refetch();
    } catch (e: any) { 
      toast({ description: e.message || "Failed to update tenant status.", variant: "destructive" });
    } finally { 
      setActionLoading(""); 
    }
  };

  const executeSecurePasswordReset = async () => {
    if (!tempPasswordInput.trim()) {
      toast({ description: "Password cannot be empty.", variant: "destructive" });
      return;
    }
    setActionLoading("reset-password");
    try {
      const result = await api.post<{ adminEmail: string }>(`/onboarding/tenants/${id}/reset-password`, { password: tempPasswordInput });
      toast({ description: `Credentials mapped for admin: ${result.adminEmail}` });
      setIsResetModalOpen(false);
      setTempPasswordInput("");
    } catch (e: any) { 
      toast({ description: e.message || "Handshake encryption failure.", variant: "destructive" });
    } finally { 
      setActionLoading(""); 
    }
  };

  const handleLaunchImpersonationToken = async () => {
    if (!reasonImpersonateInput.trim()) {
      toast({ description: "Impersonation reason statement is required.", variant: "destructive" });
      return;
    }
    setIsImpersonatingMode(true);
    try {
      const res = await api.post<any>(`/superadmin/impersonate/${id}`, { reason: reasonImpersonateInput });
      toast({ description: "Redirecting to school workspace dashboard..." });
      if (res.token) {
        localStorage.setItem("accessToken", res.token);
        localStorage.setItem("token", res.token);
        window.open(res.frontendUrl || "/login", "_blank");
      }
    } catch (e: any) {
      toast({ description: e.message || "Impersonation authorization rejected.", variant: "destructive" });
    } finally {
      setIsImpersonatingMode(false);
    }
  };

  const toggleFlag = async (flag: string, enabled: boolean) => {
    setLocalFlags(prev => ({ ...prev, [flag]: enabled }));
    try {
      await api.patch(`/tenant-admin/${id}/toggle-feature`, {
        feature: flag,
        value: enabled,
      });
      toast({ description: `Feature toggled successfully: ${flag}` });
      refetch();
    } catch (e: any) {
      toast({ description: "Rollback triggered: Core transaction failed.", variant: "destructive" });
      setLocalFlags(prev => ({ ...prev, [flag]: !enabled }));
    }
  };

  if (loading) return <div className="py-24 text-center text-xs font-mono animate-pulse text-slate-500">Loading tenant details...</div>;
  if (!tenant) return <div className="text-slate-400 font-mono text-center py-24">Tenant not found.</div>;

  const sub = tenant.subscription;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto font-sans antialiased bg-slate-950 text-slate-100 min-h-screen relative">
      
      <button onClick={() => router.push("/dashboard/tenants")} className="flex items-center gap-2 text-slate-500 hover:text-slate-300 text-xs font-mono transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Tenants
      </button>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-black tracking-tight text-white">{tenant.name}</h1>
          <p className="text-xs text-slate-400 font-mono mt-1">{tenant.slug} · {tenant.contactEmail}</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            <Badge label={tenant.status} variant={statusVariant(tenant.status)} />
            <Badge label={tenant.featureTier} variant="purple" />
            <Badge label={tenant.region} variant="neutral" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-end w-full md:w-auto">
          {tenant.status === "ACTIVE" && <button onClick={() => updateStatus("SUSPENDED")} className="px-3 py-1.5 text-xs font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl hover:bg-amber-500/20 transition-all">Suspend Tenant</button>}
          {tenant.status === "SUSPENDED" && <button onClick={() => updateStatus("ACTIVE")} className="px-3 py-1.5 text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500/20 transition-all">Reactivate Tenant</button>}
          <button onClick={() => setIsResetModalOpen(true)} className="px-3 py-1.5 text-xs font-bold bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 flex items-center gap-1.5 transition-all"><KeyRound className="w-3.5 h-3.5" /> Reset Password</button>
        </div>
      </div>

      <div className="flex border-b border-slate-800/80 overflow-x-auto whitespace-nowrap scrollbar-none font-mono text-xs">
        {([
          { key: "overview", label: "Overview", icon: Users },
          { key: "billing", label: "Billing History", icon: CreditCard },
          { key: "flags", label: "Feature Flags", icon: Shield },
          { key: "audit", label: "Audit Logs", icon: ScrollText }
        ] as const).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)} className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold transition-all -mb-px ${activeTab === key ? "text-orange-400 border-orange-400 bg-orange-500/[0.02]" : "text-slate-500 border-transparent hover:text-slate-300"}`}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Subscription Details</h3>
              {sub ? (
                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  {[
                    { l: "Pricing Model", v: sub.model },
                    { l: "Status", v: sub.status },
                    { l: "Assigned Plan", v: sub.plan?.name ?? "—" },
                    { l: "Period End", v: formatDate(sub.currentPeriodEnd) }
                  ].map(item => (
                    <div key={item.l} className="p-3 bg-slate-950/40 border border-slate-800/60 rounded-xl">
                      <span className="text-slate-500 block mb-1">{item.l}</span>
                      <span className="text-slate-200 font-bold">{item.v}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-slate-500 text-xs">No active pricing plan bound.</p>}
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">School Capacity</h3>
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                {[
                  { l: "Max Students", v: tenant.maxStudents },
                  { l: "Timezone", v: tenant.timezone ?? "UTC" },
                  { l: "GST Number", v: tenant.gstNumber ?? "Unregistered" },
                  { l: "Created At", v: formatDate(tenant.createdAt) }
                ].map(item => (
                  <div key={item.l} className="p-3 bg-slate-950/40 border border-slate-800/60 rounded-xl">
                    <span className="text-slate-500 block mb-1">{item.l}</span>
                    <span className="text-slate-200 font-bold">{item.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl h-fit space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1"><Terminal className="w-3.5 h-3.5 text-orange-400" /> Impersonation</h3>
            <p className="text-[11px] text-slate-400 font-mono leading-normal">
              Launch a temporary session as the school's administrator. All actions are logged for auditing.
            </p>
            <textarea
              placeholder="Provide a valid maintenance reference reason statement context track..."
              value={reasonImpersonateInput}
              onChange={(e) => setReasonImpersonateInput(e.target.value)}
              className="w-full h-20 p-2.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs focus:outline-none focus:border-slate-700 text-slate-200 resize-none"
            />
            <button
              onClick={handleLaunchImpersonationToken}
              disabled={isImpersonatingMode}
              className="w-full py-2 bg-orange-500 hover:bg-orange-600 font-black text-xs text-slate-950 rounded-xl flex items-center justify-center gap-1.5 uppercase tracking-wider disabled:opacity-50 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" /> {isImpersonatingMode ? "Verifying..." : "Launch Session"}
            </button>
          </div>
        </div>
      )}

      {activeTab === "billing" && <BillingTab tenantId={id} />}
      {activeTab === "audit" && <AuditLogTab tenantId={id} />}

      {activeTab === "flags" && (
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl max-w-xl">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> Feature Toggles Control System</h3>
          <div className="divide-y divide-slate-800/60">
            {FEATURE_FLAGS.map((flag) => {
              const short = flag.replace("FEATURE_", "").replace(/_/g, " ").toLowerCase();
              const enabled = !!localFlags[flag];
              return (
                <div key={flag} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-xs font-bold text-slate-200 capitalize">{short}</p>
                    <p className="text-[10px] text-slate-600 font-mono mt-0.5">{flag}</p>
                  </div>
                  <button onClick={() => toggleFlag(flag, !enabled)} className={`w-9 h-5 rounded-full relative transition-colors ${enabled ? "bg-orange-500" : "bg-slate-800 border border-slate-700"}`}>
                    <span className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isResetModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-xs uppercase font-mono font-black tracking-widest text-slate-400 flex items-center gap-1.5"><KeyRound className="w-4 h-4 text-orange-400" /> Reset Password</h3>
              <button onClick={() => setIsResetModalOpen(false)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-200"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-mono text-slate-500 font-bold block">New Temporary Password</label>
              <input
                type="password"
                placeholder="••••••••••••"
                value={tempPasswordInput}
                onChange={(e) => setTempPasswordInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono focus:outline-none focus:border-slate-600 text-slate-100"
              />
            </div>
            <div className="flex gap-2 pt-2 text-xs font-bold font-mono">
              <button onClick={() => setIsResetModalOpen(false)} className="flex-1 py-2 border border-slate-700 rounded-xl hover:bg-slate-800 text-slate-400 transition-all">Cancel</button>
              <button onClick={executeSecurePasswordReset} disabled={actionLoading === "reset-password"} className="flex-1 py-2 bg-orange-500 text-slate-950 font-black rounded-xl hover:bg-orange-600 transition-all flex items-center justify-center gap-1">{actionLoading === "reset-password" ? "Encrypting..." : <><CheckCircle className="w-3.5 h-3.5" /> Confirm Reset</>}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
