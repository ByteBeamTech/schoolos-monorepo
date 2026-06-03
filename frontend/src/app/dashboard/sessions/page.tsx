"use client";
import { useState }      from "react";
import { Calendar, Plus, Check, Lock } from "lucide-react";
import { PageHeader }    from "@/components/ui/page-header";
import { Badge }         from "@/components/ui/badge";
import { useApi }        from "@/lib/hooks";
import { apiClient }     from "@/lib/api";
import { useToast } from '@/lib/use-toast';


interface Session {
  id:        string;
  name:      string;
  startDate: string;
  endDate:   string;
  isCurrent: boolean;
  isLocked:  boolean;
}

export default function SessionsPage() {
  const { data: sessions, loading, refetch } = useApi<Session[]>("/academic-sessions");

  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [showPromotionRules, setShowPromotionRules] = useState(false);
  const [promotionRules, setPromotionRules] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState("");
  const [loadingRules, setLoadingRules] = useState(false);
  const [acting, setActing]     = useState("");
  const [form, setForm] = useState({
    name: "", startDate: "", endDate: "", isCurrent: false,
  });

  const f = (k: string) => (e: any) =>
    setForm(p => ({ ...p, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.post("/academic-sessions", form);
      setShowForm(false);
      setForm({ name: "", startDate: "", endDate: "", isCurrent: false });
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to create session");
    } finally {
      setSaving(false);
    }
  };

  const setCurrent = async (id: string) => {
    setActing(id + "_current");
    try {
      await apiClient.patch(`/academic-sessions/${id}/set-current`, {});
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed");
    } finally {
      setActing("");
    }
  };

  const lock = async (id: string) => {
    if (!confirm("Lock this session?\n\nAttendance, marks and reports will become read-only until unlocked.")) return;
    setActing(id + "_lock");
    try {
      await apiClient.patch(`/academic-sessions/${id}/lock`, {});
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed");
    } finally {
      setActing("");
    }
  };

  const unlock = async (id: string) => {
  if (!confirm("Unlock this session?")) return;

  setActing(id + "_unlock");

  try {
    await apiClient.patch(
      `/academic-sessions/${id}/unlock`,
      {}
    );

    toast.success("Session unlocked");

    refetch();
  } catch (err: any) {
    toast.error(
      err?.response?.data?.message ??
      "Failed to unlock session"
    );
  } finally {
    setActing("");
  }
};

  const fmt = (d: string) => {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  const loadPromotionRules = async (sessionId: string) => {
    if (!sessionId) return;

    try {
      setLoadingRules(true);

      const { data } = await apiClient.get(
        `/admissions/promotion-rules/${sessionId}`
      );

      setPromotionRules(data || []);
    } catch (err) {
      console.error(err);

      toast.error("Failed to load promotion rules");
    } finally {
      setLoadingRules(false);
    }
  };

  // ⚡ Step 1: Real Engine Core Auto Generation Request Flow Trigger
  const generatePromotionRules = async () => {
    if (!selectedSession) {
      toast.error("Select a session first");
      return;
    }

    try {
      await apiClient.post(
        `/admissions/promotion-rules/generate/${selectedSession}`
      );

      toast.success("Promotion rules generated");

      await loadPromotionRules(selectedSession);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ??
        "Failed to generate rules"
      );
    }
  };

  return (
    <div>
      <PageHeader
        title="Academic Sessions"
        subtitle="Manage school years and active session"

        action={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setShowPromotionRules(true);

                // ⚡ Step 3: Fast Intelligent Initial Selection Alignment
                const current = sessions?.find((s) => s.isCurrent);

                if (current) {
                  setSelectedSession(current.id);
                  loadPromotionRules(current.id);
                } else if (sessions?.length) {
                  setSelectedSession(sessions[0].id);
                  loadPromotionRules(sessions[0].id);
                }
              }}
              className="
                px-4 py-2 rounded-lg
                border border-slate-300
                dark:border-slate-700
                bg-white dark:bg-slate-900
                text-slate-700 dark:text-slate-200
                text-sm
              "
            >
              Promotion Rules
            </button>

            <button
              onClick={() => setShowForm(true)}
              className="
                px-4 py-2 rounded-lg
                bg-blue-600 text-white
                hover:bg-blue-700
                text-sm
              "
            >
              New Session
            </button>
          </div>
        }
      />

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-6 mb-6">
          <h3 className="font-semibold text-slate-900 mb-4">Create Academic Session</h3>
          <form onSubmit={create}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Session Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text" required
                  placeholder="e.g. 2025-26"
                  value={form.name}
                  onChange={f("name")}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date" required
                  value={form.startDate}
                  onChange={f("startDate")}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  End Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date" required
                  value={form.endDate}
                  onChange={f("endDate")}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.isCurrent}
                  onChange={f("isCurrent")}
                  className="w-4 h-4 accent-blue-600"
                />
                <span className="text-sm text-slate-700">Set as current active session</span>
              </label>
            </div>
            <div className="flex gap-3">
              <button
                type="submit" disabled={saving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors"
              >
                {saving ? "Creating..." : "Create Session"}
              </button>
              <button
                type="button" onClick={() => setShowForm(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sessions list */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              {["Session", "Period", "Status", "Actions"].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              [...Array(3)].map((_, i) => (
                <tr key={i}>
                  {[...Array(4)].map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : !sessions || sessions.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-16 text-center text-slate-400">
                  No sessions yet. Create your first academic session above.
                </td>
              </tr>
            ) : sessions.map(s => (
              <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{s.name}</p>
                      <p className="text-xs text-slate-400">ID: {s.id.substring(0, 12)}...</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-slate-500 text-xs">
                  {fmt(s.startDate)} → {fmt(s.endDate)}
                </td>
                <td className="px-5 py-4">
                  <div className="flex gap-2 flex-wrap">
                    {s.isCurrent && <Badge label="Current" variant="success" />}
                    {s.isLocked  && <Badge label="Locked"  variant="neutral" />}
                    {!s.isCurrent && !s.isLocked && <Badge label="Inactive" variant="neutral" />}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex gap-2">
                    {!s.isCurrent && !s.isLocked && (
                      <button
                        onClick={() => setCurrent(s.id)}
                        disabled={acting === s.id + "_current"}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50 transition-colors"
                      >
                        <Check className="w-3 h-3" />
                        {acting === s.id + "_current" ? "Setting..." : "Set Current"}
                      </button>
                    )}


		    {s.isLocked ? (
  <button
    onClick={() => unlock(s.id)}
    disabled={acting === s.id + "_unlock"}
    className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium disabled:opacity-50 transition-colors"
  >
    🔓
    {acting === s.id + "_unlock"
      ? "Unlocking..."
      : "Unlock"}
  </button>
) : (
  <button
    onClick={() => lock(s.id)}
    disabled={acting === s.id + "_lock"}
    className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium disabled:opacity-50 transition-colors"
  >
    <Lock className="w-3 h-3" />
    {acting === s.id + "_lock"
      ? "Locking..."
      : "Lock"}
  </button>
)}
                    
		    


                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showPromotionRules && (
        <div
          className="
            fixed inset-0 z-50
            bg-black/40
            flex justify-end
          "
          onClick={() => setShowPromotionRules(false)}
        >
          <div
            className="
              w-full md:w-[700px]
              h-full
              bg-white dark:bg-slate-900
              overflow-y-auto
              shadow-xl
              p-6
            "
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              {/* ⚡ Step 4: Active Rule Telemetry Counters Display */}
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Promotion Rules
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {promotionRules.length} rule(s) mapped
                </p>
              </div>

              <button
                onClick={() => setShowPromotionRules(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <select
              className="
                w-full mb-4
                border rounded-lg
                px-3 py-2
                bg-white dark:bg-slate-800
              "
              value={selectedSession}
              onChange={(e) => {
                setSelectedSession(e.target.value);
                loadPromotionRules(e.target.value);
              }}
            >
              <option value="">
                Select Session
              </option>

              {sessions?.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {loadingRules ? (
              <div className="text-sm text-slate-500">Loading...</div>
            ) : (
              <div className="space-y-3">
                {promotionRules.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-slate-500 mb-4">
                      No promotion rules configured
                    </p>

                    {/* ⚡ Step 2: Wired Handler Action Mutation Trigger */}
                    <button
                      onClick={generatePromotionRules}
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      Auto Generate Rules
                    </button>
                  </div>
                ) : (
                  promotionRules.map((rule: any) => (
                    <div
                      key={rule.id}
                      className="
                        border rounded-xl
                        p-4
                        dark:border-slate-700
                        bg-slate-50/50 dark:bg-slate-800/40
                      "
                    >
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {rule.fromClassName} → {rule.toClassName}
                      </div>

                      <div className="text-sm text-slate-500 mt-2">
                        Passing Marks: {rule.passingMarks}
                      </div>

                      <div className="text-sm text-slate-500">
                        Auto Promote:
                        {rule.autoPromote ? " Yes" : " No"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
