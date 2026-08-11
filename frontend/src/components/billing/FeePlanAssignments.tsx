"use client";
// frontend/src/components/billing/FeePlanAssignments.tsx
//
// New -- the audit found zero FeePlanAssignment UI anywhere in the
// frontend, despite the backend (FeePlanAssignmentService, Phase 3,
// frozen) being fully ready. Uses only the two existing endpoints:
// POST /billing/fee-plans/assignments and GET .../assignments -- no
// delete/edit endpoint exists on the backend, and none is added here.
// If removing or editing an assignment turns out to be genuinely
// needed, that's a backend gap to report separately, not something to
// silently add.
//
// No resolution logic lives here. Section-wins-over-class precedence is
// entirely FeePlanAssignmentService.resolveForClassSection()'s
// business, server-side -- this component only ever displays what
// already exists (grouped by class, section rows above the class-wide
// row) and creates new rows via the real endpoint.

import { useState } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useAcademicSessions, useClasses, useFeePlans } from "@/lib/hooks";
import { useToast } from "@/lib/use-toast";
import { useFeePlanAssignments, createFeePlanAssignment } from "@/lib/billing/fee-plan-config";

export function AssignmentsTab() {
  const { toast } = useToast();
  const { data: sessions } = useAcademicSessions();
  const currentSession = sessions?.find((s) => s.isCurrent) ?? sessions?.[0];

  const { data: classes } = useClasses(currentSession?.id ?? "");
  const { data: feePlans } = useFeePlans(currentSession?.name);
  const { data: assignments, loading, refetch } = useFeePlanAssignments(currentSession?.id);

  const [showForm, setShowForm] = useState(false);

  const classNameById = (id: string) => classes?.find((c) => c.id === id)?.name ?? id;
  const sectionNameById = (classId: string, sectionId: string | null) => {
    if (!sectionId) return "All Sections";
    const cls = classes?.find((c) => c.id === classId);
    return cls?.sections.find((s) => s.id === sectionId)?.name ?? sectionId;
  };
  const planNameById = (id: string) => feePlans?.find((p) => p.id === id)?.name ?? id;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-slate-400 max-w-md">
          Assigns a Fee Plan to a Class, or to one Section within it. A
          section-specific assignment takes precedence over the
          class-wide one for students in that section — resolved
          server-side, not here.
        </p>
        <button onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0">
          <Plus className="w-4 h-4" /> New Assignment
        </button>
      </div>

      {showForm && (
        <AssignmentForm
          sessionId={currentSession?.id}
          classes={classes ?? []}
          feePlans={feePlans ?? []}
          onDone={() => { setShowForm(false); refetch(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : !assignments || assignments.length === 0 ? (
        <EmptyState title="No assignments yet" message="Create the first Class/Section → Fee Plan assignment above." />
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm divide-y divide-slate-50">
          {assignments
            // Class-wide rows first within each class, then section rows --
            // purely a display grouping, not a precedence decision (that's
            // resolveForClassSection()'s job, server-side).
            .slice()
            .sort((a, b) => a.classId.localeCompare(b.classId) || (a.sectionId ? 1 : -1))
            .map((a) => (
              <div key={a.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div className="flex items-center gap-2 text-slate-700">
                  <span className="font-medium">{classNameById(a.classId)}</span>
                  <span className="text-slate-300">→</span>
                  <Badge label={sectionNameById(a.classId, a.sectionId)} variant={a.sectionId ? "info" : "neutral"} />
                  <span className="text-slate-300">→</span>
                  <span>{planNameById(a.feePlanId)}</span>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function AssignmentForm({
  sessionId, classes, feePlans, onDone, onCancel,
}: {
  sessionId?: string;
  classes: Array<{ id: string; name: string; sections: Array<{ id: string; name: string }> }>;
  feePlans: Array<{ id: string; name: string }>;
  onDone: () => void; onCancel: () => void;
}) {
  const { toast } = useToast();
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState(""); // "" = All Sections (class-wide)
  const [feePlanId, setFeePlanId] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedClass = classes.find((c) => c.id === classId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId) { toast.error("No academic session selected"); return; }
    setSaving(true);
    try {
      await createFeePlanAssignment({
        sessionId, classId, feePlanId,
        sectionId: sectionId || undefined, // "" -> undefined -> class-wide (sectionId: null on the backend)
      });
      toast.success("Fee plan assignment created.");
      setClassId(""); setSectionId(""); setFeePlanId("");
      onDone();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to create assignment");
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="bg-white border border-blue-100 rounded-xl p-5 mb-5 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Class *</label>
        <select required value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(""); }}
          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Select…</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Section</label>
        <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={!selectedClass}
          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50">
          <option value="">All Sections (class-wide)</option>
          {selectedClass?.sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Fee Plan *</label>
        <select required value={feePlanId} onChange={(e) => setFeePlanId(e.target.value)}
          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Select…</option>
          {feePlans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={saving}
          className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium disabled:opacity-50">
          {saving ? "Creating…" : "Create"}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2.5 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200">
          Cancel
        </button>
      </div>
    </form>
  );
}
