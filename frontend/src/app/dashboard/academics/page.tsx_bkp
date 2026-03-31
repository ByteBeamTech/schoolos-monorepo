"use client";
import React, { useState, useEffect } from "react";
import {
  BookOpen, Users, Layers, Plus, ChevronDown, ChevronRight,
  X, Check, Link, UserCheck, Sparkles, Power,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard }   from "@/components/ui/stat-card";
import { Badge }      from "@/components/ui/badge";
import { useApi }     from "@/lib/hooks";
import { apiClient }  from "@/lib/api";

// FIX: Define Tab type before the component
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

  const [tab, setTab] = useState<Tab>("classes");
  const [expanded, setExpanded] = useState<Record<string,boolean>>({});
  const toggle = (id:string) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  // Forms State
  const [showClassForm, setShowClassForm] = useState(false);
  const [classForm, setClassForm]         = useState({ name:"", displayOrder:"0" });
  const [savingClass, setSavingClass]     = useState(false);
  const [togglingClass, setTogglingClass] = useState<string|null>(null);

  const [showSectionForm, setShowSectionForm] = useState<string|null>(null);
  const [sectionName, setSectionName]         = useState("");
  const [sectionCap, setSectionCap]           = useState("40");
  const [savingSection, setSavingSection]     = useState(false);

  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [subjectForm, setSubjectForm]         = useState({ name:"", code:"", isElective:false });
  const [savingSubject, setSavingSubject]     = useState(false);
  const [bulkProgress, setBulkProgress]       = useState("");

  const [showMapForm, setShowMapForm] = useState<string|null>(null);
  const [mapSubjects, setMapSubjects] = useState<string[]>([]);
  const [savingMap, setSavingMap]     = useState(false);

  const [showTeacherForm, setShowTeacherForm] = useState<string|null>(null);
  const [teacherForm, setTeacherForm]         = useState({ subjectId:"", teacherId:"" });
  const [savingTeacher, setSavingTeacher]     = useState(false);

  const [savingAppointment, setSavingAppointment] = useState<string|null>(null);
  const { data: appointments, refetch: refetchAppointments } = useApi<any[]>(
    activeSession ? `/academics/class-teacher-appointments?sessionId=${activeSession}` : "",
    [activeSession, tab]
  );

  const totalSections = classes?.reduce((s:number,c:any) => s + (c.sections?.length ?? 0), 0) ?? 0;

  // --- Functions ---
  const createClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;
    setSavingClass(true);
    try {
      await apiClient.post("/academics/classes", {
        sessionId: activeSession, name: classForm.name,
        displayOrder: parseInt(classForm.displayOrder),
      });
      setShowClassForm(false); setClassForm({ name:"", displayOrder:"0" }); refetchClasses();
    } catch (err:any) { alert("Failed to create class"); }
    finally { setSavingClass(false); }
  };

  const createSection = async (e: React.FormEvent, classId: string) => {
    e.preventDefault();
    const name = toSectionName(sectionName);
    if (!name) return;
    setSavingSection(true);
    try {
      await apiClient.post("/academics/sections", { classId, name, capacity: parseInt(sectionCap) });
      setShowSectionForm(null); setSectionName(""); setSectionCap("40"); refetchClasses();
    } catch (err:any) { alert("Failed to create section"); }
    finally { setSavingSection(false); }
  };

  const quickAddSection = async (classId: string, name: string) => {
    await apiClient.post("/academics/sections", { classId, name, capacity: 40 }).catch(() => {});
    refetchClasses();
  };

  const createSubject = async (e: React.FormEvent) => {
    e.preventDefault(); setSavingSubject(true);
    try {
      await apiClient.post("/academics/subjects", subjectForm);
      setShowSubjectForm(false); setSubjectForm({ name:"", code:"", isElective:false }); refetchSubjects();
    } catch (err:any) { alert("Failed to create subject"); }
    finally { setSavingSubject(false); }
  };

  const appointClassTeacher = async (sectionId: string, teacherId: string | null) => {
    setSavingAppointment(sectionId);
    try {
      await apiClient.post("/academics/class-teacher-appointments", {
        sectionId, teacherId, sessionId: activeSession,
      });
      refetchAppointments();
    } catch (err:any) { alert("Failed to appoint teacher"); }
    finally { setSavingAppointment(null); }
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
    } catch (err:any) { alert("Failed to assign teacher"); }
    finally { setSavingTeacher(false); }
  };

  const activeClasses   = (classes ?? []).filter((c:any) => c.isActive !== false);
  const inactiveClasses = (classes ?? []).filter((c:any) => c.isActive === false);

  return (
    <div className="space-y-6">
      <PageHeader title="Academics" subtitle="Classes, sections, subjects and teacher assignments" />

      {/* Session selector */}
      <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Academic Session:</label>
        <select value={activeSession} onChange={e => setSessionId(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          {sessions?.map((s:any) => (
            <option key={s.id} value={s.id}>{s.name}{s.isCurrent ? " (Current)" : ""}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Active Classes" value={activeClasses.length} icon={<Layers className="w-5 h-5" />} color="blue" loading={cLoading} />
        <StatCard label="Sections" value={totalSections} icon={<Users className="w-5 h-5" />} color="green" loading={cLoading} />
        <StatCard label="Subjects" value={subjects?.length ?? 0} icon={<BookOpen className="w-5 h-5" />} color="purple" loading={sLoading} />
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {(["classes","subjects","mappings","appointments"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
              tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            {t === "mappings" ? "Subject Mapping" : t === "appointments" ? "Class Teachers" : t}
          </button>
        ))}
      </div>

      {tab === "classes" && (
        <div className="space-y-4">
           <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Class Management</h3>
              <button onClick={() => setShowClassForm(!showClassForm)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                <Plus className="w-4 h-4" /> Add Class
              </button>
           </div>
           
           {showClassForm && (
             <form onSubmit={createClass} className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3 items-end">
                <input required placeholder="Class Name" value={classForm.name} onChange={e => setClassForm({...classForm, name: e.target.value})} className="px-3 py-2 border rounded-lg text-sm" />
                <button type="submit" disabled={savingClass} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">{savingClass ? "..." : "Create"}</button>
             </form>
           )}

           <div className="space-y-3">
              {activeClasses.map((cls:any) => (
                <ClassCard 
                  key={cls.id} cls={cls} 
                  expanded={!!expanded[cls.id]} 
                  onToggleExpand={() => toggle(cls.id)}
                  onShowSectionForm={() => setShowSectionForm(showSectionForm === cls.id ? null : cls.id)}
                  showSectionForm={showSectionForm === cls.id}
                  sectionName={sectionName} setSectionName={setSectionName}
                  sectionCap={sectionCap} setSectionCap={setSectionCap}
                  savingSection={savingSection}
                  onCreateSection={(e: React.FormEvent) => createSection(e, cls.id)}
                  onQuickSection={(name:string) => quickAddSection(cls.id, name)}
                  showTeacherForm={showTeacherForm} setShowTeacherForm={setShowTeacherForm}
                  teacherForm={teacherForm} setTeacherForm={setTeacherForm}
                  savingTeacher={savingTeacher} onSaveTeacher={() => saveTeacherMapping(showTeacherForm!)}
                  subjects={subjects} staff={staff}
                />
              ))}
           </div>
        </div>
      )}

      {tab === "appointments" && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-50">
            <h3 className="font-bold">Class Teacher Appointments</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {activeClasses.map((cls:any) => (
              <div key={cls.id} className="p-5">
                <p className="text-sm font-bold text-slate-900 mb-3">{cls.name}</p>
                <div className="grid gap-3">
                  {cls.sections?.map((sec:any) => (
                    <div key={sec.id} className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                      <span className="font-medium text-sm">Section {sec.name}</span>
                      <select 
                        value={sec.classTeacherId ?? ""} 
                        onChange={(e) => appointClassTeacher(sec.id, e.target.value || null)}
                        className="text-sm border rounded-md p-1 bg-white"
                      >
                        <option value="">No Class Teacher</option>
                        {staff?.filter((s:any) => ["TEACHER","CLASS_TEACHER"].includes(s.user?.role)).map((s:any) => (
                          <option key={s.id} value={s.id}>{s.user?.firstName} {s.user?.lastName}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ClassCard({ cls, expanded, onToggleExpand, onShowSectionForm, showSectionForm, sectionName, setSectionName, sectionCap, setSectionCap, savingSection, onCreateSection, onQuickSection, showTeacherForm, setShowTeacherForm, teacherForm, setTeacherForm, savingTeacher, onSaveTeacher, subjects, staff }: any) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-4 flex items-center justify-between cursor-pointer" onClick={onToggleExpand}>
        <div className="flex items-center gap-3">
           {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
           <span className="font-bold">{cls.name}</span>
           <span className="text-xs text-slate-400">{cls.sections?.length || 0} Sections</span>
        </div>
        <div className="flex gap-2">
           {["A", "B", "C"].map(n => (
             <button key={n} onClick={(e) => { e.stopPropagation(); onQuickSection(n); }} className="px-2 py-1 text-xs border rounded hover:bg-blue-50">+{n}</button>
           ))}
        </div>
      </div>

      {showSectionForm && (
        <form onSubmit={onCreateSection} className="p-4 bg-slate-50 border-t flex gap-3 items-end">
           <input required value={sectionName} onChange={e => setSectionName(e.target.value)} placeholder="Section Name" className="p-2 border rounded text-sm" />
           <button type="submit" className="bg-blue-600 text-white px-3 py-2 rounded text-sm">Add</button>
        </form>
      )}

      {expanded && cls.sections && (
        <div className="p-4 bg-slate-50 border-t space-y-2">
           {cls.sections.map((sec:any) => (
             <div key={sec.id} className="bg-white p-3 rounded-lg border flex justify-between items-center shadow-sm">
                <span className="text-sm font-medium">Section {sec.name}</span>
                <button onClick={() => setShowTeacherForm(sec.id)} className="text-xs text-blue-600 font-bold">Assign Teacher</button>
             </div>
           ))}
        </div>
      )}
    </div>
  );
}
