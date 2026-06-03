"use client";
import { HelpTip } from "@/components/ui/help-tip";
import { HELP }    from "@/lib/help-content";
import { useState, useEffect }  from "react";
import { ClipboardCheck, Send, Users, AlertCircle, Calendar } from "lucide-react";
import { PageHeader }           from "@/components/ui/page-header";
import { StatCard }              from "@/components/ui/stat-card";
import { useApi, useAttendanceStats } from "@/lib/hooks";
import { apiClient }             from "@/lib/api";
import { useSearchParams }         from "next/navigation";
import { FilterBuilder }           from "@/components/ui/filter-builder";
import { Pagination }              from "@/components/ui/pagination";
import { ATTENDANCE_FILTER_SCHEMA }from "@/lib/filter-schemas";
import { useFilterParams }         from "@/lib/use-filter-params";
import { useToast } from '@/lib/use-toast';

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
  const currentYr = new Date().getFullYear();
  const currentMn = new Date().getMonth() + 1;
  
  // ⚡ Toast implementation loaded as an object
  const { toast } = useToast();

  const [pageTab, setPageTab] = useState<"mark"|"history"|"register">("mark");
  const searchParams = useSearchParams();
  const qs           = searchParams.toString();

  // History Query Hook
  const historyUrl =
  pageTab === "history" &&
  sectionId &&
  date
    ? `/attendance/daily?sectionId=${sectionId}&date=${date}`
    : "";

const {
  data: historyData,
  loading: hLoad,
  refetch: refetchHistory,
} = useApi<{ data: any[]; meta: any }>(
  historyUrl,
  [pageTab, sectionId, date]
);
const historyList = historyData?.data ?? [];


  // Core Operational States
  const [date, setDate]           = useState(today);
  const [sessionId, setSessionId] = useState("");
  const [classId,   setClassId]   = useState("");
  const [sectionId, setSectionId] = useState("");
  const [attendance, setAttendance] = useState<Record<string, Status>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);

  // Register Grid States
  const [registerMonth, setRegisterMonth] = useState<number>(currentMn);
  const [registerYear, setRegisterYear]   = useState<number>(currentYr);
  const [registerData, setRegisterData]   = useState<any>(null);
  const [loadingRegister, setLoadingRegister] = useState<boolean>(false);

  // Stats Hook
  const { data: stats, loading: statsLoading, refetch: refetchStats } = useAttendanceStats(date);
  const { data: sessions } = useApi<any[]>("/academic-sessions");
  const currentSession = sessions?.find((s: any) => s.isCurrent) ?? sessions?.[0];
  const activeSession  = sessionId || currentSession?.id || "";

  // Classes Data Fetch
  const { data: classes } = useApi<any[]>(
    activeSession ? `/academics/classes?sessionId=${activeSession}` : "",
    [activeSession]
  );

  // Dedicated API route query mapping execution to eliminate empty section bug
  const { data: runtimeSections } = useApi<any[]>(
    classId ? `/academics/sections?classId=${classId}` : "",
    [classId]
  );
  const sections = runtimeSections ?? [];

  const { data: rosterResponse } = useApi<any>(
  sectionId
    ? `/students?sectionId=${sectionId}`
    : "",
  [sectionId]
);

  // Daily records snapshot payload
  const { data: sectionData } = useApi<any>(
    sectionId ? `/attendance/daily?sectionId=${sectionId}&date=${date}` : "",
    [sectionId, date]
  );

 // const students: any[] = sectionData?.records?.map((r: any) => r.student) ?? [];
  const students: any[] = rosterResponse?.data ?? [];
  console.log("ROSTER STUDENTS", students);
