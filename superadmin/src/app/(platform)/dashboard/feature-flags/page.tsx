"use client";
import { useState }  from "react";
import { useApi }    from "@/lib/hooks";
import { api }       from "@/lib/api";

const FLAGS = [
  { key: "FEATURE_AI_SMART_REMINDERS",      label: "AI Smart Reminders",      desc: "Auto-generate fee reminder messages" },
  { key: "FEATURE_AI_DROPOUT_PREDICTION",   label: "AI Dropout Prediction",   desc: "Flag students at risk of dropping out" },
  { key: "FEATURE_AI_CHATBOT",              label: "AI Parent Chatbot",        desc: "WhatsApp bot for parent queries" },
  { key: "FEATURE_BILLING_INSTALLMENT_PLANS",label: "Installment Plans",      desc: "Allow fee payment in parts" },
  { key: "FEATURE_BILLING_HYBRID_PRICING",  label: "Hybrid Pricing",          desc: "Base fee + per-student combined" },
  { key: "FEATURE_REPORTING_AI_INSIGHTS",   label: "AI Report Insights",      desc: "GPT-generated analysis on reports" },
  { key: "FEATURE_INTEGRATIONS_WHATSAPP",   label: "WhatsApp Integration",    desc: "Send messages via WhatsApp Business" },
  { key: "FEATURE_BIOMETRIC_ATTENDANCE",    label: "Biometric Attendance",    desc: "Fingerprint / RFID attendance marking" },
  { key: "FEATURE_PARENT_PORTAL",           label: "Parent Portal",           desc: "Web portal for parents" },
  { key: "FEATURE_HOMEWORK",                label: "Homework Module",          desc: "Assign and track homework" },
];

export default function FeatureFlagsPage() {
  const { data: tenants } = useApi<any[]>("/tenant-admin/schools");
  const [selectedTenant,  setSelectedTenant]  = useState("");
  const [saving,          setSaving]          = useState<string | null>(null);
  const [killSwitching,   setKillSwitching]   = useState<string | null>(null);
  const { data: tenantFlags, refetch: refetchFlags } = useApi<any>(
    selectedTenant ? `/feature-flags/tenant/${selectedTenant}` : "",
    [selectedTenant]
  );

  const tenantList = Array.isArray(tenants) ? tenants : [];
  const tenantFlagMap = Array.isArray(tenantFlags)
    ? Object.fromEntries(tenantFlags.map((flag: any) => [flag.name, flag]))
    : (tenantFlags ?? {});

  const toggle = async (flag: string, enabled: boolean) => {
    if (!selectedTenant) return;
    setSaving(flag);
    try {
      await api.post(`/feature-flags/tenant/${selectedTenant}`, { flag, isEnabled: enabled });
      refetchFlags();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(null); }
  };

  const killSwitch = async (flag: string) => {
    if (!confirm(`Kill switch: disable "${flag}" for ALL tenants?`)) return;
    setKillSwitching(flag);
    try {
      await api.delete(`/feature-flags/global/${flag}`);
      alert(`${flag} disabled for all tenants`);
    } catch (e: any) { alert(e.message); }
    finally { setKillSwitching(null); }
  };

  const enableGlobal = async (flag: string) => {
    if (!confirm(`Enable "${flag}" for ALL active tenants?`)) return;
    setSaving(flag);
    try {
      await api.post(`/feature-flags/global/${flag}/enable`, {});
      alert(`${flag} enabled for all tenants`);
    } catch (e: any) { alert(e.message); }
    finally { setSaving(null); }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">Feature Flags</h1>
        <p className="text-slate-400 text-sm mt-1">Per-tenant toggles, global rollout, and emergency kill switches</p>
      </div>

      <div className="mb-6">
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Select tenant for per-school control
        </label>
        <select value={selectedTenant} onChange={e => setSelectedTenant(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 text-sm w-80 focus:outline-none focus:border-orange-500">
          <option value="">— select a school —</option>
          {tenantList.map((t: any) => (
            <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        {FLAGS.map(({ key, label, desc }) => {
          const isEnabled = tenantFlagMap[key]?.isEnabled ?? false;
          const isSaving  = saving === key;
          return (
            <div key={key} className="bg-slate-900 rounded-xl border border-slate-800 px-5 py-4 flex items-center gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-200">{label}</p>
                <p className="text-xs text-slate-500">{desc}</p>
                <p className="text-xs font-mono text-slate-600 mt-0.5">{key}</p>
              </div>

              {/* Per-tenant toggle */}
              {selectedTenant && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">This school</span>
                  <button
                    onClick={() => toggle(key, !isEnabled)}
                    disabled={isSaving}
                    className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${
                      isEnabled ? "bg-orange-500" : "bg-slate-700"
                    }`}>
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                      isEnabled ? "left-6" : "left-1"
                    }`} />
                  </button>
                </div>
              )}

              {/* Global controls */}
              <div className="flex gap-2">
                <button onClick={() => enableGlobal(key)} disabled={saving === key}
                  className="text-xs px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg font-medium transition-colors disabled:opacity-40">
                  Enable all
                </button>
                <button onClick={() => killSwitch(key)} disabled={killSwitching === key}
                  className="text-xs px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg font-medium transition-colors disabled:opacity-40">
                  {killSwitching === key ? "Killing..." : "Kill switch"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
