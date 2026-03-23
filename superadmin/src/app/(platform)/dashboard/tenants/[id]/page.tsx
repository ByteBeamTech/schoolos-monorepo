"use client";
import { use }              from "react";
import { useRouter }        from "next/navigation";
import { ArrowLeft, ExternalLink, Shield, CreditCard, Users, KeyRound } from "lucide-react";
import { Badge }            from "@/components/ui/badge";
import { useApi, Tenant }   from "@/lib/hooks";
import { formatDate }       from "@/lib/utils";
import { api }              from "@/lib/api";
import { useState }         from "react";

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

export default function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }    = use(params);
  const router    = useRouter();
  const { data: tenant, loading, refetch } = useApi<Tenant>(`/onboarding/tenants/${id}`);
  const [actionLoading, setActionLoading] = useState("");

  const updateStatus = async (status: "ACTIVE" | "SUSPENDED" | "CANCELLED") => {
    setActionLoading(status);
    try {
      await api.patch(`/onboarding/tenants/${id}/status`, { status });
      refetch();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading("");
    }
  };

  const resetPassword = async () => {
    const password = window.prompt("Enter a new temporary password for the school admin");
    if (!password) return;

    setActionLoading("reset-password");
    try {
      const result = await api.post<{ adminEmail: string }>(`/onboarding/tenants/${id}/reset-password`, { password });
      alert(`Password reset for ${result.adminEmail}`);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading("");
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!tenant) return <div className="text-slate-400 text-center py-24">Tenant not found</div>;

  const sub = tenant.subscription;

  return (
    <div>
      {/* Back */}
      <button onClick={() => router.push("/dashboard/tenants")}
        className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to tenants
      </button>

      {/* Header */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 text-xl font-bold">
              {tenant.name[0]}
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{tenant.name}</h1>
              <p className="text-slate-400 text-sm">{tenant.slug} · {tenant.contactEmail}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge label={tenant.status}      variant={statusVariant(tenant.status)} />
                <Badge label={tenant.featureTier} variant="purple" />
                <Badge label={tenant.region}      variant="neutral" />
                <Badge label={tenant.currency}    variant="neutral" />
              </div>
            </div>
          </div>
          {/* Actions */}
          <div className="flex gap-2 flex-wrap justify-end">
            {tenant.status === "ACTIVE" && (
              <button
                onClick={() => updateStatus("SUSPENDED")}
                disabled={!!actionLoading}
                className="px-3 py-1.5 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg hover:bg-amber-500/20 transition-colors disabled:opacity-50"
              >
                Suspend
              </button>
            )}
            {tenant.status === "SUSPENDED" && (
              <button
                onClick={() => updateStatus("ACTIVE")}
                disabled={!!actionLoading}
                className="px-3 py-1.5 text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
              >
                Reactivate
              </button>
            )}
            {tenant.status === "TRIAL" && (
              <button
                onClick={() => updateStatus("ACTIVE")}
                disabled={!!actionLoading}
                className="px-3 py-1.5 text-xs bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors disabled:opacity-50"
              >
                Convert to Active
              </button>
            )}
            <button
              onClick={resetPassword}
              disabled={!!actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              <KeyRound className="w-3 h-3" /> Reset Admin Password
            </button>
            <a
              href={`http://${tenant.slug}.schoolos.com`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> Open School
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subscription */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-4 h-4 text-slate-500" />
              <h2 className="font-semibold text-slate-200">Subscription</h2>
            </div>
            {sub ? (
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Model",       value: sub.model },
                  { label: "Status",      value: sub.status },
                  { label: "Plan",        value: sub.plan?.name ?? "—" },
                  { label: "Currency",    value: sub.currency },
                  { label: "Period Start",value: formatDate(sub.currentPeriodStart) },
                  { label: "Period End",  value: formatDate(sub.currentPeriodEnd) },
                  { label: "Trial Ends",  value: sub.trialEndsAt ? formatDate(sub.trialEndsAt) : "N/A" },
                  { label: "Students",    value: sub.studentCountAtBilling ?? "—" },
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

          {/* School details */}
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
                    <p className="text-sm font-semibold text-slate-200">
                      {admin.firstName} {admin.lastName}
                    </p>
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

        {/* Feature flags */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold text-slate-200">Feature Flags</h2>
          </div>
          <div className="space-y-2">
            {FEATURE_FLAGS.map(flag => {
              const short = flag.replace("FEATURE_", "").replace(/_/g, " ").toLowerCase();
              return (
                <div key={flag} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                  <p className="text-xs text-slate-400 capitalize flex-1 pr-2">{short}</p>
                  <div className="w-8 h-4 bg-slate-700 rounded-full cursor-pointer hover:bg-slate-600 transition-colors flex-shrink-0" title="Toggle (coming soon)" />
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-600 mt-3">Toggle support coming in next build</p>
        </div>
      </div>
    </div>
  );
}
