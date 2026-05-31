"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import {
  X,
  User,
  Phone,
  Droplets,
  GraduationCap,
  ClipboardCheck,
  CreditCard,
  Bus,
  BookOpen,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { useApi } from "@/lib/hooks";

export default function StudentDrawerPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  // Core Telemetry & Academic Info
  const { data: student, loading } = useApi<any>(`/students/${id}`);
  
  // Phase 3 Accounts & Financials
  const { data: invoices } = useApi<any[]>(`/billing/invoices?studentId=${id}`, [id]);
  const totalDue = (invoices ?? []).reduce(
    (sum, inv) =>
      sum + (Number(inv.totalAmount || 0) - Number(inv.paidAmount || 0)),
    0
  );
  
  // Incident logs
  const { data: behaviorRecords } = useApi<any[]>(`/behavior/student/${id}`, [id]);
  const behaviorCount = behaviorRecords?.length ?? 0;

  // Attendance Metrics
  const { data: attendance } = useApi<any>(
    `/attendance/student/${id}?fromDate=${new Date(
      new Date().getFullYear(),
      0,
      1
    )
      .toISOString()
      .split("T")[0]}&toDate=${new Date()
      .toISOString()
      .split("T")[0]}`,
    [id]
  );
  
  const attendancePct = Number(
    attendance?.percentage ??
    attendance?.attendancePercentage ??
    attendance?.summary?.percentage ??
    0
  );

  // Library Integration
  const { data: libraryHistory } = useApi<any>(`/library/student/${id}`, [id]);
  const activeIssuesCount = Array.isArray(libraryHistory)
    ? libraryHistory.length
    : libraryHistory?.summary?.issuedCount ?? 0;
    
  const overdueCount = libraryHistory?.summary?.overdueCount ?? 0;
  const libraryFine = libraryHistory?.summary?.totalFine ?? 0;

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.back();
    };

    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [router]);

  const statusClass =
    student?.status === "ACTIVE" || student?.status === "ENROLLED"
      ? "bg-green-100 text-green-700"
      : student?.status === "TRANSFERRED"
      ? "bg-blue-100 text-blue-700"
      : student?.status === "ALUMNI"
      ? "bg-purple-100 text-purple-700"
      : student?.status === "INACTIVE"
      ? "bg-slate-100 text-slate-700"
      : "bg-red-100 text-red-700";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity"
        onClick={() => router.back()}
      />

      {/* 📱 Mobile Optimized Drawer Container */}
      <aside className="fixed top-0 right-0 h-full w-full sm:w-[550px] bg-white shadow-2xl z-50 flex flex-col border-l border-slate-100 transition-transform duration-300 ease-out">
        
        {/* Sticky Header */}
        <div className="sticky top-0 bg-white border-b px-4 sm:px-6 py-4 flex items-center justify-between z-10 flex-shrink-0">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">Student Snapshot</h2>
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/30">
          {loading ? (
            <div className="text-sm text-slate-500 font-medium flex items-center justify-center h-40">
              <span className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2" />
              Loading Telemetry Matrix...
            </div>
          ) : (
            <>
              {/* Profile Card */}
              <div className="border border-slate-100 bg-white rounded-xl p-4 sm:p-5 shadow-sm">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg sm:text-xl font-bold shadow-sm flex-shrink-0">
                    {student?.firstName?.[0] ?? ""}
                    {student?.lastName?.[0] ?? ""}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                      {student?.firstName} {student?.lastName}
                    </h3>
                    <p className="text-xs sm:text-sm font-mono text-slate-400 mt-0.5 truncate">
                      ID: {student?.admissionNumber}
                    </p>
                    <div className="mt-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${statusClass}`}>
                        {student?.status ?? "ENROLLED"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ⚡ Responsive Summary Grid Matrix */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="border border-slate-200 bg-white shadow-sm rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Roll No</p>
                  <p className="text-base sm:text-lg font-bold text-slate-800 mt-0.5 truncate">
                    {student?.rollNumber ?? "-"}
                  </p>
                </div>

                <div className="border border-slate-200 bg-white shadow-sm rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Attendance</p>
                  <p className={`text-base sm:text-lg font-bold mt-0.5 ${attendancePct < 75 ? "text-amber-600" : "text-emerald-600"}`}>
                    {attendancePct}%
                  </p>
                </div>

                <div className="border border-slate-200 bg-white shadow-sm rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Fee Due</p>
                  <p className={`text-base sm:text-lg font-bold mt-0.5 ${totalDue > 0 ? "text-red-600" : "text-emerald-600"}`}>
                    ₹{totalDue.toLocaleString("en-IN")}
                  </p>
                </div>

                <div className="border border-slate-200 bg-white shadow-sm rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Behaviour</p>
                  <p className={`text-base sm:text-lg font-bold mt-0.5 ${behaviorCount > 3 ? "text-amber-600" : "text-slate-800"}`}>
                    {behaviorCount} Logs
                  </p>
                </div>
              </div>

              {/* Academic Block */}
              <div className="border border-slate-100 bg-white shadow-sm rounded-xl p-4 space-y-3.5">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <GraduationCap className="w-4 h-4 text-blue-600" />
                  <h4 className="font-bold text-slate-900 text-sm">Academic Info</h4>
                </div>
                <div className="space-y-3">
                  <Row label="Class" value={student?.section?.class?.name ?? "-"} />
                  <Row label="Section" value={student?.section?.name ?? "-"} />
                  <Row label="Roll Number" value={student?.rollNumber ?? "-"} />
                  <Row label="Academic Session" value={student?.academicYear ?? "-"} />
                </div>
              </div>

              {/* Medical Block */}
              <div className="border border-slate-100 bg-white shadow-sm rounded-xl p-4 space-y-3.5">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <Droplets className="w-4 h-4 text-red-500" />
                  <h4 className="font-bold text-slate-900 text-sm">Medical Details</h4>
                </div>
                <Row
                  label="Blood Group"
                  value={
                    <span className="px-2 py-0.5 bg-red-50 text-red-700 rounded text-xs font-bold">
                      {student?.bloodGroup ?? "Not Documented"}
                    </span>
                  }
                />
              </div>

              {/* Attendance Analytics */}
              <div className="border border-slate-100 bg-white shadow-sm rounded-xl p-4 space-y-3.5">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <ClipboardCheck className="w-4 h-4 text-emerald-600" />
                  <h4 className="font-bold text-slate-900 text-sm">Attendance Analytics</h4>
                </div>
                <div className="space-y-3 text-sm">
                  <Row
                    label="Current Attendance"
                    value={<span className={`font-bold ${attendancePct < 75 ? "text-amber-600" : "text-emerald-600"}`}>{attendancePct}%</span>}
                  />
                  <Row label="Present Days" value={attendance?.summary?.present ?? 0} />
                  <Row label="Absent Days" value={attendance?.summary?.absent ?? 0} />
                </div>
              </div>

              {/* Guardian Block */}
              <div className="border border-slate-100 bg-white shadow-sm rounded-xl p-4 space-y-3.5">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <User className="w-4 h-4 text-indigo-600" />
                  <h4 className="font-bold text-slate-900 text-sm">Contact & Guardian</h4>
                </div>
                <div className="space-y-3 text-sm">
                  <Row
                    label="Primary Guardian"
                    value={
                      student?.guardianLinks?.[0]?.guardian
                        ? `${student.guardianLinks[0].guardian.firstName} ${student.guardianLinks[0].guardian.lastName}`
                        : "Not Linked"
                    }
                  />
                  <Row
                    label="Phone / Mobile"
                    value={
                      student?.guardianLinks?.[0]?.guardian?.phone ? (
                        <span className="flex items-center gap-1 text-slate-700 font-mono">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {student.guardianLinks[0].guardian.phone}
                        </span>
                      ) : "-"
                    }
                  />
                </div>
              </div>

              {/* Fees Block */}
              <div className="border border-slate-100 bg-white shadow-sm rounded-xl p-4 space-y-3.5">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <CreditCard className="w-4 h-4 text-amber-500" />
                  <h4 className="font-bold text-slate-900 text-sm">Fees</h4>
                </div>
                <div className="space-y-3 text-sm">
                  <Row label="Outstanding Due" value={`₹${totalDue.toLocaleString("en-IN")}`} />
                  <Row label="Invoices" value={String(invoices?.length ?? 0)} />
                </div>
              </div>

              {/* Behaviour Block */}
              <div className="border border-slate-100 bg-white shadow-sm rounded-xl p-4 space-y-3.5">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <ShieldAlert className="w-4 h-4 text-rose-500" />
                  <h4 className="font-bold text-slate-900 text-sm">Behaviour</h4>
                </div>
                <div className="space-y-3 text-sm">
                  <Row label="Records" value={behaviorCount} />
                </div>
              </div>

              {/* Library Block */}
              <div className="border border-slate-100 bg-white shadow-sm rounded-xl p-4 space-y-3.5">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <BookOpen className="w-4 h-4 text-cyan-600" />
                  <h4 className="font-bold text-slate-900 text-sm">Library</h4>
                </div>
                <div className="space-y-3 text-sm">
                  <Row label="Books Issued" value={activeIssuesCount} />
                  <Row label="Overdue" value={overdueCount} />
                  <Row 
                    label="Outstanding Fine" 
                    value={libraryFine > 0 ? <span className="text-red-600 font-semibold font-mono">₹{libraryFine}</span> : "₹0"} 
                  />
                </div>
              </div>

              {/* Transport 🚧 Coming Soon Section */}
              <div className="border border-slate-100 bg-white shadow-sm rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Bus className="w-4 h-4 text-slate-400" />
                  <h4 className="font-semibold text-slate-700 text-sm">Transport Allocation</h4>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <p className="text-xs font-medium text-amber-800">
                    Transport routing mapping will be live soon.
                  </p>
                  <span className="self-start sm:self-auto px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                    🚧 Coming Soon
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 📱 Sticky Fixed Bottom Action Panel for Safe Tap Navigation */}
        <div className="sticky bottom-0 bg-slate-50 border-t px-4 sm:px-6 py-4 flex-shrink-0 z-10">
          <Link
            href={`/dashboard/students/${id}`}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-md text-sm active:scale-[0.98]"
          >
            <ExternalLink className="w-4 h-4" />
            Open Full Profile
          </Link>
        </div>

      </aside>
    </>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-slate-400 text-xs sm:text-sm font-medium">{label}</span>
      <span className="font-semibold text-slate-800 text-xs sm:text-sm text-right min-w-0 truncate pl-2">{value}</span>
    </div>
  );
}
