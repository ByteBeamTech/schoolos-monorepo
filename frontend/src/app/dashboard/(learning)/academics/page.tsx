"use client";
import React, { useState } from "react";
import {
  BookOpen, Users, Layers, Plus, ChevronDown, ChevronRight,
  X, Check, Link, UserCheck,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard }   from "@/components/ui/stat-card";
import { Badge }      from "@/components/ui/badge";
import { useApi }     from "@/lib/hooks";
import { apiClient }  from "@/lib/api";
import { useToast } from '@/lib/use-toast';


type Tab = "classes" | "subjects" | "mappings" | "appointments";

const SUBJECT_PRESETS = [
  { name: "Mathematics",        code: "MATH", isElective: false },
  { name: "English",            code: "ENG",  isElective: false },
  { name: "Hindi",              code: "HIN",  isElective: false },
  { name: "Science",            code: "SCI",  isElective: false },
  { name: "Social Studies",     code: "SST",  isElective: false },
  { name: "Physics",            code: "PHY",  isElective: false },
  { name: "Chemistry",          code: "CHEM", isElective: false },
  { name: "Biology",            code: "BIO",  isElective: false },
  { name: "Computer Science",   code: "CS",   isElective: false },
  { name: "Physical Education", code: "PE",   isElective: false },
  { name: "Art & Craft",        code: "ART",  isElective: true  },
  { name: "Music",              code: "MUS",  isElective: true  },
  { name: "Economics",          code: "ECO",  isElective: false },
  { name: "Accountancy",        code: "ACC",  isElective: false },
  { name: "Business Studies",   code: "BST",  isElective: false },
];

