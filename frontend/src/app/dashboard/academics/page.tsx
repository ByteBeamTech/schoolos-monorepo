"use client";
import React, { useState } from "react";
import {
  BookOpen, Users, Layers, Plus, ChevronDown, ChevronRight,
  X, Check, Link, UserCheck, Sparkles, Power,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard }   from "@/components/ui/stat-card";
import { Badge }      from "@/components/ui/badge";
import { useApi }     from "@/lib/hooks";
import { apiClient }  from "@/lib/api";

type Tab = "classes" | "subjects" | "mappings" | "appointments";

const CLASS_PRESETS = [
  ["Nursery","LKG","UKG"],
  ["Class 1","Class 2","Class 3","Class 4","Class 5"],
  ["Class 6","Class 7","Class 8"],
  ["Class 9","Class 10"],
  ["Class 11","Class 12"],
];

const SUBJECT_PRESETS = [
  { name:"Mathematics",       code:"MATH", isElective:false },
  { name:"English",           code:"ENG",  isElective:false },
  { name:"Hindi",             code:"HIN",  isElective:false },
  { name:"Science",           code:"SCI",  isElective:false },
  { name:"Social Studies",    code:"SST",  isElective:false },
  { name:"Physics",           code:"PHY",  isElective:false },
  { name:"Chemistry",         code:"CHEM", isElective:false },
  { name:"Biology",           code:"BIO",  isElective:false },
  { name:"Computer Science",  code:"CS",   isElective:false },
  { name:"Physical Education",code:"PE",   isElective:false },
  { name:"Art & Craft",       code:"ART",  isElective:true  },
  { name:"Music",             code:"MUS",  isElective:true  },
  { name:"Economics",         code:"ECO",  isElective:false },
  { name:"Accountancy",       code:"ACC",  isElective:false },
  { name:"Business Studies",  code:"BST",  isElective:false },
];

const SECTION_PRESETS = ["A","B","C","D","E"];

