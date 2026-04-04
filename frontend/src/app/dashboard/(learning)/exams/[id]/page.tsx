"use client";
import { use, useState, useEffect } from "react";
import { useRouter }   from "next/navigation";
import {
  ArrowLeft, Plus, Save, BookOpen,
  CheckCircle, XCircle, ChevronDown, ChevronUp,
} from "lucide-react";
import { Badge }     from "@/components/ui/badge";
import { useApi, useClasses, useSubjects, useAcademicSessions } from "@/lib/hooks";
import { apiClient } from "@/lib/api";
import { useToast } from '@/lib/use-toast';


function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function gradeColor(g: string) {
  if (g === "A+" || g === "A") return "text-emerald-600 font-bold";
  if (g === "B+" || g === "B") return "text-blue-600 font-bold";
  if (g === "C")               return "text-amber-600 font-bold";
  return "text-red-500 font-bold";
}

export default function ExamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }  = use(params);
  const router  = useRouter();

  const { data: exam, loading, refetch } = useApi<any>(`/examinations/${id}`);
  const { data: sessions } = useAcademicSessions();
  const currentSession     = sessions?.find((s: any) => s.isCurrent) ?? sessions?.[0];
  const { data: classes }  = useClasses(currentSession?.id ?? "");
  const { data: subjects } = useSubjects();

  const { toast } = useToast();

  const [tab, setTab] = useState<"schedules"|"marks"|"results">("schedules");

  // ── Add schedule ──
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [savingSched, setSavingSched] = useState(false);
  const [schedForm, setSchedForm] = useState({
    classId: "", subjectId: "", date: "",
    startTime: "09:00", endTime: "11:00",
    maxMarks: "100", passMarks: "35", hallId: "",
  });
  const sf = (k: string) => (e: any) => setSchedForm(p => ({ ...p, [k]: e.target.value }));

  const addSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSched(true);
    try {
      await apiClient.post(`/examinations/${id}/schedules`, {
        classId:   schedForm.classId,
        subjectId: schedForm.subjectId,
        date:      schedForm.date,
        startTime: schedForm.startTime,
        endTime:   schedForm.endTime,
        maxMarks:  parseFloat(schedForm.maxMarks),
        passMarks: parseFloat(schedForm.passMarks),
        hallId:    schedForm.hallId || undefined,
      });
      setShowScheduleForm(false);
      setSchedForm({ classId:"", subjectId:"", date:"", startTime:"09:00", endTime:"11:00", maxMarks:"100", passMarks:"35", hallId:"" });
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed");
    } finally {
      setSavingSched(false);
    }
  };

  // ── Marks entry ──
  const [selectedSched, setSelectedSched] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const { data: studentsData } = useApi<any>(
    selectedClass ? `/students?sectionId=${selectedClass}&limit=100` : "",
    [selectedClass]
  );
  const students = studentsData?.data ?? [];

  // marks state: { [studentId]: { marksObtained: string, isAbsent: boolean } }
  const [marks, setMarks] = useState<Record<string, { marksObtained: string; isAbsent: boolean }>>({});
  const [savingMarks, setSavingMarks] = useState(false);
  const [marksSubmitted, setMarksSubmitted] = useState(false);

  useEffect(() => {
    if (students.length > 0) {
      const m: Record<string, { marksObtained: string; isAbsent: boolean }> = {};
      students.forEach((s: any) => { m[s.id] = { marksObtained: "", isAbsent: false }; });
      setMarks(m);
      setMarksSubmitted(false);
    }
  }, [selectedClass, selectedSched]);

  const submitMarks = async () => {
    if (!selectedSched) { toast.error("Select a schedule first"); return; }
    if (students.length === 0) { toast.error("No students found"); return; }
    setSavingMarks(true);
    try {
      await apiClient.post("/examinations/marks/bulk", {
        examId: id,
        marks: students.map((s: any) => ({
          studentId:     s.id,
          scheduleId:    selectedSched,
          marksObtained: marks[s.id]?.isAbsent ? undefined : parseFloat(marks[s.id]?.marksObtained || "0"),
          isAbsent:      marks[s.id]?.isAbsent ?? false,
        })),
      });
      setMarksSubmitted(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to submit marks");
    } finally {
      setSavingMarks(false);
    }
  };

  // ── Results ──
  const [resultsClassId, setResultsClassId] = useState("");
  const { data: results, loading: rLoading } = useApi<any>(
    resultsClassId ? `/examinations/${id}/results/class/${resultsClassId}` : "",
    [resultsClassId]
  );

  const allSections = classes?.flatMap((c: any) =>
    (c.sections ?? []).map((s: any) => ({ ...s, className: c.name, classId: c.id }))
  ) ?? [];

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!exam) return <div className="text-center py-24 text-slate-400">Exam not found</div>;

  const isPast = new Date(exam.endDate) < new Date();

  return (
    <div>
      <button onClick={() => router.push("/dashboard/exams")}
        className="flex items-center gap-2 text-slate-400 hover:text-slate-700 text-sm mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Examinations
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mb-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{exam.name}</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {fmtDate(exam.startDate)} – {fmtDate(exam.endDate)}
            </p>
            <div className="flex gap-2 mt-2">
              <Badge label={exam.type} variant={
                exam.type === "FINAL" ? "error" : exam.type === "MID_TERM" ? "warning" : "info"
              } />
              <Badge
                label={exam.isPublished ? "Published" : isPast ? "Completed" : "Draft"}
                variant={exam.isPublished ? "success" : "neutral"}
              />
              <Badge label={`${exam.schedules?.length ?? 0} subjects`} variant="neutral" />
            </div>
          </div>
          {!exam.isPublished && (
            <button
              onClick={async () => {
                try { await apiClient.post(`/examinations/${id}/publish`, {}); refetch(); }
                catch (err: any) { toast.error(err?.response?.data?.message ?? "Failed"); }
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors">
              Publish Exam
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 mb-6">
        {(["schedules","marks","results"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
              tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            {t === "schedules" ? `Schedules (${exam.schedules?.length ?? 0})` : t === "marks" ? "Enter Marks" : "Results"}
          </button>
        ))}
      </div>

      {/* ── SCHEDULES TAB ── */}
      {tab === "schedules" && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => setShowScheduleForm(p => !p)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" /> Add Subject Schedule
            </button>
          </div>

          {showScheduleForm && (
            <div className="bg-white border border-blue-100 rounded-xl p-5 mb-5 shadow-sm">
              <h3 className="font-semibold text-slate-900 mb-4 text-sm">Add Subject Schedule</h3>
              <form onSubmit={addSchedule} className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Class *</label>
                  <select required value={schedForm.classId} onChange={sf("classId")}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select class</option>
                    {classes?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Subject *</label>
                  <select required value={schedForm.subjectId} onChange={sf("subjectId")}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select subject</option>
                    {subjects?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Date *</label>
                  <input required type="date" value={schedForm.date} onChange={sf("date")}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Start Time</label>
                  <input type="time" value={schedForm.startTime} onChange={sf("startTime")}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">End Time</label>
                  <input type="time" value={schedForm.endTime} onChange={sf("endTime")}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Max Marks *</label>
                  <input required type="number" min="1" value={schedForm.maxMarks} onChange={sf("maxMarks")}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Pass Marks *</label>
                  <input required type="number" min="1" value={schedForm.passMarks} onChange={sf("passMarks")}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Hall / Room</label>
                  <input type="text" placeholder="e.g. Hall A" value={schedForm.hallId} onChange={sf("hallId")}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="md:col-span-4 flex gap-3">
                  <button type="submit" disabled={savingSched}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors">
                    {savingSched ? "Adding..." : "Add Schedule"}
                  </button>
                  <button type="button" onClick={() => setShowScheduleForm(false)}
                    className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm rounded-lg transition-colors">Cancel</button>
                </div>
              </form>
            </div>
          )}

          {/* Schedules table */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {["Subject","Class","Date","Time","Max","Pass","Hall"].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {!exam.schedules || exam.schedules.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400 text-sm">
                    No schedules yet. Add subjects above.
                  </td></tr>
                ) : exam.schedules.map((s: any) => {
                  const subj = subjects?.find((sub: any) => sub.id === s.subjectId);
                  const cls  = classes?.find((c: any) => c.id === s.classId);
                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-900">{subj?.name ?? s.subjectId.substring(0,8)}</td>
                      <td className="px-5 py-3 text-slate-600">{cls?.name ?? "—"}</td>
                      <td className="px-5 py-3 text-slate-600">{fmtDate(s.date)}</td>
                      <td className="px-5 py-3 text-slate-500 text-xs">{s.startTime} – {s.endTime}</td>
                      <td className="px-5 py-3 text-slate-700 font-medium">{s.maxMarks}</td>
                      <td className="px-5 py-3 text-slate-500">{s.passMarks}</td>
                      <td className="px-5 py-3 text-slate-400">{s.hallId ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MARKS TAB ── */}
      {tab === "marks" && (
        <div>
          {/* Selectors */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 mb-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Schedule (Subject)</label>
                <select value={selectedSched} onChange={e => setSelectedSched(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select schedule</option>
                  {exam.schedules?.map((s: any) => {
                    const subj = subjects?.find((sub: any) => sub.id === s.subjectId);
                    return <option key={s.id} value={s.id}>{subj?.name ?? s.subjectId} — Max: {s.maxMarks}</option>;
                  })}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Section</label>
                <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select section</option>
                  {allSections.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.className} — {s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Success banner */}
          {marksSubmitted && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-5 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              <p className="text-sm font-semibold text-emerald-800">Marks submitted successfully</p>
            </div>
          )}

          {/* Marks sheet */}
          {selectedSched && selectedClass && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              {(() => {
                const sched = exam.schedules?.find((s: any) => s.id === selectedSched);
                const maxM  = sched?.maxMarks ?? 100;
                return (
                  <>
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">{students.length} students</p>
                        <p className="text-xs text-slate-400">Max marks: {maxM} · Pass: {sched?.passMarks}</p>
                      </div>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {students.length === 0 ? (
                        <p className="px-5 py-12 text-center text-slate-400 text-sm">No students in this section</p>
                      ) : students.map((s: any, idx: number) => (
                        <div key={s.id} className="px-5 py-3 flex items-center gap-4">
                          <span className="text-xs text-slate-400 w-6 text-right flex-shrink-0">{idx + 1}</span>
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                            {s.firstName[0]}{s.lastName[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900">{s.firstName} {s.lastName}</p>
                            <p className="text-xs text-slate-400">{s.admissionNumber}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
                              <input type="checkbox"
                                checked={marks[s.id]?.isAbsent ?? false}
                                onChange={e => setMarks(p => ({ ...p, [s.id]: { ...p[s.id], isAbsent: e.target.checked } }))}
                                className="accent-red-500 w-3.5 h-3.5"
                              />
                              Absent
                            </label>
                            <input
                              type="number" min="0" max={maxM}
                              placeholder="0"
                              disabled={marks[s.id]?.isAbsent}
                              value={marks[s.id]?.marksObtained ?? ""}
                              onChange={e => setMarks(p => ({ ...p, [s.id]: { ...p[s.id], marksObtained: e.target.value } }))}
                              className="w-24 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400 text-center"
                            />
                            <span className="text-xs text-slate-400">/ {maxM}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="px-5 py-4 border-t border-slate-100 flex justify-end">
                      <button onClick={submitMarks} disabled={savingMarks || students.length === 0}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                        <Save className="w-4 h-4" />
                        {savingMarks ? "Submitting..." : "Submit Marks"}
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {(!selectedSched || !selectedClass) && (
            <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400 text-sm">
              Select a schedule and section above to enter marks
            </div>
          )}
        </div>
      )}

      {/* ── RESULTS TAB ── */}
      {tab === "results" && (
        <div>
          <div className="mb-5 max-w-xs">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Select Class</label>
            <select value={resultsClassId} onChange={e => setResultsClassId(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select class</option>
              {classes?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {rLoading && <div className="text-center py-12 text-slate-400 text-sm">Loading results...</div>}

          {results && (
            <div>
              {/* Toppers */}
              {results.toppers?.length > 0 && (
                <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-5 mb-5">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-widest mb-3">🏆 Top Performers</p>
                  <div className="flex gap-4 flex-wrap">
                    {results.toppers.map((t: any, i: number) => (
                      <div key={t.studentId} className="flex items-center gap-2">
                        <span className="text-lg">{["🥇","🥈","🥉"][i]}</span>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{t.student?.firstName} {t.student?.lastName}</p>
                          <p className={`text-xs ${gradeColor(t.grade)}`}>{t.percentage}% · {t.grade}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Results table */}
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-900">{results.results?.length ?? 0} students · Total marks: {results.totalMax}</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {["#","Student","Obtained","Total","Percentage","Grade","Status"].map(h => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {results.results?.map((r: any, i: number) => (
                      <tr key={r.studentId} className="hover:bg-slate-50">
                        <td className="px-5 py-3 text-slate-400 text-xs">{i + 1}</td>
                        <td className="px-5 py-3">
                          <p className="font-medium text-slate-900">{r.student?.firstName} {r.student?.lastName}</p>
                        </td>
                        <td className="px-5 py-3 font-semibold text-slate-900">{r.obtained}</td>
                        <td className="px-5 py-3 text-slate-500">{r.totalMax}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full w-16">
                              <div className={`h-full rounded-full ${r.percentage >= 75 ? "bg-emerald-500" : r.percentage >= 40 ? "bg-amber-400" : "bg-red-400"}`}
                                style={{ width: `${r.percentage}%` }} />
                            </div>
                            <span className="text-sm font-medium text-slate-700">{r.percentage}%</span>
                          </div>
                        </td>
                        <td className={`px-5 py-3 ${gradeColor(r.grade)}`}>{r.grade}</td>
                        <td className="px-5 py-3">
                          {r.percentage >= 40
                            ? <span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><CheckCircle className="w-3 h-3" />Pass</span>
                            : <span className="text-xs text-red-500 font-medium flex items-center gap-1"><XCircle className="w-3 h-3" />Fail</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!resultsClassId && !rLoading && (
            <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400 text-sm">
              Select a class to view results
            </div>
          )}
        </div>
      )}
    </div>
  );
}
