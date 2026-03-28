"use client";
import { use }              from "react";
import { useRouter }        from "next/navigation";
import { useState }         from "react";
import { ArrowLeft, ExternalLink, Shield, CreditCard, Users, KeyRound, Receipt, ChevronDown, ChevronUp } from "lucide-react";
import { Badge }            from "@/components/ui/badge";
import { useApi, Tenant }   from "@/lib/hooks";
import { formatDate, formatCurrency } from "@/lib/utils";
import { api }              from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────
interface BillingInvoice {
  id:            string;
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
  paidAt:        string | null;
  pdfUrl:        string | null;
  payments:      { id: string; gateway: string; amount: number; status: string; paidAt: string | null }[];
  createdAt:     string;
}

interface BillingData {
  subscription:     any;
  invoices:         BillingInvoice[];
  totalPaid:        number;
  totalOutstanding: number;
  totalInvoices:    number;
}

// ── Feature flags list ────────────────────────────────────────────────────────
const FEATURE_FLAGS = [
  "FEATURE_AI_SMART_REMINDERS",
  "FEATURE_AI_DROPOUT_PREDICTION",
  "FEATURE_AI_CHATBOT",
  "FEATURE_BILLING_INSTALLMENT_PLANS",
  "FEATURE_BILLING_HYBRID_PRICING",
  "FEATURE_REPORTING_AI_INSIGHTS",
  "FEATURE_INTEGRATIONS_WHATSAPP",
];

// ── Helpers ───────────────────────────────────────────────────────────────────
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

