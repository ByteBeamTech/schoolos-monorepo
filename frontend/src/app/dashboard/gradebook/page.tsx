"use client";
/**
 * Gradebook — /dashboard/gradebook/page.tsx
 *
 * Tab 1: Marks Entry
 *   • Select exam → select class → loads all students + subjects
 *   • Inline editable marks table (marks + absent toggle per student per subject)
 *   • Auto-calculates total, percentage, grade using grade boundaries
 *   • Bulk save all marks in one click
 *
 * Tab 2: Results View
 *   • Class result table with rank, percentage, grade
 *   • Sort by rank / name / percentage
 *
 * Tab 3: Report Cards
 *   • Generate report card for one student or full class
 *   • Download PDF via backend
 *   • Preview in page
 */
import { useState, useMemo, useCallback } from "react";
import { BookOpen, Download, FileText, ChevronUp, ChevronDown, CheckCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge }      from "@/components/ui/badge";
import { StatCard }   from "@/components/ui/stat-card";
import { useApi }     from "@/lib/hooks";
import { apiClient }  from "@/lib/api";
import { useToast }   from "@/lib/use-toast";

type Tab = "entry" | "results" | "report-cards";

function gradeColor(g: string) {
  if (g === "A+" || g === "A") return "success";
  if (g === "B+" || g === "B") return "info";
  if (g === "C" || g === "D")  return "warning";
  return "error";
}

