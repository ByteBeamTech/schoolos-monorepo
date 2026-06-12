"use client";
// frontend/src/app/dashboard/(finance)/billing/fee-plans/[id]/assign/page.tsx
// Fee Plan Assignment — assign to class, section, or individual student
// Model B: plan follows the class

import { use, useState }  from "react";
import { useRouter }      from "next/navigation";
import {
  ArrowLeft, Users, CheckCircle2,
  AlertTriangle, Search, ChevronDown,
} from "lucide-react";
import { Badge }          from "@/components/ui/badge";
import { useApi }         from "@/lib/hooks";
import { apiClient }      from "@/lib/api";
import { useToast }       from "@/lib/use-toast";

export default function AssignFeePlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }    = use(params);
  const router    = useRouter();
  const { toast } = useToast();

  const { data: plan }     = useApi<any>(`/billing/fee-plans/${id}`, [id]);
  const { data: classes }  = useApi<any[]>("/classes");
  const { data: sessions } = useApi<any[]>("/academic-sessions");

  const current    = sessions?.find((s: any) => s.isCurrent) ?? sessions?.[0];
  const [year, setYear]           = useState<string>("");
  const activeYear = year || current?.name || "";

  // tab: class | section | individual
  const [tab, setTab]             = useState<"class" | "section" | "individual">("class");

  // class tab
  const [selectedClass, setSelectedClass] = useState("");
  const [assigning,     setAssigning]     = useState(false);
  const [result,        setResult]        = useState<any>(null);

  // section tab
  const { data: sections } = useApi<any[]>(
    selectedClass ? `/sections?classId=${selectedClass}` : "", [selectedClass]
  );
  const [selectedSection, setSelectedSection] = useState("");

  // individual tab
  const [studentSearch, setStudentSearch]     = useState("");
  const { data: students } = useApi<any>(
    studentSearch.length > 2
      ? `/students?search=${encodeURIComponent(studentSearch)}&limit=20`
      : "",
    [studentSearch]
  );
  const [assigningStudent, setAssigningStudent] = useState<string | null>(null);

  const classList    = Array.isArray(classes)  ? classes  : [];
  const sectionList  = Array.isArray(sections) ? sections : [];
  const studentList  = (students as any)?.data ?? [];

  const assignToClass = async () => {
    if (!selectedClass || !activeYear) { toast.error("Select a class and academic year"); return; }
    setAssigning(true); setResult(null);
    try {
      const res = await apiClient.post("/billing/fee-plans/assign-class", {
        feePlanId: id, classId: selectedClass, academicYear: activeYear,
      });
      setResult(res as any);
      toast.success(`Assigned to ${(res as any).assigned} student(s)`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed");
    } finally { setAssigning(false); }
  };

  const assignToSection = async () => {
    if (!selectedSection || !activeYear) { toast.error("Select a section and academic year"); return; }
    setAssigning(true); setResult(null);
    try {
      const res = await apiClient.post("/billing/fee-plans/assign-section", {
        feePlanId: id, sectionId: selectedSection, academicYear: activeYear,
      });
      setResult(res as any);
      toast.success(`Assigned to ${(res as any).assigned} student(s)`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed");
    } finally { setAssigning(false); }
  };

  const assignToStudent = async (studentId: string, studentName: string) => {
    if (!activeYear) { toast.error("Select academic year first"); return; }
    setAssigningStudent(studentId);
    try {
      await apiClient.post("/billing/fee-plans/assign", {
        feePlanId: id, studentId, academicYear: activeYear,
      });
      toast.success(`Assigned to ${studentName}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Already assigned or failed");
    } finally { setAssigningStudent(null); }
  };

  if (!plan) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl">
      <button onClick={() => router.back()}
        className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 text-sm mb-5 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Plan info */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">{plan.name}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {plan.academicYear}
              {plan.grade ? ` · Linked to class: ${plan.grade}` : " · No class linked (manual assign only)"}
            </p>
          </div>
          <Badge label={plan.isActive ? "Active" : "Inactive"} variant={plan.isActive ? "success" : "neutral"} />
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-4 text-sm text-slate-600">
          <span>
            {plan.feeItems?.length ?? 0} fee items ·{" "}
            ₹{plan.feeItems?.reduce((s: number, i: any) => s + Number(i.amount), 0).toLocaleString("en-IN")}
          </span>
          <span>{plan.assignments?.length ?? 0} students assigned</span>
        </div>
      </div>

      {/* Academic year picker */}
      <div className="mb-5">
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
          Academic Year *
        </label>
        <select value={activeYear} onChange={e => setYear(e.target.value)}
          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">— select —</option>
          {(sessions ?? []).map((s: any) => (
            <option key={s.id} value={s.name}>
              {s.name}{s.isCurrent ? " (current)" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-5">
        {([
          { key: "class",      label: "By Class"   },
          { key: "section",    label: "By Section" },
          { key: "individual", label: "Individual" },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => { setTab(key); setResult(null); }}
            className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? "text-blue-600 border-blue-600"
                : "text-slate-500 border-transparent hover:text-slate-700"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Result banner */}
      {result && (
        <div className={`rounded-xl p-4 mb-5 flex items-start gap-3 ${
          result.assigned > 0
            ? "bg-emerald-50 border border-emerald-100"
            : "bg-amber-50 border border-amber-100"
        }`}>
          {result.assigned > 0
            ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            : <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />}
          <div>
            <p className={`text-sm font-semibold ${result.assigned > 0 ? "text-emerald-700" : "text-amber-700"}`}>
              {result.assigned > 0
                ? `Assigned to ${result.assigned} student${result.assigned !== 1 ? "s" : ""}`
                : "No new assignments"}
            </p>
            {result.skipped > 0 && (
              <p className="text-xs text-slate-500 mt-0.5">
                {result.skipped} student{result.skipped !== 1 ? "s" : ""} skipped (already assigned)
              </p>
            )}
          </div>
        </div>
      )}

      {/* CLASS TAB */}
      {tab === "class" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-sm text-slate-600 mb-4">
            Assigns this fee plan to <strong>every active student</strong> in the selected class.
            Students already assigned are skipped automatically.
          </p>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Class</label>
            <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— select class —</option>
              {classList.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <button onClick={assignToClass} disabled={assigning || !selectedClass || !activeYear}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-xl font-medium disabled:opacity-50 transition-colors">
            {assigning
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Users className="w-4 h-4" />}
            {assigning ? "Assigning..." : "Assign to All Students in Class"}
          </button>
        </div>
      )}

      {/* SECTION TAB */}
      {tab === "section" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-sm text-slate-600 mb-4">
            Assigns this plan to all students in a specific section.
            Useful when Section A and Section B have different lab fees.
          </p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Class</label>
              <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedSection(""); }}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— class —</option>
                {classList.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Section</label>
              <select value={selectedSection} onChange={e => setSelectedSection(e.target.value)}
                disabled={!selectedClass}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50">
                <option value="">— section —</option>
                {sectionList.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <button onClick={assignToSection} disabled={assigning || !selectedSection || !activeYear}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-xl font-medium disabled:opacity-50 transition-colors">
            {assigning
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Users className="w-4 h-4" />}
            {assigning ? "Assigning..." : "Assign to All Students in Section"}
          </button>
        </div>
      )}

      {/* INDIVIDUAL TAB */}
      {tab === "individual" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-sm text-slate-600 mb-4">
            Search for a student and assign this plan individually.
            Use this for exceptions — e.g. a student on a custom fee structure.
          </p>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search student name or admission no..."
              value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {studentSearch.length > 0 && studentSearch.length <= 2 && (
            <p className="text-xs text-slate-400 text-center py-2">Type at least 3 characters</p>
          )}
          {studentList.length > 0 && (
            <div className="space-y-2">
              {studentList.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{s.firstName} {s.lastName}</p>
                    <p className="text-xs text-slate-400">{s.admissionNumber}</p>
                  </div>
                  <button
                    onClick={() => assignToStudent(s.id, `${s.firstName} ${s.lastName}`)}
                    disabled={assigningStudent === s.id || !activeYear}
                    className="px-3 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg font-medium disabled:opacity-50 transition-colors">
                    {assigningStudent === s.id ? "Assigning..." : "Assign"}
                  </button>
                </div>
              ))}
            </div>
          )}
          {studentSearch.length > 2 && studentList.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">No students found</p>
          )}
        </div>
      )}
    </div>
  );
}
