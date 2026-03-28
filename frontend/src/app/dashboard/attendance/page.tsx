"use client";
import { HelpTip } from "@/components/ui/help-tip";
import { HELP }    from "@/lib/help-content";
import { useState, useEffect }  from "react";
import { ClipboardCheck, Send, Users, AlertCircle } from "lucide-react";
import { PageHeader }           from "@/components/ui/page-header";
import { StatCard }             from "@/components/ui/stat-card";
import { useApi, useAttendanceStats } from "@/lib/hooks";
import { apiClient }            from "@/lib/api";
import { useSearchParams }         from "next/navigation";
import { FilterBuilder }           from "@/components/ui/filter-builder";
import { Pagination }              from "@/components/ui/pagination";
import { ATTENDANCE_FILTER_SCHEMA }from "@/lib/filter-schemas";
import { useFilterParams }         from "@/lib/use-filter-params";

const STATUS_OPTIONS = ["PRESENT","ABSENT","LATE","HALF_DAY","ON_LEAVE"] as const;
type Status = typeof STATUS_OPTIONS[number];

const statusColor: Record<Status, string> = {
  PRESENT:  "bg-emerald-50 border-emerald-300 text-emerald-700",
  ABSENT:   "bg-red-50    border-red-300    text-red-700",
  LATE:     "bg-amber-50  border-amber-300  text-amber-700",
  HALF_DAY: "bg-blue-50   border-blue-300   text-blue-700",
  ON_LEAVE: "bg-purple-50 border-purple-300 text-purple-700",
};

