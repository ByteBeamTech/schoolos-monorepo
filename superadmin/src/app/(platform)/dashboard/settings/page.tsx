"use client";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { useApi }     from "@/lib/hooks";
import { api }        from "@/lib/api";
import { useToast }   from "@/components/ui/use-toast";
import { Clock, Save, RotateCcw } from "lucide-react";

// SETTINGS FEATURE: this page was a pure stub ("Settings UI coming
// soon") until now. Scoped deliberately narrow -- only the SLA policy
// section, since that's the one concrete, real backend-configurable
// setting that exists today (backend: PlatformConfig table + GET/PATCH
// /superadmin/config/sla-policy, replacing what used to be a hardcoded
// constant in support.service.ts). The placeholder's own copy mentioned
// "Region control, gateway config, and platform-wide toggles" -- those
// aren't built here, since none of them have any real backend behind
// them yet (confirmed via investigation before starting this). Building
// speculative UI for settings with no real config to back them would be
// the same category of bug fixed repeatedly elsewhere this session
// (UI wired to something that doesn't actually exist/persist).

interface SlaPolicyEntry { responseMin: number; resolutionMin: number }
interface SlaPolicy {
  CRITICAL: SlaPolicyEntry;
  HIGH:     SlaPolicyEntry;
  MEDIUM:   SlaPolicyEntry;
  LOW:      SlaPolicyEntry;
}

const PRIORITY_ORDER: (keyof SlaPolicy)[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const PRIORITY_COLOR: Record<keyof SlaPolicy, string> = {
  CRITICAL: "text-red-400 border-red-500/30 bg-red-500/5",
  HIGH:     "text-amber-400 border-amber-500/30 bg-amber-500/5",
  MEDIUM:   "text-blue-400 border-blue-500/30 bg-blue-500/5",
  LOW:      "text-slate-400 border-slate-700 bg-slate-800/30",
};

function minutesToHuman(min: number): string {
  if (min < 60) return `${min}m`;
  if (min % 1440 === 0) return `${min / 1440}d`;
  if (min % 60 === 0) return `${min / 60}h`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const { data, loading, refetch } = useApi<{ policy: SlaPolicy; isDefault: boolean }>("/superadmin/config/sla-policy");

  const [draft, setDraft] = useState<SlaPolicy | null>(null);
  const [saving, setSaving] = useState(false);

  // Sync local editable draft whenever fresh data loads (initial load,
  // or after a save round-trips through refetch()).
  useEffect(() => {
    if (data?.policy) setDraft(data.policy);
  }, [data]);

  const updateField = (priority: keyof SlaPolicy, field: keyof SlaPolicyEntry, value: number) => {
    setDraft(prev => prev ? { ...prev, [priority]: { ...prev[priority], [field]: value } } : prev);
  };

  const hasChanges = draft && data?.policy && JSON.stringify(draft) !== JSON.stringify(data.policy);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await api.patch("/superadmin/config/sla-policy", draft);
      toast({ description: "SLA policy updated." });
      refetch();
    } catch (e: any) {
      toast({ description: e.message || "Failed to save SLA policy.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const resetDraft = () => { if (data?.policy) setDraft(data.policy); };

  return (
    <div>
      <PageHeader title="Platform Settings" subtitle="Global configuration for SchoolOS" />

      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 max-w-3xl">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-400" /> SLA Policy
          </h3>
          {data?.isDefault && (
            <span className="text-[10px] uppercase tracking-wide text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
              Using factory defaults
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mb-5">
          Response and resolution time targets per ticket priority. Applied to every new ticket at creation, and
          recomputed if a ticket's priority changes or it gets auto-escalated.
        </p>

        {loading || !draft ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate-800 rounded-lg animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-3">
            {PRIORITY_ORDER.map(p => (
              <div key={p} className={`rounded-lg border p-4 ${PRIORITY_COLOR[p]}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wide">{p}</span>
                  <span className="text-[11px] text-slate-500">
                    {minutesToHuman(draft[p].responseMin)} response · {minutesToHuman(draft[p].resolutionMin)} resolve
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-[11px] text-slate-500 block mb-1">Response time (minutes)</span>
                    <input
                      type="number" min={1} value={draft[p].responseMin}
                      onChange={e => updateField(p, "responseMin", Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 bg-slate-950/60 border border-slate-700 text-slate-200 text-sm rounded-lg focus:outline-none focus:border-orange-500"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-slate-500 block mb-1">Resolution time (minutes)</span>
                    <input
                      type="number" min={1} value={draft[p].resolutionMin}
                      onChange={e => updateField(p, "resolutionMin", Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 bg-slate-950/60 border border-slate-700 text-slate-200 text-sm rounded-lg focus:outline-none focus:border-orange-500"
                    />
                  </label>
                </div>
              </div>
            ))}

            <div className="flex items-center gap-3 pt-2">
              <button onClick={save} disabled={!hasChanges || saving}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : "Save changes"}
              </button>
              {hasChanges && (
                <button onClick={resetDraft}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors">
                  <RotateCcw className="w-3.5 h-3.5" /> Discard
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-900/50 rounded-xl border border-slate-800/60 p-5 max-w-3xl mt-4">
        <p className="text-xs text-slate-500">
          Region control, gateway config, and other platform-wide toggles aren't built yet -- there's no real
          backend configuration behind them today. This section will grow as those get real config to back them,
          the same way SLA policy just did.
        </p>
      </div>
    </div>
  );
}

