"use client";
import { useState, useRef } from "react";
import {
  Printer, Search, BookOpen, Download, Users,
  TrendingUp, Award, ChevronRight,
} from "lucide-react";
import { PageHeader }  from "@/components/ui/page-header";
import { Badge }       from "@/components/ui/badge";
import { useApi, useAcademicSessions, useExams, useClasses } from "@/lib/hooks";
import { apiClient }   from "@/lib/api";
import { useToast } from '@/lib/use-toast';


//const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://192.168.1.50:3000/api/v1";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
// ── Types ─────────────────────────────────────────────────────────────────────
interface SubjectResult {
  name: string; maxMarks: number; passMarks: number;
  obtained: number | null; isAbsent: boolean; grade: string;
}
interface ReportCard {
  studentId: string; studentName: string; admissionNo: string;
  rollNumber?: string; className: string; section: string;
  examName: string; sessionName: string;
  subjects: SubjectResult[];
  totalMax: number; totalObtained: number; percentage: number;
  grade: string; rank: number; totalStudents: number; passed: boolean;
  attendancePercentage?: number;
}
interface ClassResults {
  examId: string; classId: string; totalMax: number;
  toppers: any[]; results: any[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function gradeChip(g: string) {
  if (g === "A+" || g === "A") return "bg-emerald-100 text-emerald-700";
  if (g === "B+" || g === "B") return "bg-blue-100 text-blue-700";
  if (g === "C")               return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-600";
}
function pctColor(p: number) {
  if (p >= 75) return "text-emerald-600";
  if (p >= 50) return "text-amber-600";
  return "text-red-500";
}

// ── Print helper (opens new window, uses document-engine HTML) ────────────────
function printReportCard(card: ReportCard, schoolName: string) {
  // Build subject rows
  const rows = card.subjects.map(s => {
    const pass   = !s.isAbsent && (s.obtained ?? 0) >= s.passMarks;
    const status = s.isAbsent ? "AB" : pass ? "P" : "F";
    const statusClr = s.isAbsent ? "#d97706" : pass ? "#059669" : "#dc2626";
    return `<tr>
      <td>${s.name}</td>
      <td style="text-align:center">${s.maxMarks}</td>
      <td style="text-align:center;color:#64748b">${s.passMarks}</td>
      <td style="text-align:center;font-weight:700">${s.isAbsent ? '<span style="color:#d97706">ABSENT</span>' : s.obtained ?? "—"}</td>
      <td style="text-align:center"><span style="font-weight:700;color:${
        s.grade === "A+" || s.grade === "A" ? "#059669" :
        s.grade === "B+" || s.grade === "B" ? "#2563eb" :
        s.grade === "C" ? "#d97706" : "#dc2626"}">${s.grade}</span></td>
      <td style="text-align:center;color:${statusClr};font-weight:600">${status}</td>
    </tr>`;
  }).join("");

  const attHtml = card.attendancePercentage !== undefined ? `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;
      padding:10px 16px;margin-bottom:20px;display:flex;align-items:center;gap:10px">
      <span style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase">Attendance</span>
      <div style="flex:1;height:6px;background:#e2e8f0;border-radius:3px">
        <div style="height:100%;width:${card.attendancePercentage}%;border-radius:3px;
          background:${card.attendancePercentage >= 75 ? "#059669" : "#dc2626"}"></div>
      </div>
      <span style="font-size:13px;font-weight:700;color:${card.attendancePercentage >= 75 ? "#059669" : "#dc2626"}">${card.attendancePercentage}%</span>
    </div>
  ` : "";

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>Report Card – ${card.studentName}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,sans-serif;color:#1e293b;padding:32px}
    h1{font-size:22px;font-weight:800}
    table{width:100%;border-collapse:collapse;margin-bottom:20px}
    th,td{padding:9px 12px;border-bottom:1px solid #e2e8f0;font-size:13px}
    th{background:#f8fafc;font-size:11px;text-transform:uppercase;letter-spacing:.05em;font-weight:700}
    tr:nth-child(even) td{background:#fafafa}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
    .info-box{padding:10px 14px;border:1px solid #e2e8f0;border-radius:6px}
    .info-label{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;font-weight:600}
    .info-val{font-size:13px;font-weight:600;margin-top:2px}
    .summary{display:grid;grid-template-columns:repeat(5,1fr);border:2px solid #1e293b;border-radius:6px;overflow:hidden;margin-bottom:20px}
    .sum-cell{padding:10px 6px;text-align:center;border-right:1px solid #1e293b}
    .sum-label{font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase}
    .sum-val{font-size:16px;font-weight:800;margin-top:3px}
    .sigs{display:flex;justify-content:space-between;margin-top:48px}
    .sig{text-align:center}
    .sig-line{width:140px;height:1px;background:#1e293b;margin:0 auto 6px}
    .footer{margin-top:28px;padding-top:10px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8}
    @media print{body{padding:16px}@page{margin:1cm}}
  </style></head><body>
    <div style="text-align:center;border-bottom:3px solid #1e293b;padding-bottom:16px;margin-bottom:20px">
      <h1>${schoolName}</h1>
      <div style="font-size:16px;font-weight:800;letter-spacing:2px;margin-top:10px">REPORT CARD</div>
      <div style="font-size:12px;color:#64748b;margin-top:3px">${card.examName} · ${card.sessionName}</div>
    </div>
    <div class="grid2">
      <div class="info-box"><div class="info-label">Student Name</div><div class="info-val">${card.studentName}</div></div>
      <div class="info-box"><div class="info-label">Admission No.</div><div class="info-val">${card.admissionNo}</div></div>
      <div class="info-box"><div class="info-label">Class &amp; Section</div><div class="info-val">${card.className} – ${card.section}</div></div>
      <div class="info-box"><div class="info-label">Roll Number</div><div class="info-val">${card.rollNumber ?? "—"}</div></div>
    </div>
    <table>
      <thead><tr><th>Subject</th><th style="text-align:center">Max</th><th style="text-align:center">Pass</th><th style="text-align:center">Obtained</th><th style="text-align:center">Grade</th><th style="text-align:center">Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${attHtml}
    <div class="summary">
      <div class="sum-cell" style="background:#f8fafc"><div class="sum-label">Total</div><div class="sum-val">${card.totalObtained}/${card.totalMax}</div></div>
      <div class="sum-cell" style="background:#f8fafc"><div class="sum-label">Percentage</div><div class="sum-val">${card.percentage}%</div></div>
      <div class="sum-cell" style="background:${card.grade === "A+" || card.grade === "A" ? "#d1fae5" : card.grade === "B+" || card.grade === "B" ? "#dbeafe" : card.grade === "C" ? "#fef3c7" : "#fee2e2"}">
        <div class="sum-label">Grade</div>
        <div class="sum-val" style="color:${card.grade === "A+" || card.grade === "A" ? "#059669" : card.grade === "B+" || card.grade === "B" ? "#2563eb" : card.grade === "C" ? "#d97706" : "#dc2626"}">${card.grade}</div>
      </div>
      <div class="sum-cell" style="background:#f8fafc"><div class="sum-label">Rank</div><div class="sum-val">${card.rank}/${card.totalStudents}</div></div>
      <div class="sum-cell" style="background:${card.passed ? "#d1fae5" : "#fee2e2"}">
        <div class="sum-label">Result</div>
        <div class="sum-val" style="color:${card.passed ? "#059669" : "#dc2626"}">${card.passed ? "PASS" : "FAIL"}</div>
      </div>
    </div>
    <div class="sigs">
      <div class="sig"><div class="sig-line"></div><div style="font-size:11px;color:#64748b">Class Teacher</div></div>
      <div class="sig"><div class="sig-line"></div><div style="font-size:11px;color:#64748b">Exam Controller</div></div>
      <div class="sig"><div class="sig-line"></div><div style="font-size:11px;color:#64748b">Principal</div></div>
    </div>
    <div class="footer">
      <span>Generated: ${new Date().toLocaleDateString("en-IN")}</span>
      <span>Computer-generated · SchoolOS</span>
    </div>
  </body></html>`);
  w.document.close();
  w.focus();
  w.print();
  w.close();
}

// ── Page component ────────────────────────────────────────────────────────────
export default function ReportCardsPage() {
  const { data: sessions }     = useAcademicSessions();
  const currentSession         = sessions?.find(s => s.isCurrent) ?? sessions?.[0];
  const { toast } = useToast();

  const [sessionId, setSessionId] = useState("");
  const activeSession          = sessionId || currentSession?.id || "";

  const { data: exams }   = useExams(activeSession);
  const { data: classes } = useClasses(activeSession);

  const [examId,       setExamId]       = useState("");
  const [classId,      setClassId]      = useState("");
  const [search,       setSearch]       = useState("");
  const [loading,      setLoading]      = useState(false);
  const [listResults,  setListResults]  = useState<ClassResults | null>(null);
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [card,         setCard]         = useState<ReportCard | null>(null);
  const [cardLoading,  setCardLoading]  = useState(false);

  const exam  = exams?.find((e: any) => e.id === examId);
  const cls   = classes?.find((c: any) => c.id === classId);

  // Load class results list (uses existing examinations endpoint)
  const fetchClassResults = async () => {
    if (!examId || !classId) return;
    setLoading(true);
    setListResults(null);
    setCard(null);
    setSelectedId(null);
    try {
      const res = await apiClient.get(`/examinations/${examId}/results/class/${classId}`);
      setListResults(res.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to load results");
    } finally {
      setLoading(false);
    }
  };

  // Load full report card for a student (new endpoint)
  const viewCard = async (studentId: string) => {
    setSelectedId(studentId);
    setCardLoading(true);
    setCard(null);
    try {
      const res = await apiClient.get(
        `/report-cards/${examId}/${studentId}?sessionId=${activeSession}`
      );
      setCard(res.data);
    } catch {
      setCard(null);
    } finally {
      setCardLoading(false);
    }
  };

  const filtered = (listResults?.results ?? []).filter((r: any) => {
    if (!search) return true;
    const name = `${r.student?.firstName ?? ""} ${r.student?.lastName ?? ""}`.toLowerCase();
    return name.includes(search.toLowerCase()) || r.student?.admissionNumber?.includes(search);
  });

  const avgPct = filtered.length > 0
    ? Math.round(filtered.reduce((s: number, r: any) => s + r.percentage, 0) / filtered.length)
    : 0;

  return (
    <div>
      <PageHeader title="Report Cards" subtitle="Generate and print student report cards per exam" />

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Session */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Session</label>
            <select
              value={activeSession}
              onChange={e => { setSessionId(e.target.value); setListResults(null); setCard(null); }}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select session</option>
              {sessions?.map(s => (
                <option key={s.id} value={s.id}>{s.name}{s.isCurrent ? " (Current)" : ""}</option>
              ))}
            </select>
          </div>

          {/* Exam */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Exam</label>
            <select
              value={examId}
              onChange={e => { setExamId(e.target.value); setListResults(null); setCard(null); }}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select exam</option>
              {exams?.map((e: any) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>

          {/* Class */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Class</label>
            <select
              value={classId}
              onChange={e => { setClassId(e.target.value); setListResults(null); setCard(null); }}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select class</option>
              {classes?.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Load button */}
          <div className="flex items-end">
            <button
              onClick={fetchClassResults}
              disabled={!examId || !classId || loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors"
            >
              {loading ? "Loading…" : "Load Results"}
            </button>
          </div>
        </div>
      </div>

      {/* Stats bar — only when class results loaded */}
      {listResults && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { icon: Users,     label: "Students",    value: listResults.results.length,  color: "text-blue-600"  },
            { icon: TrendingUp,label: "Class Avg",   value: `${avgPct}%`,                color: pctColor(avgPct) },
            { icon: Award,     label: "Toppers",     value: listResults.toppers?.length ?? "—", color: "text-amber-600" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4 flex items-center gap-3">
              <div className={`${color}`}><Icon className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-slate-500">{label}</p>
                <p className={`text-lg font-bold ${color}`}>{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {listResults ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ── Student list ── */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              {/* Search */}
              <div className="px-4 py-3 border-b border-slate-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text" placeholder="Search name or admission no…"
                    value={search} onChange={e => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* List */}
              <div className="divide-y divide-slate-50 max-h-[520px] overflow-y-auto">
                {filtered.map((r: any, i: number) => (
                  <button
                    key={r.studentId}
                    onClick={() => viewCard(r.studentId)}
                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center gap-3 ${
                      selectedId === r.studentId ? "bg-blue-50 border-l-2 border-blue-500" : ""
                    }`}
                  >
                    {/* Rank badge */}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      i === 0 ? "bg-amber-100 text-amber-700" :
                      i === 1 ? "bg-slate-100 text-slate-600" :
                      i === 2 ? "bg-orange-100 text-orange-700" :
                      "bg-slate-50 text-slate-400"
                    }`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {r.student?.firstName} {r.student?.lastName}
                      </p>
                      <p className="text-xs text-slate-400">{r.obtained}/{r.totalMax} · {r.percentage}%</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${gradeChip(r.grade)}`}>
                        {r.grade}
                      </span>
                      <ChevronRight className="w-3 h-3 text-slate-300" />
                    </div>
                  </button>
                ))}
              </div>

              {/* Footer */}
              <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100">
                <p className="text-xs text-slate-400">{filtered.length} of {listResults.results.length} students · Avg {avgPct}%</p>
              </div>
            </div>
          </div>

          {/* ── Report card panel ── */}
          <div className="lg:col-span-3">
            {!selectedId ? (
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-16 text-center text-slate-400">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Select a student to view their report card</p>
              </div>
            ) : cardLoading ? (
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-16 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : card ? (
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">

                {/* Card toolbar */}
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{card.studentName}</p>
                    <p className="text-xs text-slate-400">{card.admissionNo} · {card.className} {card.section}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => printReportCard(card, "SchoolOS")}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-700 text-white text-xs rounded-lg transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print
                    </button>
                    <a
                      href={`${API_URL}/report-cards/${examId}/${card.studentId}/pdf?sessionId=${activeSession}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> PDF
                    </a>
                  </div>
                </div>

                {/* Exam info */}
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">{card.examName} · {card.sessionName}</span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    card.passed ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
                  }`}>
                    {card.passed ? "PASS" : "FAIL"}
                  </span>
                </div>

                {/* Summary stats */}
                <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-100">
                  {[
                    { label: "Marks",      value: `${card.totalObtained}/${card.totalMax}` },
                    { label: "Percentage", value: `${card.percentage}%`,                    color: pctColor(card.percentage) },
                    { label: "Grade",      value: card.grade,                               chip: true },
                    { label: "Rank",       value: `${card.rank}/${card.totalStudents}` },
                  ].map(({ label, value, color, chip }) => (
                    <div key={label} className="px-4 py-3 text-center">
                      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                      {chip
                        ? <span className={`text-sm font-bold px-2 py-0.5 rounded ${gradeChip(value)}`}>{value}</span>
                        : <p className={`text-base font-bold ${color ?? "text-slate-900"}`}>{value}</p>
                      }
                    </div>
                  ))}
                </div>

                {/* Subject marks table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50">
                        {["Subject", "Max", "Pass", "Obtained", "Grade", "Status"].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {card.subjects.map(s => {
                        const pass = !s.isAbsent && (s.obtained ?? 0) >= s.passMarks;
                        return (
                          <tr key={s.name} className="hover:bg-slate-50/50">
                            <td className="px-4 py-2.5 font-medium text-slate-800">{s.name}</td>
                            <td className="px-4 py-2.5 text-slate-600">{s.maxMarks}</td>
                            <td className="px-4 py-2.5 text-slate-500">{s.passMarks}</td>
                            <td className="px-4 py-2.5 font-semibold">
                              {s.isAbsent
                                ? <span className="text-amber-500 text-xs font-semibold">ABSENT</span>
                                : s.obtained ?? "—"
                              }
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded ${gradeChip(s.grade)}`}>{s.grade}</span>
                            </td>
                            <td className="px-4 py-2.5">
                              {s.isAbsent
                                ? <Badge label="Absent"  variant="warning" />
                                : <Badge label={pass ? "Pass" : "Fail"} variant={pass ? "success" : "error"} />
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Attendance bar */}
                {card.attendancePercentage !== undefined && (
                  <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center gap-3">
                    <span className="text-xs text-slate-500 font-semibold w-20">Attendance</span>
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          card.attendancePercentage >= 75 ? "bg-emerald-500" : "bg-red-400"
                        }`}
                        style={{ width: `${Math.min(card.attendancePercentage, 100)}%` }}
                      />
                    </div>
                    <span className={`text-sm font-bold w-10 text-right ${
                      card.attendancePercentage >= 75 ? "text-emerald-600" : "text-red-500"
                    }`}>
                      {card.attendancePercentage}%
                    </span>
                    {card.attendancePercentage < 75 && (
                      <Badge label="Below 75%" variant="error" />
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-10 text-center text-slate-400">
                <p className="text-sm">Could not load report card. Try again.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-16 text-center text-slate-400">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Select session, exam and class — then click Load Results</p>
        </div>
      )}
    </div>
  );
}