export default function AttendancePage() {
  const today     = new Date().toISOString().split("T")[0];
  const [pageTab, setPageTab] = useState<"mark"|"history">("mark");
  const searchParams = useSearchParams();
  const qs           = searchParams.toString();
  const { data: historyData, loading: hLoad } = useApi<{data:any[];meta:any}>(
    pageTab === "history" ? `/attendance${qs ? "?" + qs : ""}` : "",
    [pageTab, qs]
  );
  const historyList = historyData?.data ?? [];

  const [date,      setDate]      = useState(today);
  const [sessionId, setSessionId] = useState("");
  const [classId,   setClassId]   = useState("");
  const [sectionId, setSectionId] = useState("");
  const [attendance, setAttendance] = useState<Record<string, Status>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);

  const { data: stats,    loading: statsLoading } = useAttendanceStats(date);
  const { data: sessions }                        = useApi<any[]>("/academic-sessions");
  const currentSession = sessions?.find((s: any) => s.isCurrent) ?? sessions?.[0];
  const activeSession  = sessionId || currentSession?.id || "";

  const { data: classes } = useApi<any[]>(
    activeSession ? `/academics/classes?sessionId=${activeSession}` : "",
    [activeSession]
  );

  // Sections for selected class
  const sections = classes?.find((c: any) => c.id === classId)?.sections ?? [];

  // Students for selected section via attendance endpoint
  const { data: sectionData } = useApi<any>(
    sectionId ? `/attendance/daily?sectionId=${sectionId}&date=${date}` : "",
    [sectionId, date]
  );

  // Build student list — from attendance records or empty
  const students: any[] = sectionData?.records?.map((r: any) => r.student) ?? [];

  // Auto-init attendance to PRESENT when section changes
  useEffect(() => {
    if (students.length > 0) {
      const map: Record<string, Status> = {};
      students.forEach(s => {
        // Pre-fill with existing status if already marked today
        const existing = sectionData?.records?.find((r: any) => r.student.id === s.id);
        map[s.id] = (existing?.status as Status) ?? "PRESENT";
      });
      setAttendance(map);
      setSubmitted(false);
    }
  }, [sectionId, date, sectionData]);

  // Reset section when class changes
  useEffect(() => {
    setSectionId("");
    setAttendance({});
    setSubmitted(false);
  }, [classId]);

  const markAll = (status: Status) => {
    const map: Record<string, Status> = {};
    students.forEach(s => { map[s.id] = status; });
    setAttendance(map);
  };

  const handleSubmit = async () => {
    if (!sectionId || students.length === 0) return;
    setSubmitting(true);
    try {
      await apiClient.post("/attendance/daily", {
        sectionId,
        sessionId: activeSession,
        date,
        attendance: students.map(s => ({
          studentId: s.id,
          status:    attendance[s.id] ?? "PRESENT",
        })),
      });
      setSubmitted(true);
    } catch (err: any) {
      alert(err?.response?.data?.message ?? "Failed to submit attendance");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedClass   = classes?.find((c: any) => c.id === classId);
  const selectedSection = sections.find((s: any) => s.id === sectionId);

  return (
    <div>
      <PageHeader title="Attendance" subtitle="Mark and track daily student attendance" />

      {/* Tab switcher */}
      <div className="flex gap-2 mb-6">
        {(["mark","history"] as const).map(t => (
          <button key={t} onClick={() => setPageTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              pageTab === t ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}>
            {t === "mark" ? "Mark Attendance" : "View History"}
          </button>
        ))}
      </div>

      {pageTab === "history" && (
        <div>
          <FilterBuilder schema={ATTENDANCE_FILTER_SCHEMA} className="mb-6" />
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            {hLoad ? (
              <div className="p-10 text-center text-slate-400 text-sm">Loading attendance records…</div>
            ) : historyList.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-sm">No records found. Adjust filters.</div>
            ) : (
              <>
                <div className="divide-y divide-slate-50">
                  {historyList.map((r: any) => (
                    <div key={r.id} className="px-5 py-3.5 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">
                          {r.student?.firstName} {r.student?.lastName}
                        </p>
                        <p className="text-xs text-slate-400">{r.student?.admissionNumber} · {r.date?.split("T")[0]}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        r.status === "PRESENT"  ? "bg-emerald-100 text-emerald-700" :
                        r.status === "ABSENT"   ? "bg-red-100 text-red-600" :
                        r.status === "LATE"     ? "bg-amber-100 text-amber-700" :
                        "bg-slate-100 text-slate-600"
                      }`}>{r.status}</span>
                    </div>
                  ))}
                </div>
                <Pagination meta={historyData?.meta} loading={hLoad} />
              </>
            )}
          </div>
        </div>
      )}

      {pageTab === "mark" && <>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Marked"  value={stats?.total   ?? 0}          icon={<Users className="w-5 h-5" />}         color="blue"   loading={statsLoading} />
        <StatCard label="Present"       value={stats?.present ?? 0}          icon={<ClipboardCheck className="w-5 h-5" />} color="green"  loading={statsLoading} />
        <StatCard label="Absent"        value={stats?.absent  ?? 0}          icon={<AlertCircle className="w-5 h-5" />}    color="red"    loading={statsLoading} />
        <StatCard label="Attendance %"  value={`${stats?.percentage ?? 0}%`} icon={<ClipboardCheck className="w-5 h-5" />} color="purple" loading={statsLoading} sub={`Today · ${date}`} />
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Date</label>
            <input
              type="date" value={date}
              onChange={(e) => { setDate(e.target.value); setSubmitted(false); }}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Session</label>
            <select
              value={activeSession}
              onChange={(e) => { setSessionId(e.target.value); setClassId(""); setSectionId(""); }}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select session</option>
              {sessions?.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}{s.isCurrent ? " (Current)" : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Class</label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              disabled={!activeSession}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">Select class</option>
              {classes?.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Section</label>
            <select
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              disabled={!classId}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">Select section</option>
              {sections.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Success banner */}
      {submitted && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-sm flex-shrink-0">✓</div>
          <div>
            <p className="font-semibold text-emerald-800 text-sm">Attendance submitted successfully</p>
            <p className="text-emerald-600 text-xs mt-0.5">
              {selectedClass?.name} — {selectedSection?.name} · {date} ·{" "}
              {Object.values(attendance).filter(s => s === "PRESENT").length} present ·{" "}
              {Object.values(attendance).filter(s => s === "ABSENT").length} absent
            </p>
          </div>
        </div>
      )}

      {/* Attendance sheet */}
      {sectionId && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-semibold text-slate-900 text-sm">
              {selectedClass?.name} — {selectedSection?.name}
              <span className="text-slate-400 font-normal ml-2">{students.length} students</span>
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Mark all:</span>
              {(["PRESENT","ABSENT"] as Status[]).map(s => (
                <button
                  key={s} onClick={() => markAll(s)}
                  className={`px-3 py-1 text-xs rounded-full border font-medium transition-colors ${statusColor[s]}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {students.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              No students in this section yet
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-50">
                {students.map((student: any, idx: number) => (
                  <div key={student.id} className="px-5 py-3 flex items-center gap-4">
                    <span className="text-xs text-slate-400 w-6 text-right flex-shrink-0">{idx + 1}</span>
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                      {student.firstName[0]}{student.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{student.firstName} {student.lastName}</p>
                      <p className="text-xs text-slate-400">
                        {student.admissionNumber}
                        {student.rollNumber ? ` · Roll ${student.rollNumber}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-1.5 flex-wrap justify-end">
                      {STATUS_OPTIONS.map(status => (
                        <button
                          key={status}
                          onClick={() => setAttendance(p => ({ ...p, [student.id]: status }))}
                          className={`px-2.5 py-1 text-xs rounded-full border font-medium transition-all ${
                            attendance[student.id] === status
                              ? statusColor[status]
                              : "bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300"
                          }`}
                        >
                          {status === "ON_LEAVE" ? "LEAVE" : status === "HALF_DAY" ? "HALF" : status}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex gap-4 text-xs flex-wrap">
                  {STATUS_OPTIONS.map(s => {
                    const count = Object.values(attendance).filter(v => v === s).length;
                    return count > 0 ? (
                      <span key={s} className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${
                          s === "PRESENT" ? "bg-emerald-500" : s === "ABSENT" ? "bg-red-500" :
                          s === "LATE" ? "bg-amber-500" : "bg-slate-400"
                        }`} />
                        <span className="text-slate-600">{count} {s === "ON_LEAVE" ? "Leave" : s.charAt(0) + s.slice(1).toLowerCase()}</span>
                      </span>
                    ) : null;
                  })}
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || students.length === 0}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Send className="w-4 h-4" />
                  {submitting ? "Submitting..." : submitted ? "✓ Resubmit" : "Submit Attendance"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