// ── Billing Tab ───────────────────────────────────────────────────────────────
function BillingTab({ tenantId }: { tenantId: string }) {
  const { data, loading, error } = useApi<BillingData>(`/superadmin/tenants/${tenantId}/billing`);
  const [expanded, setExpanded]  = useState<string | null>(null);

  if (loading) return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-16 bg-slate-800 rounded-xl animate-pulse" />
      ))}
    </div>
  );

  if (error) return (
    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5 text-red-400 text-sm">
      Failed to load billing history: {error}
    </div>
  );

  if (!data?.subscription) return (
    <div className="bg-slate-800/50 rounded-xl p-8 text-center">
      <CreditCard className="w-8 h-8 text-slate-600 mx-auto mb-3" />
      <p className="text-slate-400 text-sm font-medium">No subscription found</p>
      <p className="text-slate-600 text-xs mt-1">This tenant has not been assigned a pricing plan yet.</p>
    </div>
  );

  const sub = data.subscription;
  const cur = sub.currency ?? "INR";

  return (
    <div className="space-y-5">
      {/* Subscription summary */}
      <div className="bg-slate-800/50 rounded-xl p-5">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">Current Subscription</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Plan",    value: sub.plan?.name ?? "—" },
            { label: "Model",   value: sub.model },
            { label: "Status",  value: sub.status },
            { label: "Currency",value: cur },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">{label}</p>
              <p className="text-sm font-semibold text-slate-200 mt-1">{value}</p>
            </div>
          ))}
        </div>
        {/* Rate info */}
        <div className="mt-4 pt-4 border-t border-slate-700 flex flex-wrap gap-6 text-xs text-slate-400">
          {sub.customPerStudentRate != null && (
            <span>Custom per-student rate: <strong className="text-slate-200">{formatCurrency(sub.customPerStudentRate, cur)}</strong></span>
          )}
          {sub.customBaseFee != null && (
            <span>Custom base fee: <strong className="text-slate-200">{formatCurrency(sub.customBaseFee, cur)}</strong></span>
          )}
          {sub.studentCountAtBilling != null && (
            <span>Students at last billing: <strong className="text-slate-200">{sub.studentCountAtBilling}</strong></span>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total invoices",   value: String(data.totalInvoices),                        color: "text-white"       },
          { label: "Total paid",       value: formatCurrency(data.totalPaid, cur),                color: "text-emerald-400" },
          { label: "Outstanding",      value: formatCurrency(data.totalOutstanding, cur),         color: data.totalOutstanding > 0 ? "text-red-400" : "text-emerald-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-slate-800/50 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Invoice list */}
      {data.invoices.length === 0 ? (
        <div className="bg-slate-800/30 rounded-xl p-8 text-center">
          <Receipt className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No invoices yet</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 overflow-hidden">
          {data.invoices.map((inv) => (
            <div key={inv.id} className="border-b border-slate-800 last:border-0">
              {/* Invoice row */}
              <div
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-800/30 cursor-pointer transition-colors"
                onClick={() => setExpanded(expanded === inv.id ? null : inv.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-xs text-slate-400">{inv.invoiceNumber}</p>
                    <Badge label={inv.status} variant={invoiceStatusVariant(inv.status)} />
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}
                    {inv.studentCount != null && ` · ${inv.studentCount} students`}
                  </p>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-slate-200">
                    {formatCurrency(inv.totalAmount, inv.currency)}
                  </p>
                  {inv.dueAmount > 0 && (
                    <p className="text-xs text-red-400">
                      {formatCurrency(inv.dueAmount, inv.currency)} due
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {inv.pdfUrl && (
                    <a
                      href={inv.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
                    >
                      PDF
                    </a>
                  )}
                  {expanded === inv.id
                    ? <ChevronUp className="w-4 h-4 text-slate-500" />
                    : <ChevronDown className="w-4 h-4 text-slate-500" />
                  }
                </div>
              </div>

              {/* Expanded payment breakdown */}
              {expanded === inv.id && (
                <div className="px-5 pb-4 bg-slate-900/50">
                  <div className="border-t border-slate-800 pt-4 space-y-3">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Due date</span>
                      <span className={new Date(inv.dueDate) < new Date() && inv.status !== "PAID" ? "text-red-400" : "text-slate-400"}>
                        {formatDate(inv.dueDate)}
                      </span>
                    </div>
                    {inv.paidAt && (
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>Paid at</span>
                        <span className="text-emerald-400">{formatDate(inv.paidAt)}</span>
                      </div>
                    )}
                    {inv.payments.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Payments</p>
                        <div className="space-y-1.5">
                          {inv.payments.map((p) => (
                            <div key={p.id} className="flex justify-between text-xs">
                              <span className="text-slate-400">{p.gateway} · {p.status}</span>
                              <span className={p.status === "SUCCESS" ? "text-emerald-400 font-medium" : "text-slate-500"}>
                                {formatCurrency(p.amount, inv.currency)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }    = use(params);
  const router    = useRouter();
  const { data: tenant, loading, refetch } = useApi<Tenant>(`/onboarding/tenants/${id}`);
  const [actionLoading, setActionLoading]  = useState("");
  const [activeTab, setActiveTab]          = useState<"overview" | "billing" | "flags">("overview");

  const updateStatus = async (status: "ACTIVE" | "SUSPENDED" | "CANCELLED") => {
    setActionLoading(status);
    try {
      await api.patch(`/onboarding/tenants/${id}/status`, { status });
      refetch();
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(""); }
  };

  const resetPassword = async () => {
    const password = window.prompt("Enter a new temporary password for the school admin");
    if (!password) return;
    setActionLoading("reset-password");
    try {
      const result = await api.post<{ adminEmail: string }>(`/onboarding/tenants/${id}/reset-password`, { password });
      alert(`Password reset for ${result.adminEmail}`);
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(""); }
  };

  const toggleFlag = async (flag: string, enabled: boolean) => {
    try {
      await api.patch(`/tenant-admin/${id}/toggle-feature`, { flag, enabled });
      refetch();
    } catch (e: any) { alert(e.message); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!tenant) return <div className="text-slate-400 text-center py-24">Tenant not found</div>;

  const sub        = tenant.subscription;
  const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL ?? "http://localhost:4000";

  return (
    <div>
      {/* Back */}
      <button onClick={() => router.push("/dashboard/tenants")}
        className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to tenants
      </button>

      {/* Header */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 text-xl font-bold">
              {tenant.name[0]}
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{tenant.name}</h1>
              <p className="text-slate-400 text-sm">{tenant.slug} · {tenant.contactEmail}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge label={tenant.status}      variant={statusVariant(tenant.status)} />
                <Badge label={tenant.featureTier} variant="purple" />
                <Badge label={tenant.region}      variant="neutral" />
                <Badge label={tenant.currency}    variant="neutral" />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap justify-end">
            {tenant.status === "ACTIVE" && (
              <button onClick={() => updateStatus("SUSPENDED")} disabled={!!actionLoading}
                className="px-3 py-1.5 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg hover:bg-amber-500/20 transition-colors disabled:opacity-50">
                Suspend
              </button>
            )}
            {tenant.status === "SUSPENDED" && (
              <button onClick={() => updateStatus("ACTIVE")} disabled={!!actionLoading}
                className="px-3 py-1.5 text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors disabled:opacity-50">
                Reactivate
              </button>
            )}
            {tenant.status === "TRIAL" && (
              <button onClick={() => updateStatus("ACTIVE")} disabled={!!actionLoading}
                className="px-3 py-1.5 text-xs bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors disabled:opacity-50">
                Convert to Active
              </button>
            )}
            <button onClick={resetPassword} disabled={!!actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50">
              <KeyRound className="w-3 h-3" /> Reset Password
            </button>
            <a href={`${frontendUrl}?tenant=${tenant.slug}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors">
              <ExternalLink className="w-3 h-3" /> Open School
            </a>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 mb-6">
        {([
          { key: "overview", label: "Overview",       icon: Users       },
          { key: "billing",  label: "Billing History", icon: CreditCard  },
          { key: "flags",    label: "Feature Flags",   icon: Shield      },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === key
                ? "text-orange-400 border-orange-400"
                : "text-slate-500 border-transparent hover:text-slate-300"
            }`}>
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Subscription */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-4 h-4 text-slate-500" />
              <h2 className="font-semibold text-slate-200">Subscription</h2>
            </div>
            {sub ? (
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Model",        value: sub.model },
                  { label: "Status",       value: sub.status },
                  { label: "Plan",         value: sub.plan?.name ?? "—" },
                  { label: "Currency",     value: sub.currency },
                  { label: "Period Start", value: formatDate(sub.currentPeriodStart) },
                  { label: "Period End",   value: formatDate(sub.currentPeriodEnd) },
                  { label: "Trial Ends",   value: sub.trialEndsAt ? formatDate(sub.trialEndsAt) : "N/A" },
                  { label: "Students",     value: sub.studentCountAtBilling ?? "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-800/50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">{label}</p>
                    <p className="text-sm font-semibold text-slate-200 mt-1">{String(value)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">No active subscription</p>
            )}
          </div>

          {/* School info + admins */}
          <div className="space-y-5">
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-slate-500" />
                <h2 className="font-semibold text-slate-200">School Info</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Max Students", value: tenant.maxStudents },
                  { label: "Timezone",     value: tenant.timezone ?? "—" },
                  { label: "GST Number",   value: tenant.gstNumber ?? "—" },
                  { label: "Created",      value: formatDate(tenant.createdAt) },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-800/50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">{label}</p>
                    <p className="text-sm font-semibold text-slate-200 mt-1">{String(value)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-slate-500" />
                <h2 className="font-semibold text-slate-200">Admin Access</h2>
              </div>
              {tenant.users?.length ? (
                <div className="space-y-3">
                  {tenant.users.map((admin) => (
                    <div key={admin.email} className="bg-slate-800/50 rounded-lg p-3">
                      <p className="text-sm font-semibold text-slate-200">{admin.firstName} {admin.lastName}</p>
                      <p className="text-xs text-orange-400 mt-1">{admin.email}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Last login: {admin.lastLoginAt ? formatDate(admin.lastLoginAt) : "Never"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm">No active school admin found</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "billing" && <BillingTab tenantId={id} />}

      {activeTab === "flags" && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 max-w-lg">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold text-slate-200">Feature Flags</h2>
          </div>
          <div className="space-y-1">
            {FEATURE_FLAGS.map((flag) => {
              const short   = flag.replace("FEATURE_", "").replace(/_/g, " ").toLowerCase();
              const enabled = false; // TODO: read from tenant.featureFlags once endpoint returns them
              return (
                <div key={flag} className="flex items-center justify-between py-3 border-b border-slate-800 last:border-0">
                  <div>
                    <p className="text-sm text-slate-300 capitalize">{short}</p>
                    <p className="text-xs text-slate-600 font-mono">{flag}</p>
                  </div>
                  <button
                    onClick={() => toggleFlag(flag, !enabled)}
                    className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                      enabled ? "bg-orange-500" : "bg-slate-700"
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      enabled ? "translate-x-5" : "translate-x-0.5"
                    }`} />
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-600 mt-3">
            Toggle changes take effect immediately for the tenant.
          </p>
        </div>
      )}
    </div>
  );
}