// Force uppercase and strip non-alpha chars for section names
function toSectionName(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export default function AcademicsPage() {
  const { data: sessions } = useApi<any[]>("/academic-sessions");
  const currentSession     = sessions?.find((s:any) => s.isCurrent) ?? sessions?.[0];
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

  // Fetch subject preferences for all teachers (used to enrich dropdowns)
  // Returns: { [staffId]: Subject[] }
  const [teacherPrefs, setTeacherPrefs] = React.useState<Record<string,any[]>>({});
  React.useEffect(() => {
    if (!staff?.length) return;
    const teachers = staff.filter((s:any) => ["TEACHER","CLASS_TEACHER"].includes(s.user?.role));
    Promise.all(
      teachers.map((t:any) =>
        apiClient.get(`/staff/${t.id}/subject-preferences`)
          .then((res:any) => ({ id: t.id, subs: res.data ?? res ?? [] }))
          .catch(() => ({ id: t.id, subs: [] }))
      )
    ).then(results => {
      const map: Record<string,any[]> = {};
      results.forEach(r => { map[r.id] = r.subs; });
      setTeacherPrefs(map);
    });
  }, [staff?.length]);

  const [tab, setTab] = useState<Tab>("classes");
  const [expanded, setExpanded] = useState<Record<string,boolean>>({});
  const toggle = (id:string) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  // ── Class form ──
  const [showClassForm, setShowClassForm] = useState(false);
  const [classForm, setClassForm]         = useState({ name:"", displayOrder:"0" });
  const [savingClass, setSavingClass]     = useState(false);
  const [togglingClass, setTogglingClass] = useState<string|null>(null);

  // ── Section form ──
  const [showSectionForm, setShowSectionForm] = useState<string|null>(null);
  const [sectionName, setSectionName]         = useState("");
  const [sectionCap, setSectionCap]           = useState("40");
  const [savingSection, setSavingSection]     = useState(false);

  // ── Subject form ──
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [subjectForm, setSubjectForm]         = useState({ name:"", code:"", isElective:false });
  const [savingSubject, setSavingSubject]     = useState(false);
  const [bulkProgress, setBulkProgress]       = useState("");

  // ── Mapping form ──
  const [showMapForm, setShowMapForm] = useState<string|null>(null);

  // Class teacher appointments
  const [savingAppointment, setSavingAppointment] = useState<string|null>(null);
  const { data: appointments, refetch: refetchAppointments } = useApi<any[]>(
    activeSession ? `/academics/class-teacher-appointments?sessionId=${activeSession}` : "",
    [activeSession, tab]
  );
  const [mapSubjects, setMapSubjects] = useState<string[]>([]);
  const [savingMap, setSavingMap]     = useState(false);

  // ── Teacher form ──
  const [showTeacherForm, setShowTeacherForm] = useState<string|null>(null);
  const [teacherForm, setTeacherForm]         = useState({ subjectId:"", teacherId:"" });
  const [savingTeacher, setSavingTeacher]     = useState(false);

  const totalSections = classes?.reduce((s:number,c:any) => s + (c.sections?.length ?? 0), 0) ?? 0;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const createClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) { alert("Select a session first"); return; }
    setSavingClass(true);
    try {
      await apiClient.post("/academics/classes", {
        sessionId: activeSession, name: classForm.name,
        displayOrder: parseInt(classForm.displayOrder),
      });
      setShowClassForm(false); setClassForm({ name:"", displayOrder:"0" }); refetchClasses();
    } catch (err:any) { alert(err?.response?.data?.message ?? "Failed"); }
    finally { setSavingClass(false); }
  };

  const bulkCreateClasses = async (names: string[]) => {
    if (!activeSession) { alert("Select a session first"); return; }
    const missing = names.filter(n => !classes?.find((c:any) => c.name === n));
    if (!missing.length) return;
    setSavingClass(true);
    let order = classes?.length ?? 0;
    for (const name of missing) {
      await apiClient.post("/academics/classes", { sessionId: activeSession, name, displayOrder: order++ }).catch(() => {});
    }
    refetchClasses(); setSavingClass(false);
  };

  const toggleClass = async (cls: any) => {
    setTogglingClass(cls.id);
    try {
      await apiClient.patch(`/academics/classes/${cls.id}`, { isActive: !cls.isActive });
      refetchClasses();
    } catch (err:any) { alert(err?.response?.data?.message ?? "Failed"); }
    finally { setTogglingClass(null); }
  };

  const createSection = async (e: React.FormEvent, classId: string) => {
    e.preventDefault();
    const name = toSectionName(sectionName);
    if (!name) { alert("Section name must contain letters or numbers"); return; }
    setSavingSection(true);
    try {
      await apiClient.post("/academics/sections", { classId, name, capacity: parseInt(sectionCap) });
      setShowSectionForm(null); setSectionName(""); setSectionCap("40"); refetchClasses();
    } catch (err:any) { alert(err?.response?.data?.message ?? "Failed"); }
    finally { setSavingSection(false); }
  };

  const quickAddSection = async (classId: string, name: string) => {
    await apiClient.post("/academics/sections", { classId, name, capacity: 40 }).catch(() => {});
    refetchClasses();
  };

  const createSubject = async (e: React.FormEvent) => {
    e.preventDefault(); setSavingSubject(true);
    try {
      await apiClient.post("/academics/subjects", {
        name: subjectForm.name, code: subjectForm.code || undefined, isElective: subjectForm.isElective,
      });
      setShowSubjectForm(false); setSubjectForm({ name:"", code:"", isElective:false }); refetchSubjects();
    } catch (err:any) { alert(err?.response?.data?.message ?? "Failed"); }
    finally { setSavingSubject(false); }
  };

  const bulkCreateSubjects = async (presets: typeof SUBJECT_PRESETS) => {
    const missing = presets.filter(p => !subjects?.find((s:any) => s.name === p.name));
    setSavingSubject(true);
    for (const s of missing) {
      setBulkProgress(`Adding ${s.name}…`);
      await apiClient.post("/academics/subjects", s).catch(() => {});
    }
    setBulkProgress(""); refetchSubjects(); setSavingSubject(false);
  };

  const saveSubjectMapping = async (classId: string) => {
    setSavingMap(true);
    for (const subjectId of mapSubjects) {
      await apiClient.post("/academics/subject-mappings", { classId, subjectId, weeklyPeriods: 5 }).catch(() => {});
    }
    setShowMapForm(null); setMapSubjects([]); refetchMappings(); setSavingMap(false);
  };

  const saveTeacherMapping = async (sectionId: string) => {
    if (!teacherForm.subjectId || !teacherForm.teacherId) return;
    setSavingTeacher(true);
    try {
      await apiClient.post("/academics/teacher-mappings", {
        sectionId, subjectId: teacherForm.subjectId,
        teacherId: teacherForm.teacherId, sessionId: activeSession,
      });
      setShowTeacherForm(null); setTeacherForm({ subjectId:"", teacherId:"" });
    } catch (err:any) { alert(err?.response?.data?.message ?? "Failed"); }
    finally { setSavingTeacher(false); }
  };

  const mappedSubjectIds = (classId: string) =>
    (mappings ?? []).filter((m:any) => m.classId === classId).map((m:any) => m.subjectId);

  // Split classes into active/inactive
  const activeClasses   = (classes ?? []).filter((c:any) => c.isActive !== false);
  const inactiveClasses = (classes ?? []).filter((c:any) => c.isActive === false);

  return (
    <div>
      <PageHeader title="Academics" subtitle="Classes, sections, subjects and teacher assignments" />

      {/* Session selector */}
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Session:</label>
        <select value={activeSession} onChange={e => setSessionId(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Select session</option>
          {sessions?.map((s:any) => (
            <option key={s.id} value={s.id}>{s.name}{s.isCurrent ? " (Current)" : ""}</option>
          ))}
        </select>
        <a href="/dashboard/sessions" className="text-xs text-blue-600 hover:text-blue-800">+ Manage sessions →</a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Active Classes" value={activeClasses.length}   icon={<Layers   className="w-5 h-5" />} color="blue"   loading={cLoading} />
        <StatCard label="Sections"       value={totalSections}           icon={<Users    className="w-5 h-5" />} color="green"  loading={cLoading} />
        <StatCard label="Subjects"       value={subjects?.length ?? 0}   icon={<BookOpen className="w-5 h-5" />} color="purple" loading={sLoading} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 mb-6">
        {(["classes","subjects","mappings","appointments"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
              tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            {t === "mappings" ? "Subject → Class" : t === "appointments" ? "Class Teachers" : t}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          TAB 1: CLASSES
      ════════════════════════════════════════════════════════════════ */}
      {tab === "classes" && (
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex gap-2 flex-wrap">
              {CLASS_PRESETS.map((group, gi) => (
                <button key={gi}
                  onClick={() => bulkCreateClasses(group)}
                  disabled={!activeSession || savingClass}
                  title={`Add: ${group.join(", ")}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-600 hover:text-blue-700 rounded-lg font-medium transition-colors disabled:opacity-40">
                  <Sparkles className="w-3 h-3" />
                  {group[0]}{group.length > 1 ? `–${group[group.length-1]}` : ""}
                </button>
              ))}
            </div>
            <button onClick={() => setShowClassForm(p => !p)} disabled={!activeSession}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" /> Add Class
            </button>
          </div>

          {showClassForm && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <form onSubmit={createClass} className="flex gap-3 items-end flex-wrap">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Class Name *</label>
                  <input required type="text" placeholder="e.g. Grade 10" value={classForm.name}
                    onChange={e => setClassForm(p => ({ ...p, name: e.target.value }))}
                    className="px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-48" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Display Order</label>
                  <input type="number" min="0" value={classForm.displayOrder}
                    onChange={e => setClassForm(p => ({ ...p, displayOrder: e.target.value }))}
                    className="px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-24" />
                </div>
                <button type="submit" disabled={savingClass}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors">
                  {savingClass ? "Creating…" : "Create"}
                </button>
                <button type="button" onClick={() => setShowClassForm(false)}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-600 text-sm rounded-lg transition-colors">Cancel</button>
              </form>
            </div>
          )}

          {cLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_,i) => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}</div>
          ) : !classes || classes.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400 text-sm">
              {activeSession ? "No classes yet. Use the preset buttons above or add manually." : "Select a session to view classes."}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Active classes */}
              {activeClasses.map((cls:any) => (
                <ClassCard
                  key={cls.id} cls={cls} expanded={!!expanded[cls.id]}
                  onToggleExpand={() => toggle(cls.id)}
                  onToggleActive={() => toggleClass(cls)} toggling={togglingClass === cls.id}
                  showSectionForm={showSectionForm === cls.id}
                  onShowSectionForm={() => setShowSectionForm(showSectionForm === cls.id ? null : cls.id)}
                  sectionName={sectionName} setSectionName={setSectionName}
                  sectionCap={sectionCap} setSectionCap={setSectionCap}
                  savingSection={savingSection}
                  onCreateSection={(e) => createSection(e, cls.id)}
                  onCancelSection={() => { setShowSectionForm(null); setSectionName(""); }}
                  onQuickSection={(name) => quickAddSection(cls.id, name)}
                  showTeacherForm={showTeacherForm} setShowTeacherForm={setShowTeacherForm}
                  teacherForm={teacherForm} setTeacherForm={setTeacherForm}
                  savingTeacher={savingTeacher} onSaveTeacher={() => saveTeacherMapping(showTeacherForm!)}
                  subjects={subjects} staff={staff}
                  mappedCount={mappedSubjectIds(cls.id).length}
                />
              ))}

              {/* Inactive/disabled classes */}
              {inactiveClasses.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    Disabled classes ({inactiveClasses.length})
                  </p>
                  <div className="space-y-2">
                    {inactiveClasses.map((cls:any) => (
                      <div key={cls.id} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-5 py-3 opacity-60">
                        <span className="text-sm text-slate-500 line-through">{cls.name}</span>
                        <button onClick={() => toggleClass(cls)} disabled={togglingClass === cls.id}
                          className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-800 font-medium px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors">
                          <Power className="w-3 h-3" /> Enable
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB 2: SUBJECTS
      ════════════════════════════════════════════════════════════════ */}
      {tab === "subjects" && (
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <button onClick={() => bulkCreateSubjects(SUBJECT_PRESETS)} disabled={savingSubject}
              className="flex items-center gap-2 px-4 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
              <Sparkles className="w-4 h-4" />
              {savingSubject && bulkProgress ? bulkProgress : `Add all standard subjects`}
            </button>
            <button onClick={() => setShowSubjectForm(p => !p)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" /> Add Subject
            </button>
          </div>

          {/* Preset chips */}
          <div className="flex flex-wrap gap-2 mb-4">
            {SUBJECT_PRESETS.map(preset => {
              const exists = subjects?.find((s:any) => s.name === preset.name);
              return (
                <button key={preset.name}
                  onClick={() => !exists && apiClient.post("/academics/subjects", preset).then(() => refetchSubjects()).catch(() => {})}
                  disabled={!!exists || savingSubject}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    exists
                      ? "bg-emerald-50 border-emerald-200 text-emerald-600 cursor-default"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
                  }`}>
                  {exists && <Check className="w-3 h-3 inline mr-1" />}
                  {preset.name}{preset.isElective && <span className="ml-1 opacity-60">(elective)</span>}
                </button>
              );
            })}
          </div>

          {showSubjectForm && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <form onSubmit={createSubject} className="flex gap-3 items-end flex-wrap">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Subject Name *</label>
                  <input required type="text" placeholder="e.g. Mathematics" value={subjectForm.name}
                    onChange={e => setSubjectForm(p => ({ ...p, name: e.target.value }))}
                    className="px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-48" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Code</label>
                  <input type="text" placeholder="MATH01" value={subjectForm.code}
                    onChange={e => setSubjectForm(p => ({ ...p, code: e.target.value }))}
                    className="px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-32" />
                </div>
                <label className="flex items-center gap-2 cursor-pointer pb-2">
                  <input type="checkbox" checked={subjectForm.isElective}
                    onChange={e => setSubjectForm(p => ({ ...p, isElective: e.target.checked }))}
                    className="w-4 h-4 accent-blue-600" />
                  <span className="text-sm text-slate-700">Elective</span>
                </label>
                <button type="submit" disabled={savingSubject}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors">
                  {savingSubject ? "Creating…" : "Create"}
                </button>
                <button type="button" onClick={() => setShowSubjectForm(false)}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-600 text-sm rounded-lg transition-colors">Cancel</button>
              </form>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {["Subject","Code","Type","Classes mapped"].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sLoading ? (
                  [...Array(4)].map((_,i) => (
                    <tr key={i}>{[...Array(4)].map((_,j) => (
                      <td key={j} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                    ))}</tr>
                  ))
                ) : !subjects || subjects.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-slate-400 text-sm">
                      No subjects yet. Use the preset chips or add manually.
                    </td>
                  </tr>
                ) : subjects.map((sub:any) => {
                  const classCount = (mappings ?? []).filter((m:any) => m.subjectId === sub.id).length;
                  return (
                    <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-slate-900">{sub.name}</td>
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{sub.code ?? "—"}</td>
                      <td className="px-5 py-3.5">
                        <Badge label={sub.isElective ? "Elective" : "Core"} variant={sub.isElective ? "info" : "neutral"} />
                      </td>
                      <td className="px-5 py-3.5 text-xs">
                        {classCount > 0
                          ? <span className="text-emerald-600 font-medium">{classCount} class{classCount > 1 ? "es" : ""}</span>
                          : <span className="text-slate-300">not mapped</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB 3: SUBJECT → CLASS MAPPING
      ════════════════════════════════════════════════════════════════ */}
      {tab === "mappings" && (
        <div>
          <p className="text-sm text-slate-500 mb-5">
            Map which subjects are taught in each class. Controls timetables, exam schedules, and mark entry.
          </p>
          {!activeSession ? (
            <div className="bg-white rounded-xl border border-slate-100 p-10 text-center text-slate-400 text-sm">Select a session to manage mappings.</div>
          ) : activeClasses.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-100 p-10 text-center text-slate-400 text-sm">Add classes first, then map subjects.</div>
          ) : (
            <div className="space-y-4">
              {activeClasses.map((cls:any) => {
                const alreadyMapped = mappedSubjectIds(cls.id);
                const unmapped = (subjects ?? []).filter((s:any) => !alreadyMapped.includes(s.id));
                return (
                  <div key={cls.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-semibold text-slate-900">{cls.name}</p>
                        <p className="text-xs text-slate-400">{alreadyMapped.length} subjects mapped</p>
                      </div>
                      <button
                        onClick={() => { setShowMapForm(showMapForm === cls.id ? null : cls.id); setMapSubjects([]); }}
                        className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 border border-blue-100 transition-colors">
                        <Link className="w-3 h-3" /> Map subjects
                      </button>
                    </div>

                    {/* Mapped subjects */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {alreadyMapped.length === 0 ? (
                        <span className="text-xs text-slate-400 italic">No subjects mapped yet</span>
                      ) : alreadyMapped.map(sid => {
                        const sub = subjects?.find((s:any) => s.id === sid);
                        return sub ? (
                          <span key={sid} className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium rounded-full">
                            <Check className="w-3 h-3" /> {sub.name}
                          </span>
                        ) : null;
                      })}
                    </div>

                    {/* Map form */}
                    {showMapForm === cls.id && (
                      <div className="border border-blue-100 rounded-lg p-3 bg-blue-50">
                        {unmapped.length === 0 ? (
                          <p className="text-xs text-emerald-600 font-medium">✓ All subjects mapped to this class</p>
                        ) : (
                          <>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Select subjects to add:</p>
                            <div className="flex flex-wrap gap-2 mb-3">
                              {unmapped.map((s:any) => (
                                <button key={s.id}
                                  onClick={() => setMapSubjects(p => p.includes(s.id) ? p.filter(x => x !== s.id) : [...p, s.id])}
                                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                    mapSubjects.includes(s.id)
                                      ? "bg-blue-600 border-blue-600 text-white"
                                      : "bg-white border-slate-200 text-slate-600 hover:border-blue-300"
                                  }`}>
                                  {s.name}
                                </button>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => saveSubjectMapping(cls.id)}
                                disabled={mapSubjects.length === 0 || savingMap}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg font-medium disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                                <Check className="w-3 h-3" />
                                {savingMap ? "Saving…" : `Map ${mapSubjects.length || ""} subject${mapSubjects.length !== 1 ? "s" : ""}`}
                              </button>
                              <button onClick={() => setShowMapForm(null)}
                                className="px-4 py-2 bg-slate-200 text-slate-600 text-xs rounded-lg hover:bg-slate-300 transition-colors">Cancel</button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── ClassCard component ────────────────────────────────────────────────────────
function ClassCard({ cls, expanded, onToggleExpand, onToggleActive, toggling,
  showSectionForm, onShowSectionForm, sectionName, setSectionName, sectionCap, setSectionCap,
  savingSection, onCreateSection, onCancelSection, onQuickSection,
  showTeacherForm, setShowTeacherForm, teacherForm, setTeacherForm, savingTeacher, onSaveTeacher,
  subjects, staff, mappedCount,
}: any) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 flex items-center gap-3">
        <button onClick={onToggleExpand} className="text-slate-400 hover:text-slate-600">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs flex-shrink-0">
          {cls.name.replace(/\D/g,"").slice(0,2) || cls.name[0]}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900">{cls.name}</p>
          <p className="text-xs text-slate-400">{cls.sections?.length ?? 0} sections · {mappedCount} subjects</p>
        </div>

        {/* Quick section presets */}
        <div className="hidden sm:flex items-center gap-1.5">
          {["A","B","C","D","E"].map(name => {
            const exists = cls.sections?.find((s:any) => s.name === name);
            return (
              <button key={name}
                onClick={() => !exists && onQuickSection(name)}
                disabled={!!exists}
                title={exists ? `Section ${name} exists` : `Add section ${name}`}
                className={`w-7 h-7 rounded-md text-xs font-bold border transition-colors ${
                  exists
                    ? "bg-emerald-50 border-emerald-200 text-emerald-600 cursor-default"
                    : "bg-white border-slate-200 text-slate-400 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
                }`}>
                {name}
              </button>
            );
          })}
          <button onClick={onShowSectionForm}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium ml-1 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-1">
            <Plus className="w-3 h-3" /> Custom
          </button>
        </div>

        {/* Enable/Disable toggle */}
        <button onClick={onToggleActive} disabled={toggling}
          title={cls.isActive !== false ? "Disable this class" : "Enable this class"}
          className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
            cls.isActive !== false
              ? "text-slate-400 border-slate-200 hover:text-red-500 hover:border-red-200 hover:bg-red-50"
              : "text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
          }`}>
          <Power className="w-3 h-3" />
          {toggling ? "…" : cls.isActive !== false ? "Disable" : "Enable"}
        </button>
      </div>

      {/* Custom section form */}
      {showSectionForm && (
        <div className="px-5 py-3 bg-blue-50 border-t border-blue-100">
          <form onSubmit={onCreateSection} className="flex gap-3 items-end flex-wrap">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Section Name * <span className="text-slate-400 font-normal normal-case">(auto-uppercased)</span>
              </label>
              <input required type="text"
                placeholder="e.g. A or ROSE"
                value={sectionName}
                onChange={e => setSectionName(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,""))}
                maxLength={10}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-32 uppercase font-mono tracking-widest" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Capacity</label>
              <input type="number" min="1" value={sectionCap}
                onChange={e => setSectionCap(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-20" />
            </div>
            <button type="submit" disabled={savingSection}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg font-medium disabled:opacity-50 transition-colors">
              {savingSection ? "…" : "Add"}
            </button>
            <button type="button" onClick={onCancelSection}
              className="px-3 py-2 bg-slate-200 text-slate-600 text-xs rounded-lg hover:bg-slate-300 transition-colors">Cancel</button>
          </form>
        </div>
      )}

      {/* Expanded: sections */}
      {expanded && (
        <div className="border-t border-slate-100 px-5 py-4">
          {cls.sections?.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No sections yet — click A B C D E above to add quickly</p>
          ) : (
            <div className="space-y-2">
              {cls.sections?.map((sec:any) => (
                <div key={sec.id} className="border border-slate-100 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-700 text-sm">{cls.name} – {sec.name}</span>
                      <span className="text-xs text-slate-400">cap {sec.capacity}</span>
                      {sec._count?.students > 0 && <Badge label={`${sec._count.students} students`} variant="info" />}
                    </div>
                    <button onClick={() => setShowTeacherForm(showTeacherForm === sec.id ? null : sec.id)}
                      className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 font-medium px-2 py-1 rounded-lg hover:bg-violet-50 transition-colors">
                      <UserCheck className="w-3 h-3" /> Assign Teacher
                    </button>
                  </div>

                  {showTeacherForm === sec.id && (
                    <div className="flex gap-2 flex-wrap mt-2 p-2.5 bg-violet-50 rounded-lg border border-violet-100">
                      <select value={teacherForm.subjectId} onChange={e => setTeacherForm((p:any) => ({ ...p, subjectId: e.target.value }))}
                        className="flex-1 min-w-[140px] px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white">
                        <option value="">Select subject</option>
                        {subjects?.map((s:any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <select value={teacherForm.teacherId} onChange={e => setTeacherForm((p:any) => ({ ...p, teacherId: e.target.value }))}
                        className="flex-1 min-w-[160px] px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white">
                        <option value="">Select teacher</option>
                        {(staff ?? []).filter((s:any) => ["TEACHER","CLASS_TEACHER"].includes(s.user?.role)).map((s:any) => (
                          <option key={s.id} value={s.id}>{s.user?.firstName} {s.user?.lastName} — {s.designation}</option>
                        ))}
                      </select>
                      <button onClick={onSaveTeacher}
                        disabled={!teacherForm.subjectId || !teacherForm.teacherId || savingTeacher}
                        className="px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs rounded-lg font-medium disabled:opacity-50 flex items-center gap-1 transition-colors">
                        <Check className="w-3 h-3" /> {savingTeacher ? "Saving…" : "Assign"}
                      </button>
                      <button onClick={() => setShowTeacherForm(null)}
                        className="px-3 py-2 bg-slate-200 text-slate-600 text-xs rounded-lg hover:bg-slate-300 transition-colors">Cancel</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════ CLASS TEACHER APPOINTMENTS ════════════════════════ */}
      {tab === "appointments" && (
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900">Class Teacher Appointments</h3>
              <p className="text-sm text-slate-500 mt-0.5">
                Appoint a teacher as the designated class teacher for each section.
                A class teacher has extra responsibilities — attendance, parent communication, marks overview.
              </p>
            </div>
          </div>

          {!activeSession ? (
            <div className="bg-white rounded-xl border border-slate-100 p-10 text-center text-slate-400 text-sm">
              Select a session to manage appointments.
            </div>
          ) : (
            <div className="space-y-4">
              {(appointments ?? activeClasses).map((cls:any) => (
                <div key={cls.id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                    <p className="font-semibold text-slate-800">{cls.name}</p>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {(cls.sections ?? []).length === 0 ? (
                      <p className="px-5 py-4 text-xs text-slate-400 italic">No sections in this class</p>
                    ) : (cls.sections ?? []).map((sec:any) => {
                      const ct = sec.classTeacher;
                      return (
                        <div key={sec.id} className="px-5 py-4 flex items-center gap-4">
                          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                            {sec.name}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800">{cls.name} – {sec.name}</p>
                            <p className="text-xs text-slate-400">Capacity: {sec.capacity}</p>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            {ct ? (
                              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                                <div className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center text-white text-[10px] font-bold">
                                  {ct.user?.firstName?.[0]}{ct.user?.lastName?.[0]}
                                </div>
                                <span className="text-sm font-medium text-emerald-700">
                                  {ct.user?.firstName} {ct.user?.lastName}
                                </span>
                                <span className="text-xs text-emerald-500">· {ct.designation}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">No class teacher appointed</span>
                            )}
                            <select
                              value={ct?.id ?? ""}
                              onChange={e => appointClassTeacher(sec.id, e.target.value || null)}
                              disabled={savingAppointment === sec.id}
                              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[180px]">
                              <option value="">— {ct ? "Change" : "Appoint"} class teacher —</option>
                              <optgroup label="Class Teachers">
                                {(staff ?? []).filter((s:any) => s.user?.role === "CLASS_TEACHER").map((s:any) => (
                                  <option key={s.id} value={s.id}>
                                    {s.user?.firstName} {s.user?.lastName} ({s.designation})
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="Teachers">
                                {(staff ?? []).filter((s:any) => s.user?.role === "TEACHER").map((s:any) => (
                                  <option key={s.id} value={s.id}>
                                    {s.user?.firstName} {s.user?.lastName} ({s.designation})
                                  </option>
                                ))}
                              </optgroup>
                              {ct && <option value="">✕ Remove appointment</option>}
                            </select>
                            {savingAppointment === sec.id && (
                              <span className="text-xs text-slate-400">Saving…</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
