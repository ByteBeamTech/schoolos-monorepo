"use client";
import { useState }       from "react";
import { BookOpen, Plus, Eye } from "lucide-react";
import { PageHeader }     from "@/components/ui/page-header";
import { StatCard }       from "@/components/ui/stat-card";
import { Badge }          from "@/components/ui/badge";
import { useExams, useExamStats, useApi } from "@/lib/hooks";
import { apiClient }      from "@/lib/api";

const EXAM_TYPES = ["UNIT_TEST","MID_TERM","FINAL","PRACTICAL","INTERNAL"];

function typeVariant(t: string) {
  if (t === "FINAL")     return "error"   as const;
  if (t === "MID_TERM")  return "warning" as const;
  if (t === "UNIT_TEST") return "info"    as const;
  return "neutral" as const;
}

export default function ExamsPage() {
  const { data: sessions }  = useApi<any[]>("/academic-sessions");
  const currentSession      = sessions?.find((s: any) => s.isCurrent) ?? sessions?.[0];
  const [sessionId, setSessionId] = useState("");
  const activeSession = sessionId || currentSession?.id || "";

  const { data: exams, loading, refetch } = useExams(activeSession);
  const { data: stats, loading: sLoading } = useExamStats(activeSession);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm] = useState({ name: "", type: "UNIT_TEST", startDate: "", endDate: "" });

  const createExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) { alert("Select a session first"); return; }
    setSaving(true);
    try {
      await apiClient.post("/examinations", { ...form, sessionId: activeSession });
      setShowForm(false);
      setForm({ name: "", type: "UNIT_TEST", startDate: "", endDate: "" });
      refetch();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? "Failed to create exam");
    } finally {
      setSaving(false);
    }
  };

  const publish = async (id: string) => {
    try {
      await apiClient.post(`/examinations/${id}/publish`, {});
      refetch();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? "Failed to publish");
    }
  };

  return (
    <div>
      <PageHeader
        title="Examinations"
        subtitle="Manage exams, schedules and marks"
        action={
          <button
            onClick={() => setShowForm(p => !p)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> New Exam
          </button>
        }
      />

      {/* Session selector */}
      <div className="mb-6 flex items-center gap-3">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Session:</label>
        <select
          value={activeSession}
          onChange={(e) => setSessionId(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select session</option>
          {sessions?.map((s: any) => (
            <option key={s.id} value={s.id}>{s.name}{s.isCurrent ? " (Current)" : ""}</option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Exams"  value={stats?.total     ?? 0} icon={<BookOpen className="w-5 h-5" />} color="blue"   loading={sLoading} />
        <StatCard label="Published"    value={stats?.published ?? 0} icon={<Eye className="w-5 h-5" />}      color="green"  loading={sLoading} />
        <StatCard label="Upcoming"     value={stats?.upcoming  ?? 0} icon={<BookOpen className="w-5 h-5" />} color="amber"  loading={sLoading} />
        <StatCard label="Completed"    value={stats?.completed ?? 0} icon={<BookOpen className="w-5 h-5" />} color="purple" loading={sLoading} />
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-5 mb-6">
          <h3 className="font-semibold text-slate-900 mb-4 text-sm">Create New Exam</h3>
          <form onSubmit={createExam} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Exam Name</label>
              <input
                type="text" required
                placeholder="e.g. Mid Term Exam 2025"
                value={form.name}
                onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm(p => ({ ...p, type: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {EXAM_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Start Date</label>
              <input
                type="date" required
                value={form.startDate}
                onChange={(e) => setForm(p => ({ ...p, startDate: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">End Date</label>
              <input
                type="date" required
                value={form.endDate}
                onChange={(e) => setForm(p => ({ ...p, endDate: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2 flex gap-3 items-end">
              <button type="submit" disabled={saving}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors">
                {saving ? "Creating..." : "Create Exam"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Exams list */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              {["Exam", "Type", "Period", "Subjects", "Status", "Actions"].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? [...Array(4)].map((_, i) => (
              <tr key={i}>
                {[...Array(6)].map((_, j) => (
                  <td key={j} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                ))}
              </tr>
            )) : !exams || exams.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center text-slate-400">
                  {activeSession ? "No exams found. Create your first exam above." : "Select a session to view exams."}
                </td>
              </tr>
            ) : exams.map((exam: any) => {
              const start   = new Date(exam.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
              const end     = new Date(exam.endDate).toLocaleDateString("en-IN",   { day: "numeric", month: "short", year: "numeric" });
              const isPast  = new Date(exam.endDate) < new Date();
              return (
                <tr key={exam.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">{exam.name}</p>
                  </td>
                  <td className="px-5 py-4">
                    <Badge label={exam.type} variant={typeVariant(exam.type)} />
                  </td>
                  <td className="px-5 py-4 text-slate-500 text-xs">{start} – {end}</td>
                  <td className="px-5 py-4 text-slate-500">{exam._count?.schedules ?? 0} subjects</td>
                  <td className="px-5 py-4">
                    <Badge
                      label={exam.isPublished ? "Published" : isPast ? "Completed" : "Draft"}
                      variant={exam.isPublished ? "success" : isPast ? "neutral" : "warning"}
                    />
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      {!exam.isPublished && (
                        <button
                          onClick={() => publish(exam.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                        >
                          Publish
                        </button>
                      )}
                      <a href={`/dashboard/exams/${exam.id}`} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">View →</a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