console.log("SECTION DATA", sectionData);

  useEffect(() => {
  if (!students.length) {
    setAttendance({});
    return;
  }

  const map: Record<string, Status> = {};

  students.forEach((student) => {
    const existing =
      sectionData?.records?.find(
        (r: any) => r.studentId === student.id
      );

    map[student.id] =
      (existing?.status as Status) ?? "PRESENT";
  });

  setAttendance(map);
  setSubmitted(false);
}, [students, sectionData, sectionId, date]);









  useEffect(() => {
    setSectionId("");
    setAttendance({});
    setSubmitted(false);
    setRegisterData(null);
  }, [classId]);

  // Master Register Fetch Routine
  const loadRegister = async () => {
    if (!sectionId) return;
    setLoadingRegister(true);
    try {
      const { data } = await apiClient.get(
        `/attendance/register/monthly?sectionId=${sectionId}&month=${registerMonth}&year=${registerYear}`
      );
      setRegisterData(data);
    } catch (err: any) {
      // ⚡ Fix Line 118: Calling direct method parameter mapping
      toast.error(
        err?.response?.data?.message ?? "Failed to fetch register records logs"
      );
    } finally {
      setLoadingRegister(false);
    }
  };

  useEffect(() => {
    if (pageTab === "register" && sectionId) {
      loadRegister();
    }
  }, [pageTab, registerMonth, registerYear, sectionId]);

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
      
      // ⚡ Fix: True object success string mapping alignment
      toast.success("Attendance matrix synchronized successfully");
      
      if (typeof refetchStats === "function") refetchStats();
      if (typeof refetchHistory === "function") refetchHistory();
      if (sectionId) {
        loadRegister();
      }
    } catch (err: any) {
      // ⚡ Fix: True object error string mapping alignment
      toast.error(
        err?.response?.data?.message ?? "Failed to serialize attendance tracking ledger"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const selectedClass   = classes?.find((c: any) => c.id === classId);
  const selectedSection = sections?.find((s: any) => s.id === sectionId);

  return (
    <div className="space-y-6">
      <PageHeader title="Attendance" subtitle="Mark, audit, and track student systemic attendance matrices" />

      {/* Tab Switcher Panel */}
      <div className="flex gap-2 mb-6 border-b pb-3">
        {(["mark", "history", "register"] as const).map(t => (
          <button key={t} onClick={() => setPageTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              pageTab === t 
                ? "bg-blue-600 text-white shadow-sm" 
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}>
            {t === "mark" ? "Mark Attendance" : t === "history" ? "View History" : "Monthly Register"}
          </button>
        ))}
      </div>

      {/* Filter Options Workspace Dropdowns Box */}
      {pageTab !== "history" && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {pageTab === "mark" && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Date</label>
                <input
                  type="date" value={date}
                  onChange={(e) => { setDate(e.target.value); setSubmitted(false); }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
            
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Session</label>
              <select
                value={activeSession}
                onChange={(e) => { setSessionId(e.target.value); setClassId(""); setSectionId(""); }}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400 bg-white"
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
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400 bg-white"
              >
                <option value="">Select section</option>
                {sections?.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {pageTab === "register" && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Month</label>
                  <select
                    value={registerMonth}
                    onChange={(e) => setRegisterMonth(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                  >
                    <option value={1}>January</option>
                    <option value={2}>February</option>
                    <option value={3}>March</option>
                    <option value={4}>April</option>
                    <option value={5}>May</option>
                    <option value={6}>June</option>
                    <option value={7}>July</option>
                    <option value={8}>August</option>
                    <option value={9}>September</option>
                    <option value={10}>October</option>
                    <option value={11}>November</option>
                    <option value={12}>December</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Year</label>
                  <select
                    value={registerYear}
                    onChange={(e) => setRegisterYear(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                  >
                    <option value={2025}>2025</option>
                    <option value={2026}>2026</option>
                    <option value={2027}>2027</option>
                    <option value={2028}>2028</option>
                    <option value={2029}>2029</option>
                    <option value={2030}>2030</option>
                  </select>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB VIEW 1: HISTORY LOGS */}
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

      {/* TAB VIEW 2: MARK MODE */}
      {pageTab === "mark" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Marked"  value={stats?.total   ?? 0}         icon={<Users className="w-5 h-5" />}          color="blue"   loading={statsLoading} />
            <StatCard label="Present"       value={stats?.present ?? 0}         icon={<ClipboardCheck className="w-5 h-5" />} color="green"  loading={statsLoading} />
            <StatCard label="Absent"        value={stats?.absent  ?? 0}         icon={<AlertCircle className="w-5 h-5" />}    color="red"    loading={statsLoading} />
            <StatCard label="Attendance %"  value={`${stats?.percentage ?? 0}%`} icon={<ClipboardCheck className="w-5 h-5" />} color="purple" loading={statsLoading} sub={`Today · ${date}`} />
          </div>

          {submitted && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-5 flex items-center gap-3 animate-in fade-in duration-200">
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-sm flex-shrink-0">✓</div>
              <div>
                <p className="font-semibold text-emerald-800 text-sm">Attendance submitted successfully</p>
                <p className="text-emerald-600 text-xs mt-0.5">
                  {selectedClass?.name ?? "Class"} — {selectedSection?.name ?? "Section"} · {date} ·{" "}
                  {Object.values(attendance).filter(s => s === "PRESENT").length} present ·{" "}
                  {Object.values(attendance).filter(s => s === "ABSENT").length} absent
                </p>
              </div>
            </div>
          )}

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
                <div className="p-12 text-center text-slate-400 text-sm">No students in this section yet</div>
              ) : (
                <>
                  <div className="divide-y divide-slate-50">
                    {students.map((student: any, idx: number) => (
                      <div key={student.id} className="px-5 py-3 flex items-center gap-4">
                        <span className="text-xs text-slate-400 w-6 text-right flex-shrink-0">{idx + 1}</span>
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                          {student.firstName?.[0] ?? ""}{student.lastName?.[0] ?? ""}
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
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
                    >
                      <Send className="w-4 h-4" />
                      {submitting ? "Submitting..." : submitted ? "✓ Resubmit" : "Submit Attendance"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* 📊 TAB VIEW 3: REGISTER MODE VIEWPORTS */}
      {pageTab === "register" && (
        <div className="space-y-4">
          {!sectionId && (
            <div className="bg-white border rounded-xl p-8 text-center text-sm text-slate-400">
              Please select Class and Section to inspect the Monthly Register matrix logs.
            </div>
          )}

          {loadingRegister && (
            <div className="bg-white border rounded-xl p-12 text-center text-sm text-slate-500 flex items-center justify-center font-medium">
              <span className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2" />
              Compiling Monthly Attendance Cross-Grid Matrix...
            </div>
          )}

          {!loadingRegister && registerData && (
            <>
              {/* Responsive Summary Header + Clean Compact Legend Row Strip */}
              <div className="flex flex-col lg:flex-row gap-4 items-stretch">
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex-1">
                  <div className="flex flex-wrap items-center gap-6 text-sm">
                    <div>
                      <span className="text-slate-500">Students:</span>{" "}
                      <span className="font-semibold text-slate-800">
                        {registerData.totalStudents ?? registerData.register?.length ?? 0}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500">Month:</span>{" "}
                      <span className="font-semibold text-blue-600">
                        {new Date(registerYear, registerMonth - 1).toLocaleString("en-IN", {
                          month: "long",
                        })}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500">Days:</span>{" "}
                      <span className="font-semibold text-slate-800">
                        {registerData.daysInMonth ?? 30}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-medium text-slate-600">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] mr-1">Keys Legend:</span>
                  <div className="flex items-center gap-1"><span className="text-emerald-600 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">P</span> Present</div>
                  <div className="flex items-center gap-1"><span className="text-rose-600 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">A</span> Absent</div>
                  <div className="flex items-center gap-1"><span className="text-purple-600 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">L</span> Leave</div>
                  <div className="flex items-center gap-1"><span className="text-amber-600 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">LT</span> Late</div>
                  <div className="flex items-center gap-1"><span className="text-slate-400 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">-</span> Not Marked</div>
                </div>
              </div>

              {/* Cross Grid Register Matrix Table */}
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-3 py-3 font-semibold text-slate-500 uppercase tracking-wide w-12 text-center sticky left-0 bg-slate-50 z-10">Roll</th>
                        <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide min-w-[140px] sticky left-12 bg-slate-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Student</th>
                        
                        {Array.from({ length: registerData.daysInMonth ?? 30 }, (_, i) => i + 1).map((day) => (
                          <th key={day} className="p-2 font-semibold text-slate-500 text-center border-l border-slate-100/70 w-8">{day}</th>
                        ))}

                        <th className="px-3 py-3 font-bold text-slate-700 uppercase text-center bg-slate-50/80 border-l border-slate-200 w-12">P</th>
                        <th className="px-3 py-3 font-bold text-slate-700 uppercase text-center bg-slate-50/80 w-12">A</th>
                        <th className="px-3 py-3 font-bold text-slate-700 uppercase text-center bg-slate-50/80 w-12">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(registerData.register ?? []).map((row: any) => {
                        const markedDays = Object.values(row.attendance || {}).filter(v => !!v).length;
                        const presentCount = Object.values(row.attendance || {}).filter(v => v === "PRESENT").length;
                        const absentCount  = Object.values(row.attendance || {}).filter(v => v === "ABSENT").length;
                        
                        const pctCalc = markedDays > 0 ? Math.round((presentCount / markedDays) * 100) : 0;

                        return (
                          <tr key={row.studentId} className="hover:bg-slate-50/80 transition-colors group">
                            <td className="px-3 py-3 font-mono text-slate-400 text-center sticky left-0 bg-white group-hover:bg-slate-50 z-10">{row.rollNumber ?? "-"}</td>
                            <td className="px-4 py-3 font-medium text-slate-900 sticky left-12 bg-white group-hover:bg-slate-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] truncate">{row.name ?? `${row.firstName} ${row.lastName}`}</td>
                            
                            {Array.from({ length: registerData.daysInMonth ?? 30 }, (_, i) => i + 1).map((day) => {
                              const val = row.attendance?.[day] ?? "";
                              return (
                                <td key={day} className="p-1 border-l border-slate-50/60 text-center w-8 h-8">
                                  <span className={
                                    val === "PRESENT"  ? "text-emerald-600 font-bold" : 
                                    val === "ABSENT"   ? "text-rose-600 font-bold" : 
                                    val === "ON_LEAVE" ? "text-purple-600 font-bold" : 
                                    val === "LATE"     ? "text-amber-600 font-bold" : ""
                                  }>
                                    {val === "PRESENT" ? "P" : val === "ABSENT" ? "A" : val === "ON_LEAVE" ? "L" : val === "LATE" ? "LT" : "-"}
                                  </span>
                                </td>
                              );
                            })}

                            <td className="px-2 py-3 bg-slate-50/30 text-center font-bold text-emerald-600 border-l border-slate-200 font-mono">{presentCount}</td>
                            <td className="px-2 py-3 bg-slate-50/30 text-center font-bold text-rose-600 font-mono">{absentCount}</td>
                            <td className={`px-2 py-3 text-center font-extrabold font-mono ${pctCalc < 75 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}`}>{pctCalc}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