function toSectionName(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export default function AcademicsPage() {
  const { data: sessions } = useApi<any[]>("/academic-sessions");
  const currentSession     = sessions?.find((s: any) => s.isCurrent) ?? sessions?.[0];
  const { toast } = useToast();

  const [sessionId, setSessionId] = useState("");
  const activeSession = sessionId || currentSession?.id || "";

  const { data: classes,  loading: cLoading, refetch: refetchClasses  } = useApi<any[]>(
    activeSession ? `/academics/classes?sessionId=${activeSession}` : "", [activeSession]
  );
  const { data: subjects, loading: sLoading, refetch: refetchSubjects } = useApi<any[]>("/academics/subjects");
  const { data: mappings, refetch: refetchMappings } = useApi<any[]>(
    activeSession ? `/academics/subject-mappings?sessionId=${activeSession}` : "", [activeSession]
  );
  const { data: staff } = useApi<any[]>("/staff");
  const { data: appointments, refetch: refetchAppointments } = useApi<any[]>(
    activeSession ? `/academics/class-teacher-appointments?sessionId=${activeSession}` : "", [activeSession]
  );

  const [tab, setTab]         = useState<Tab>("classes");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  // ── Class form ──────────────────────────────────────────────────────────────
  const [showClassForm, setShowClassForm] = useState(false);
  const [classForm, setClassForm]         = useState({ name: "", displayOrder: "0" });
  const [savingClass, setSavingClass]     = useState(false);

  // ── Section form ────────────────────────────────────────────────────────────
  const [showSectionForm, setShowSectionForm] = useState<string | null>(null);
  const [sectionName, setSectionName]         = useState("");
  const [sectionCap, setSectionCap]           = useState("40");
  const [savingSection, setSavingSection]     = useState(false);

  // ── Subject form ────────────────────────────────────────────────────────────
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [subjectForm, setSubjectForm]         = useState({ name: "", code: "", description: "", isElective: false });
  const [savingSubject, setSavingSubject]     = useState(false);
  const [deletingSubject, setDeletingSubject] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading]         = useState(false);

  // ── Mapping form ────────────────────────────────────────────────────────────
  const [showMapForm, setShowMapForm]     = useState<string | null>(null); // classId
  const [mapSubjectId, setMapSubjectId]   = useState("");
  const [mapWeekly, setMapWeekly]         = useState("5");
  const [savingMap, setSavingMap]         = useState(false);

  // ── Teacher form ────────────────────────────────────────────────────────────
  const [showTeacherForm, setShowTeacherForm] = useState<string | null>(null);
  const [teacherForm, setTeacherForm]         = useState({ subjectId: "", teacherId: "" });
  const [savingTeacher, setSavingTeacher]     = useState(false);
  const [savingAppointment, setSavingAppointment] = useState<string | null>(null);

  const activeClasses   = (classes ?? []).filter((c: any) => c.isActive !== false);
  const totalSections   = activeClasses.reduce((s: number, c: any) => s + (c.sections?.length ?? 0), 0);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const createClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;
    setSavingClass(true);
    try {
      await apiClient.post("/academics/classes", {
        sessionId: activeSession,
        name: classForm.name,
        displayOrder: parseInt(classForm.displayOrder),
      });
      setShowClassForm(false);
      setClassForm({ name: "", displayOrder: "0" });
      refetchClasses();
    } catch { toast.error("Failed to create class"); }
    finally { setSavingClass(false); }
  };

  const createSection = async (e: React.FormEvent, classId: string) => {
    e.preventDefault();
    const name = toSectionName(sectionName);
    if (!name) return;
    setSavingSection(true);
    try {
      await apiClient.post("/academics/sections", { classId, name, capacity: parseInt(sectionCap) });
      setShowSectionForm(null);
      setSectionName("");
      setSectionCap("40");
      refetchClasses();
    } catch { toast.error("Failed to create section"); }
    finally { setSavingSection(false); }
  };

  const quickAddSection = async (classId: string, name: string) => {
    await apiClient.post("/academics/sections", { classId, name, capacity: 40 }).catch(() => {});
    refetchClasses();
  };

  // ── SUBJECT HANDLERS ────────────────────────────────────────────────────────
  const createSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSubject(true);
    try {
      await apiClient.post("/academics/subjects", subjectForm);
      setShowSubjectForm(false);
      setSubjectForm({ name: "", code: "", description: "", isElective: false });
      refetchSubjects();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to create subject");
    } finally { setSavingSubject(false); }
  };

  const deleteSubject = async (id: string) => {
    if (!confirm("Delete this subject? This will also remove all its mappings.")) return;
    setDeletingSubject(id);
    try {
      await apiClient.delete(`/academics/subjects/${id}`);
      refetchSubjects();
      refetchMappings();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to delete subject");
    } finally { setDeletingSubject(null); }
  };

  const bulkAddPresets = async () => {
    const existing = new Set((subjects ?? []).map((s: any) => s.code));
    const toAdd = SUBJECT_PRESETS.filter(p => !existing.has(p.code));
    if (toAdd.length === 0) { toast.error("All preset subjects already exist."); return; }
    setBulkLoading(true);
    try {
      for (const s of toAdd) {
        await apiClient.post("/academics/subjects", s).catch(() => {});
      }
      refetchSubjects();
    } finally { setBulkLoading(false); }
  };

  // ── MAPPING HANDLERS ────────────────────────────────────────────────────────
  const createMapping = async (classId: string) => {
    if (!mapSubjectId) return;
    setSavingMap(true);
    try {
      await apiClient.post("/academics/subject-mappings", {
        classId,
        subjectId: mapSubjectId,
        weeklyPeriods: parseInt(mapWeekly),
        sessionId: activeSession,
      });
      setShowMapForm(null);
      setMapSubjectId("");
      setMapWeekly("5");
      refetchMappings();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to map subject");
    } finally { setSavingMap(false); }
  };

  const deleteMapping = async (mappingId: string) => {
    try {
      await apiClient.delete(`/academics/subject-mappings/${mappingId}`);
      refetchMappings();
    } catch { toast.error("Failed to remove mapping"); }
  };

  // ── Teacher & appointment handlers ──────────────────────────────────────────
  const saveTeacherMapping = async (sectionId: string) => {
    if (!teacherForm.subjectId || !teacherForm.teacherId) return;
    setSavingTeacher(true);
    try {
      await apiClient.post("/academics/teacher-mappings", {
        sectionId,
        subjectId: teacherForm.subjectId,
        teacherId: teacherForm.teacherId,
        sessionId: activeSession,
      });
      setShowTeacherForm(null);
      setTeacherForm({ subjectId: "", teacherId: "" });
    } catch { toast.error("Failed to assign teacher"); }
    finally { setSavingTeacher(false); }
  };



  const appointClassTeacher = async (
  sectionId: string,
  staffId: string | null
) => {
  setSavingAppointment(sectionId);

  try {
    await apiClient.post(
      `/academics/sections/${sectionId}/assign-class-teacher`,
      {
        staffId,
      }
    );

    refetchAppointments();
    toast.success("Class teacher assigned");
  } catch (err) {
    console.error(err);
    toast.error("Failed to appoint teacher");
  } finally {
    setSavingAppointment(null);
  }
};

  // ── Helper: get mappings for a specific classId ─────────────────────────────
  const getMappingsForClass = (classId: string) =>
    (mappings ?? []).filter((m: any) => m.classId === classId);

  return (
    <div className="space-y-6">
      <PageHeader title="Academics" subtitle="Classes, sections, subjects and teacher assignments" />

      {/* Session selector */}
      <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Session:</label>
        <select
          value={activeSession}
          onChange={e => setSessionId(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {sessions?.map((s: any) => (
            <option key={s.id} value={s.id}>{s.name}{s.isCurrent ? " (Current)" : ""}</option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Active Classes" value={activeClasses.length}   icon={<Layers className="w-5 h-5" />}   color="blue"   loading={cLoading} />
        <StatCard label="Sections"       value={totalSections}           icon={<Users className="w-5 h-5" />}    color="green"  loading={cLoading} />
        <StatCard label="Subjects"       value={subjects?.length ?? 0}   icon={<BookOpen className="w-5 h-5" />} color="purple" loading={sLoading} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {(["classes", "subjects", "mappings", "appointments"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
              tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            {t === "mappings" ? "Subject Mapping" : t === "appointments" ? "Class Teachers" : t}
            {t === "subjects" && subjects && (
              <span className="ml-1.5 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-semibold">
                {subjects.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: CLASSES ────────────────────────────────────────────────────── */}
      {tab === "classes" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-800">Class Management</h3>
            <button
              onClick={() => setShowClassForm(!showClassForm)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Class
            </button>
          </div>

          {showClassForm && (
            <form onSubmit={createClass} className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Class Name *</label>
                <input
                  required
                  placeholder="e.g. Class 6"
                  value={classForm.name}
                  onChange={e => setClassForm({ ...classForm, name: e.target.value })}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button type="submit" disabled={savingClass}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700">
                {savingClass ? "Creating…" : "Create"}
              </button>
              <button type="button" onClick={() => setShowClassForm(false)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm hover:bg-slate-200">
                Cancel
              </button>
            </form>
          )}

          <div className="space-y-3">
            {activeClasses.map((cls: any) => (
              <div key={cls.id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => toggle(cls.id)}>
                  <div className="flex items-center gap-3">
                    {expanded[cls.id] ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    <span className="font-semibold text-slate-900">{cls.name}</span>
                    <span className="text-xs text-slate-400">{cls.sections?.length ?? 0} sections</span>
                  </div>
                  <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                    {["A", "B", "C"].map(n => (
                      <button key={n} onClick={() => quickAddSection(cls.id, n)}
                        className="px-2 py-1 text-xs border border-slate-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors">
                        +{n}
                      </button>
                    ))}
                    <button
                      onClick={() => setShowSectionForm(showSectionForm === cls.id ? null : cls.id)}
                      className="px-2 py-1 text-xs bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors text-slate-600"
                    >
                      + Custom
                    </button>
                  </div>
                </div>

                {showSectionForm === cls.id && (
                  <form onSubmit={e => createSection(e, cls.id)} className="px-4 pb-4 pt-0 flex gap-3 items-end bg-slate-50 border-t border-slate-100">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Section Name</label>
                      <input
                        required
                        value={sectionName}
                        onChange={e => setSectionName(e.target.value)}
                        placeholder="e.g. D"
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm w-24"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Capacity</label>
                      <input
                        type="number"
                        value={sectionCap}
                        onChange={e => setSectionCap(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm w-20"
                      />
                    </div>
                    <button type="submit" disabled={savingSection}
                      className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-50">
                      {savingSection ? "Adding…" : "Add"}
                    </button>
                  </form>
                )}

                {expanded[cls.id] && cls.sections && (
                  <div className="p-4 bg-slate-50 border-t border-slate-100">
                    {cls.sections.length === 0 ? (
                      <p className="text-sm text-slate-400">No sections yet. Use the +A/B/C buttons above.</p>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {cls.sections.map((sec: any) => (
                         
			       <div key={sec.id}>
  <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm flex justify-between items-center">
    <span className="text-sm font-medium text-slate-800">
      Section {sec.name}
    </span>

    <button
      onClick={() =>
        setShowTeacherForm(
          showTeacherForm === sec.id ? null : sec.id
        )
      }
      className="text-xs text-blue-600 font-medium hover:text-blue-800"
    >
      Assign Teacher
    </button>
  </div>
  {showTeacherForm === sec.id && (
    <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
      <div className="grid grid-cols-2 gap-3">
        <select
          value={teacherForm.subjectId}
          onChange={(e) =>
            setTeacherForm((p) => ({
              ...p,
              subjectId: e.target.value,
            }))
          }
          className="px-3 py-2 border rounded-lg"
        >
          <option value="">Select Subject</option>

          {getMappingsForClass(cls.id).map((m: any) => (
            <option
              key={m.subjectId}
              value={m.subjectId}
            >
              {m.subject?.name}
            </option>
          ))}
        </select>

        <select
          value={teacherForm.teacherId}
          onChange={(e) =>
            setTeacherForm((p) => ({
              ...p,
              teacherId: e.target.value,
            }))
          }
          className="px-3 py-2 border rounded-lg"
        >
          <option value="">Select Teacher</option>

          {(staff ?? []).map((t: any) => (
            <option key={t.id} value={t.id}>
              {t.user?.firstName} {t.user?.lastName}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={() => saveTeacherMapping(sec.id)}
        disabled={savingTeacher}
        className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg"
      >
        {savingTeacher ? "Saving..." : "Assign"}
      </button>
    </div>
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

      {/* ── TAB: SUBJECTS ───────────────────────────────────────────────────── */}
      {tab === "subjects" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800">Subject Management</h3>
              <p className="text-sm text-slate-400 mt-0.5">Add subjects that can be mapped to classes</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={bulkAddPresets}
                disabled={bulkLoading}
                className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                {bulkLoading ? (
                  <span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Bulk Add Presets
              </button>
              <button
                onClick={() => setShowSubjectForm(p => !p)}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Subject
              </button>
            </div>
          </div>

          {/* Add Subject Form */}
          {showSubjectForm && (
            <form onSubmit={createSubject} className="bg-blue-50 border border-blue-100 rounded-xl p-5">
              <h4 className="font-semibold text-slate-800 text-sm mb-4">New Subject</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Subject Name *</label>
                  <input
                    required
                    placeholder="e.g. Mathematics"
                    value={subjectForm.name}
                    onChange={e => setSubjectForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Subject Code *</label>
                  <input
                    required
                    placeholder="e.g. MATH"
                    value={subjectForm.code}
                    onChange={e => setSubjectForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={subjectForm.isElective}
                      onChange={e => setSubjectForm(p => ({ ...p, isElective: e.target.checked }))}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Elective subject</span>
                  </label>
                </div>
                <div className="md:col-span-4">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Description (optional)</label>
                  <input
                    placeholder="Brief description"
                    value={subjectForm.description}
                    onChange={e => setSubjectForm(p => ({ ...p, description: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-4 pt-4 border-t border-blue-200">
                <button type="submit" disabled={savingSubject}
                  className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors flex items-center gap-2">
                  {savingSubject && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {savingSubject ? "Saving…" : "Save Subject"}
                </button>
                <button type="button" onClick={() => setShowSubjectForm(false)}
                  className="px-5 py-2 bg-white border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Subjects List */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            {sLoading ? (
              <div className="p-6 space-y-3">
                {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />)}
              </div>
            ) : !subjects || subjects.length === 0 ? (
              <div className="p-12 text-center">
                <BookOpen className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No subjects yet</p>
                <p className="text-sm text-slate-400 mt-1">
                  Click <strong>Add Subject</strong> to create one, or <strong>Bulk Add Presets</strong> to add all standard subjects at once.
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {["Subject Name", "Code", "Type", "Mapped Classes", ""].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {subjects.map((subj: any) => {
                    const mappedCount = (mappings ?? []).filter((m: any) => m.subjectId === subj.id).length;
                    return (
                      <tr key={subj.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-slate-900">{subj.name}</td>
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-500 bg-slate-50/50">
                          <span className="px-2 py-1 bg-slate-100 rounded-md">{subj.code ?? "—"}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge
                            label={subj.isElective ? "Elective" : "Core"}
                            variant={subj.isElective ? "warning" : "info"}
                          />
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">
                          {mappedCount > 0
                            ? <span className="text-emerald-600 font-medium">{mappedCount} class{mappedCount !== 1 ? "es" : ""}</span>
                            : <span className="text-slate-300">Not mapped</span>}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => deleteSubject(subj.id)}
                            disabled={deletingSubject === subj.id}
                            className="text-xs text-red-400 hover:text-red-600 font-medium disabled:opacity-50 transition-colors"
                          >
                            {deletingSubject === subj.id ? "Removing…" : "Remove"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: SUBJECT MAPPING ────────────────────────────────────────────── */}
      {tab === "mappings" && (
        <div className="space-y-4">
          <div>
            <h3 className="font-bold text-slate-800">Subject → Class Mapping</h3>
            <p className="text-sm text-slate-400 mt-0.5">Assign which subjects are taught in each class and how many periods per week</p>
          </div>

          {(!subjects || subjects.length === 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              ⚠️ No subjects found. Go to the <strong>Subjects</strong> tab first and add subjects before mapping them.
            </div>
          )}

          <div className="space-y-3">
            {activeClasses.map((cls: any) => {
              const clsMappings = getMappingsForClass(cls.id);
              const isOpen = showMapForm === cls.id;
              return (
                <div key={cls.id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50">
                    <div>
                      <span className="font-semibold text-slate-900">{cls.name}</span>
                      <span className="ml-2 text-xs text-slate-400">{clsMappings.length} subject{clsMappings.length !== 1 ? "s" : ""} mapped</span>
                    </div>
                    <button
                      onClick={() => { setShowMapForm(isOpen ? null : cls.id); setMapSubjectId(""); setMapWeekly("5"); }}
                      className="flex items-center gap-1.5 text-sm text-blue-600 font-medium hover:text-blue-800 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Map Subject
                    </button>
                  </div>

                  {isOpen && (
                    <div className="px-5 py-4 bg-blue-50 border-b border-blue-100 flex flex-wrap gap-3 items-end">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Subject *</label>
                        <select
                          value={mapSubjectId}
                          onChange={e => setMapSubjectId(e.target.value)}
                          className="px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-48"
                        >
                          <option value="">Select subject…</option>
                          {(subjects ?? [])
                            .filter((s: any) => !clsMappings.some((m: any) => m.subjectId === s.id))
                            .map((s: any) => (
                              <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                            ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Periods/Week</label>
                        <input
                          type="number"
                          min="1"
                          max="40"
                          value={mapWeekly}
                          onChange={e => setMapWeekly(e.target.value)}
                          className="w-20 px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <button
                        onClick={() => createMapping(cls.id)}
                        disabled={savingMap || !mapSubjectId}
                        className="px-4 py-2.5 bg-blue-600 text-white text-sm rounded-lg font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors flex items-center gap-2"
                      >
                        {savingMap && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                        {savingMap ? "Mapping…" : "Add Mapping"}
                      </button>
                      <button onClick={() => setShowMapForm(null)}
                        className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition-colors">
                        Cancel
                      </button>
                    </div>
                  )}

                  {clsMappings.length === 0 ? (
                    <div className="px-5 py-4 text-sm text-slate-400">No subjects mapped yet.</div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {clsMappings.map((m: any) => (
                        <div key={m.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-slate-800">{m.subject?.name ?? m.subjectId}</span>
                            {m.subject?.code && (
                              <span className="text-xs font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">{m.subject.code}</span>
                            )}
                            {m.subject?.isElective && <Badge label="Elective" variant="warning" />}
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-xs text-slate-400">{m.weeklyPeriods} periods/week</span>
                            <button
                              onClick={() => deleteMapping(m.id)}
                              className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB: CLASS TEACHERS ─────────────────────────────────────────────── */}
      {tab === "appointments" && (
        <div className="space-y-4">
          <h3 className="font-bold text-slate-800">Class Teacher Appointments</h3>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-50">
              {activeClasses.map((cls: any) => (
                <div key={cls.id} className="p-5">
                  <p className="text-sm font-bold text-slate-900 mb-3">{cls.name}</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {(cls.sections ?? []).map((sec: any) => (
                      <div key={sec.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-lg bg-slate-50">
                        <span className="font-medium text-sm text-slate-700">Section {sec.name}</span>
                        <select
                          value={sec.classTeacherId ?? ""}
                          onChange={e => appointClassTeacher(sec.id, e.target.value || null)}
                          disabled={savingAppointment === sec.id}
                          className="text-sm border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                          <option value="">No Class Teacher</option>
                          {(staff ?? [])
                            .filter((s: any) => ["TEACHER", "CLASS_TEACHER"].includes(s.user?.role))
                            .map((s: any) => (
                              <option key={s.id} value={s.id}>
                                {s.user?.firstName} {s.user?.lastName}
                              </option>
                            ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