export default function GradebookPage() {
  const { toast }  = useToast();
  const [tab, setTab] = useState<Tab>("entry");

  const { data: sessions } = useApi<any[]>("/academic-sessions");
  const currentSession     = sessions?.find((s: any) => s.isCurrent) ?? sessions?.[0];
  const [sessionId, setSessionId] = useState("");
  const active = sessionId || currentSession?.id || "";

  const { data: exams }    = useApi<any[]>(active ? `/examinations?sessionId=${active}` : "", [active]);
  const { data: classes }  = useApi<any[]>(active ? `/academics/classes?sessionId=${active}` : "", [active]);
  const { data: boundaries } = useApi<any[]>(active ? `/gradebook/boundaries?sessionId=${active}` : "", [active]);

  const [examId,   setExamId]   = useState("");
  const [classId,  setClassId]  = useState("");
  const [sortBy,   setSortBy]   = useState<"rank" | "name" | "pct">("rank");
  const [sortDir,  setSortDir]  = useState<"asc" | "desc">("asc");
  const [saving,   setSaving]   = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [generating,  setGenerating]  = useState(false);

  const { data: results, loading: rLoad, refetch: refetchResults } = useApi<any>(
    examId && classId ? `/gradebook/results?examId=${examId}&classId=${classId}&sessionId=${active}` : "",
    [examId, classId, active]
  );

  // Marks entry: local state per student per subject
  const [marksData, setMarksData] = useState<Record<string, { marks: string; absent: boolean }>>({});

  const subjects = useMemo(() => {
    if (!results?.schedules) return [];
    return results.schedules.map((s: any) => ({ id: s.id, name: s.subject?.name, max: s.maxMarks, pass: s.passMarks }));
  }, [results]);

  const students = useMemo(() => {
    if (!results?.students) return [];
    return results.students;
  }, [results]);

  // Init marks state when data loads
  const initMarks = useCallback(() => {
    if (!results?.rawMarks) return;
    const init: typeof marksData = {};
    results.rawMarks.forEach((m: any) => {
      init[`${m.studentId}-${m.scheduleId}`] = {
        marks:  m.isAbsent ? "" : String(m.marksObtained ?? ""),
        absent: m.isAbsent,
      };
    });
    setMarksData(init);
  }, [results]);

  const setMark = (studentId: string, scheduleId: string, value: string) =>
    setMarksData(p => ({ ...p, [`${studentId}-${scheduleId}`]: { marks: value, absent: false } }));

  const toggleAbsent = (studentId: string, scheduleId: string, absent: boolean) =>
    setMarksData(p => ({ ...p, [`${studentId}-${scheduleId}`]: { marks: "", absent } }));

  const saveAllMarks = async () => {
    if (!examId) return;
    setSaving(true);
    try {
      const entries = Object.entries(marksData).map(([key, val]) => {
        const [studentId, scheduleId] = key.split("-");
        return { studentId, scheduleId, marksObtained: val.absent ? null : parseFloat(val.marks) || 0, isAbsent: val.absent };
      });
      await apiClient.post("/gradebook/marks/bulk", { examId, marks: entries });
      toast.success("Marks saved successfully");
      refetchResults();
    } catch (err: any) {
      toast.error(err);
    } finally {
      setSaving(false);
    }
  };

  const downloadReport = async (studentId: string, studentName: string) => {
    setDownloading(studentId);
    try {
      const res = await apiClient.get(`/gradebook/report-card/pdf?examId=${examId}&studentId=${studentId}&sessionId=${active}`, { responseType: "blob" });
      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const a    = document.createElement("a");
      a.href = url;
      a.download = `report-card-${studentName.replace(/\s+/g, "-")}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err);
    } finally {
      setDownloading(null);
    }
  };

  const downloadAllReports = async () => {
    setGenerating(true);
    try {
      const res = await apiClient.get(`/gradebook/report-card/class-pdf?examId=${examId}&classId=${classId}&sessionId=${active}`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a   = document.createElement("a");
      a.href = url;
      a.download = `report-cards-${classId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("All report cards downloaded");
    } catch (err: any) {
      toast.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const sortedStudents = useMemo(() => {
    if (!students.length) return [];
    return [...students].sort((a: any, b: any) => {
      let va = sortBy === "rank" ? a.rank : sortBy === "name" ? a.studentName : a.percentage;
      let vb = sortBy === "rank" ? b.rank : sortBy === "name" ? b.studentName : b.percentage;
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === "asc" ? va - vb : vb - va;
    });
  }, [students, sortBy, sortDir]);

  const SortBtn = ({ col }: { col: typeof sortBy }) => (
    <button onClick={() => { if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortBy(col); setSortDir("asc"); } }}
      className="inline-flex items-center gap-0.5 text-slate-500 hover:text-slate-800 transition-colors">
      {sortBy === col ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ChevronDown className="w-3 h-3 opacity-30" />}
    </button>
  );

  return (
    <div>
      <PageHeader title="Gradebook" subtitle="Enter marks, view results, generate report cards" />

      {/* Session + Exam + Class selectors */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select value={active} onChange={e => setSessionId(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          {(sessions ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}{s.isCurrent ? " (Current)" : ""}</option>)}
        </select>
        <select value={examId} onChange={e => { setExamId(e.target.value); setMarksData({}); }}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Select exam…</option>
          {(exams ?? []).map((e: any) => <option key={e.id} value={e.id}>{e.name} ({e.type})</option>)}
        </select>
        <select value={classId} onChange={e => { setClassId(e.target.value); setMarksData({}); }}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Select class…</option>
          {(classes ?? []).filter((c: any) => c.isActive !== false).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Stats */}
      {results && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Students" value={results.totalStudents ?? 0} icon={<BookOpen className="w-5 h-5"/>} color="blue" loading={rLoad}/>
          <StatCard label="Passed" value={results.passedCount ?? 0} icon={<CheckCircle className="w-5 h-5"/>} color="green" loading={rLoad}/>
          <StatCard label="Avg %" value={`${Math.round(results.classAverage ?? 0)}%`} icon={<FileText className="w-5 h-5"/>} color="purple" loading={rLoad}/>
          <StatCard label="Highest" value={`${Math.round(results.highestPercentage ?? 0)}%`} icon={<ChevronUp className="w-5 h-5"/>} color="amber" loading={rLoad}/>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 mb-5">
        {(["entry", "results", "report-cards"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {t === "entry" ? "Marks Entry" : t === "results" ? "Results" : "Report Cards"}
          </button>
        ))}
      </div>

      {/* ── TAB: MARKS ENTRY ────────────────────────────────────────────────── */}
      {tab === "entry" && (
        <div>
          {!examId || !classId ? (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-12 text-center">
              <BookOpen className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">Select an exam and class to enter marks</p>
            </div>
          ) : rLoad ? (
            <div className="space-y-3">{[...Array(8)].map((_,i) => <div key={i} className="h-12 bg-slate-100 rounded animate-pulse"/>)}</div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <p className="text-sm text-slate-600">{students.length} students · {subjects.length} subjects</p>
                <button onClick={saveAllMarks} disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors">
                  {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
                  {saving ? "Saving…" : "Save All Marks"}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide sticky left-0 bg-slate-50 z-10 min-w-[160px]">Student</th>
                      {subjects.map((s: any) => (
                        <th key={s.id} className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide min-w-[100px]">
                          <div>{s.name}</div>
                          <div className="font-normal text-slate-400">/{s.max}</div>
                        </th>
                      ))}
                      <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">%</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {students.map((stu: any) => {
                      let total = 0, maxTotal = 0;
                      return (
                        <tr key={stu.studentId} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-2 sticky left-0 bg-white hover:bg-slate-50 z-10">
                            <p className="font-medium text-slate-900 text-xs">{stu.studentName}</p>
                            <p className="text-slate-400 text-[10px]">{stu.admissionNo}</p>
                          </td>
                          {subjects.map((subj: any) => {
                            const key  = `${stu.studentId}-${subj.id}`;
                            const val  = marksData[key] ?? { marks: String(stu.subjects?.[subj.name]?.obtained ?? ""), absent: false };
                            const num  = parseFloat(val.marks);
                            if (!val.absent && !isNaN(num)) { total += num; maxTotal += Number(subj.max); }
                            else if (!val.absent) maxTotal += Number(subj.max);
                            return (
                              <td key={subj.id} className="px-2 py-2 text-center">
                                {val.absent ? (
                                  <button onClick={() => toggleAbsent(stu.studentId, subj.id, false)}
                                    className="w-full py-1.5 text-xs bg-red-50 text-red-500 border border-red-200 rounded-md font-medium hover:bg-red-100 transition-colors">
                                    Absent
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number" min="0" max={subj.max}
                                      value={val.marks}
                                      onChange={e => setMark(stu.studentId, subj.id, e.target.value)}
                                      className="w-14 px-2 py-1.5 text-center text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <button onClick={() => toggleAbsent(stu.studentId, subj.id, true)}
                                      className="text-[10px] text-slate-300 hover:text-red-400 transition-colors px-0.5" title="Mark absent">
                                      A
                                    </button>
                                  </div>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-center font-semibold text-slate-800 text-xs">{maxTotal > 0 ? `${total}/${maxTotal}` : "—"}</td>
                          <td className="px-3 py-2 text-center text-xs font-semibold text-slate-700">{maxTotal > 0 ? `${Math.round(total / maxTotal * 100)}%` : "—"}</td>
                          <td className="px-3 py-2 text-center">
                            {stu.grade ? <Badge label={stu.grade} variant={gradeColor(stu.grade) as any}/> : <span className="text-slate-300">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: RESULTS ────────────────────────────────────────────────────── */}
      {tab === "results" && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          {!examId || !classId ? (
            <div className="p-12 text-center text-slate-400 text-sm">Select exam and class above to view results.</div>
          ) : rLoad ? (
            <div className="p-6 space-y-3">{[...Array(8)].map((_,i) => <div key={i} className="h-10 bg-slate-100 rounded animate-pulse"/>)}</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Rank <SortBtn col="rank"/>
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Student <SortBtn col="name"/>
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    % <SortBtn col="pct"/>
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Grade</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedStudents.map((s: any) => (
                  <tr key={s.studentId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className={`font-bold text-sm ${s.rank <= 3 ? "text-amber-500" : "text-slate-500"}`}>#{s.rank}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-900">{s.studentName}</p>
                      <p className="text-xs text-slate-400">{s.admissionNo}{s.rollNumber ? ` · Roll ${s.rollNumber}` : ""}</p>
                    </td>
                    <td className="px-4 py-3.5 text-center font-semibold text-slate-700">{s.totalObtained}/{s.totalMax}</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`font-semibold text-sm ${s.percentage >= 75 ? "text-emerald-600" : s.percentage >= 50 ? "text-amber-600" : "text-red-500"}`}>
                        {Math.round(s.percentage)}%
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <Badge label={s.grade} variant={gradeColor(s.grade) as any}/>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <Badge label={s.passed ? "Pass" : "Fail"} variant={s.passed ? "success" : "error"}/>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── TAB: REPORT CARDS ───────────────────────────────────────────────── */}
      {tab === "report-cards" && (
        <div>
          {!examId || !classId ? (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-12 text-center">
              <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">Select an exam and class to generate report cards</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <p className="text-sm text-slate-600">{students.length} students · Click any row to download individual report card</p>
                <button onClick={downloadAllReports} disabled={generating}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors">
                  {generating && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
                  <Download className="w-4 h-4"/>
                  {generating ? "Generating…" : "Download All (PDF)"}
                </button>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {["Student", "Rank", "Total", "%", "Grade", "Result", "Download"].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {sortedStudents.map((s: any) => (
                    <tr key={s.studentId} className="hover:bg-slate-50 transition-colors cursor-pointer">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-900">{s.studentName}</p>
                        <p className="text-xs text-slate-400">{s.admissionNo}</p>
                      </td>
                      <td className="px-5 py-3.5 font-bold text-amber-500">#{s.rank}</td>
                      <td className="px-5 py-3.5 text-slate-700">{s.totalObtained}/{s.totalMax}</td>
                      <td className="px-5 py-3.5 font-semibold text-slate-800">{Math.round(s.percentage)}%</td>
                      <td className="px-5 py-3.5"><Badge label={s.grade} variant={gradeColor(s.grade) as any}/></td>
                      <td className="px-5 py-3.5"><Badge label={s.passed ? "Pass" : "Fail"} variant={s.passed ? "success" : "error"}/></td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => downloadReport(s.studentId, s.studentName)}
                          disabled={downloading === s.studentId}
                          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50 transition-colors"
                        >
                          {downloading === s.studentId ? (
                            <span className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/>
                          ) : (
                            <Download className="w-3.5 h-3.5"/>
                          )}
                          PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
