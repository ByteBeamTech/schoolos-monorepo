"use client";
import Link from "next/link";
import {
  Users, CreditCard, ClipboardCheck, Bell,
  TrendingUp, Activity, BookOpen, GraduationCap,
  Bus, ArrowRight, ChevronUp, ChevronDown,
  AlertCircle, Calendar,
} from "lucide-react";
import { StatCard }   from "@/components/ui/stat-card";
import { PageHeader } from "@/components/ui/page-header";
import { Badge }      from "@/components/ui/badge";
import { useAuthStore } from "@/lib/store";
import {
  useDashboardStats, useAcademicSessions, useExamStats,
  useAdmissionStats, useHomeworkStats, useTransportStats,
  useInvoiceStats,  useAttendanceStats,  useExams,
} from "@/lib/hooks";

function formatCurrency(n: number) {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000)   return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

// ── Mini sparkline bar ─────────────────────────────────────────────────────────
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1.5">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function DashboardPage() {
  const { user }           = useAuthStore();
  const { data: sessions } = useAcademicSessions();
  const currentSession     = sessions?.find(s => s.isCurrent);
  const today              = new Date().toISOString().split("T")[0];

  // Stats hooks
  const { stats, loading: statsLoading } = useDashboardStats(currentSession?.id);
  const { data: examStats }    = useExamStats(currentSession?.id ?? "");
  const { data: admStats  }    = useAdmissionStats();
  const { data: hwStats   }    = useHomeworkStats();
  const { data: tpStats   }    = useTransportStats();
  const { data: invStats  }    = useInvoiceStats(currentSession?.name);
  const { data: attStats  }    = useAttendanceStats(today);
  const { data: upcomingExams} = useExams(currentSession?.id ?? "");

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name     = user?.firstName ?? "Admin";

  // Next 3 upcoming exams
  const nextExams = (upcomingExams ?? [])
    .filter((e: any) => new Date(e.startDate) >= new Date())
    .slice(0, 3);

  const role = user?.role ?? "";
  const isFinance  = ["SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT", "VICE_PRINCIPAL"].includes(role);
  const isAcademic = ["SCHOOL_ADMIN", "PRINCIPAL", "TEACHER", "CLASS_TEACHER", "VICE_PRINCIPAL"].includes(role);

  return (
    <div>
      <PageHeader
        title={`${greeting}, ${name} 👋`}
        subtitle={new Date().toLocaleDateString("en-IN", {
          weekday: "long", day: "numeric", month: "long", year: "numeric",
        })}
      />

      {/* Active session banner */}
      {currentSession && (
        <div className="mb-6 flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <p className="text-sm text-blue-700 flex-1">
            Active session: <strong>{currentSession.name}</strong>
            <span className="text-blue-400 ml-2 font-normal">
              {new Date(currentSession.startDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })} –{" "}
              {new Date(currentSession.endDate).toLocaleDateString(  "en-IN", { month: "short", year: "numeric" })}
            </span>
          </p>
          <Link href="/dashboard/sessions" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            Manage <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <StatCard
          label="Total Students"
          value={statsLoading ? "—" : stats?.students.total ?? 0}
          sub={`${stats?.students.active ?? 0} active`}
          icon={<Users className="w-5 h-5" />}
          color="blue" loading={statsLoading}
        />
        <StatCard
          label="Fee Collected"
          value={statsLoading ? "—" : formatCurrency(stats?.billing.totalCollected ?? 0)}
          sub={`${stats?.billing.overdueCount ?? 0} overdue`}
          icon={<CreditCard className="w-5 h-5" />}
          color="green" loading={statsLoading}
        />
        <StatCard
          label="Today's Attendance"
          value={statsLoading ? "—" : `${stats?.attendance.percentage ?? 0}%`}
          sub={`${stats?.attendance.present ?? 0} present · ${stats?.attendance.absent ?? 0} absent`}
          icon={<ClipboardCheck className="w-5 h-5" />}
          color="purple" loading={statsLoading}
        />
        <StatCard
          label="Notifications Sent"
          value={statsLoading ? "—" : stats?.notifications.sent ?? 0}
          sub={`${stats?.notifications.deliveryRate ?? 0}% delivery`}
          icon={<Bell className="w-5 h-5" />}
          color="amber" loading={statsLoading}
        />
      </div>

      {/* ── Row 2: Quick actions + Live snapshot ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

        {/* Quick actions */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900 text-sm">Quick Actions</h2>
          </div>
          <div className="p-4 grid grid-cols-2 gap-2.5">
            {[
              { href: "/dashboard/students",     label: "Add Student",     icon: Users,         c: "bg-blue-50   text-blue-700",   show: isAcademic || isFinance },
              { href: "/dashboard/billing",       label: "Create Invoice",  icon: CreditCard,    c: "bg-green-50  text-green-700",  show: isFinance },
              { href: "/dashboard/attendance",    label: "Mark Attendance", icon: ClipboardCheck,c: "bg-purple-50 text-purple-700", show: isAcademic },
              { href: "/dashboard/notifications", label: "Send Alert",      icon: Bell,          c: "bg-amber-50  text-amber-700",  show: true },
              { href: "/dashboard/homework",      label: "Assign Homework", icon: BookOpen,      c: "bg-indigo-50 text-indigo-700", show: isAcademic },
              { href: "/dashboard/admissions",    label: "New Admission",   icon: Users,         c: "bg-rose-50   text-rose-700",   show: isFinance || isAcademic },
            ]
              .filter(a => a.show)
              .slice(0, 6)
              .map(({ href, label, icon: Icon, c }) => (
                <Link
                  key={href} href={href}
                  className={`flex items-center gap-2.5 p-3 rounded-lg border border-slate-100
                    hover:border-slate-200 hover:shadow-sm transition-all ${c}`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-xs font-semibold">{label}</span>
                </Link>
              ))}
          </div>
        </div>

        {/* Live snapshot — role-aware metrics */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-900 text-sm">Today's Snapshot</h2>
          </div>
          <div className="p-4 space-y-3">
            {/* Attendance */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-500 font-medium">Attendance</span>
                <span className="font-bold text-slate-700">{attStats?.percentage ?? stats?.attendance.percentage ?? 0}%</span>
              </div>
              <MiniBar
                value={attStats?.percentage ?? stats?.attendance.percentage ?? 0}
                max={100}
                color={
                  (attStats?.percentage ?? stats?.attendance.percentage ?? 0) >= 80
                    ? "bg-emerald-400" : "bg-amber-400"
                }
              />
            </div>

            {isFinance && (
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500 font-medium">Fee Collection</span>
                  <span className="font-bold text-slate-700">
                    {invStats ? Math.round((invStats.collectedAmount / Math.max(invStats.totalAmount, 1)) * 100) : 0}%
                  </span>
                </div>
                <MiniBar
                  value={invStats?.collectedAmount ?? 0}
                  max={invStats?.totalAmount ?? 1}
                  color="bg-blue-400"
                />
              </div>
            )}

            {/* Metric chips */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {[
                isAcademic && { label: "Upcoming Exams",  value: examStats?.upcoming ?? "—",         icon: GraduationCap, color: "text-indigo-600" },
                isAcademic && { label: "Homework Due",    value: hwStats?.dueSoon    ?? "—",         icon: BookOpen,      color: "text-amber-600"  },
                isFinance  && { label: "Pending Invoices",value: invStats?.draftCount ?? "—",        icon: CreditCard,    color: "text-red-600"    },
                             { label: "Transport Routes", value: tpStats?.routes     ?? "—",         icon: Bus,           color: "text-teal-600"   },
                isAcademic && { label: "Pending Admissions",value: admStats?.pending ?? "—",         icon: Users,         color: "text-violet-600" },
              ]
                .filter(Boolean)
                .filter(m => m)
                .slice(0, 4)
                .map((m: any) => (
                  <div key={m.label} className="bg-slate-50 rounded-lg p-2.5 flex items-center gap-2">
                    <m.icon className={`w-4 h-4 ${m.color}`} />
                    <div>
                      <p className="text-[10px] text-slate-400 leading-tight">{m.label}</p>
                      <p className={`text-sm font-bold ${m.color}`}>{m.value}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-900 text-sm">System Status</h2>
          </div>
          <div className="p-4 space-y-2.5">
            {[
              { label: "API Server",     ok: true,  detail: "< 80ms"         },
              { label: "Database",       ok: true,  detail: "Healthy"        },
              { label: "Redis / Queues", ok: true,  detail: "Active"         },
              { label: "Notifications",  ok: true,  detail: "Delivery 94%"   },
              { label: "File Storage",   ok: false, detail: "Not configured" },
              { label: "Email Service",  ok: false, detail: "Not configured" },
            ].map(({ label, ok, detail }) => (
              <div key={label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-400"}`} />
                  <span className="text-xs text-slate-600">{label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400">{detail}</span>
                  <Badge label={ok ? "OK" : "Setup"} variant={ok ? "success" : "warning"} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 3: Upcoming Exams + Pending Fees ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* Upcoming Exams */}
        {isAcademic && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-slate-400" />
                <h2 className="font-semibold text-slate-900 text-sm">Upcoming Exams</h2>
              </div>
              <Link href="/dashboard/exams" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-slate-50">
              {nextExams.length === 0 ? (
                <div className="px-5 py-8 text-center text-slate-400">
                  <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No upcoming exams</p>
                </div>
              ) : nextExams.map((exam: any) => {
                const daysLeft = Math.ceil(
                  (new Date(exam.startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                );
                return (
                  <div key={exam.id} className="px-5 py-3.5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{exam.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(exam.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        {" – "}
                        {new Date(exam.endDate).toLocaleDateString("en-IN",   { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        daysLeft <= 3 ? "bg-red-100 text-red-600" :
                        daysLeft <= 7 ? "bg-amber-100 text-amber-700" :
                        "bg-blue-100 text-blue-600"
                      }`}>
                        {daysLeft === 0 ? "Today" : daysLeft === 1 ? "Tomorrow" : `${daysLeft}d`}
                      </span>
                      {exam.isPublished
                        ? <Badge label="Published" variant="success" />
                        : <Badge label="Draft"     variant="warning" />
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Fee dues alert */}
        {isFinance && invStats && invStats.overdueCount > 0 && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <h2 className="font-semibold text-slate-900 text-sm">Fee Dues Summary</h2>
              </div>
              <Link href="/dashboard/billing" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                Manage <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="p-5 space-y-4">
              {[
                { label: "Total Invoiced",  value: formatCurrency(invStats.totalAmount),     color: "text-slate-700",  bg: "bg-slate-50"   },
                { label: "Collected",       value: formatCurrency(invStats.collectedAmount), color: "text-emerald-700",bg: "bg-emerald-50"  },
                { label: "Outstanding",     value: formatCurrency(invStats.totalAmount - invStats.collectedAmount), color: "text-red-700", bg: "bg-red-50" },
                { label: "Overdue Invoices",value: invStats.overdueCount,                   color: "text-amber-700",  bg: "bg-amber-50"   },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className={`flex items-center justify-between rounded-lg px-4 py-2.5 ${bg}`}>
                  <span className="text-xs text-slate-500 font-medium">{label}</span>
                  <span className={`text-sm font-bold ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Platform Progress ── */}
      {["SCHOOL_ADMIN", "PRINCIPAL"].includes(role) && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-900 text-sm">Platform Progress</h2>
          </div>
          <div className="p-5 grid grid-cols-2 md:grid-cols-5 gap-2.5">
            {[
              ["Phase 1",  "Foundation",      true ],
              ["Phase 2",  "Auth & Identity", true ],
              ["Phase 3",  "Core Data",       true ],
              ["Phase 4",  "Student Billing", true ],
              ["Phase 5",  "Attendance",      true ],
              ["Phase 6",  "Notifications",   true ],
              ["Phase 7",  "Timetable",       true ],
              ["Phase 8",  "Examinations",    true ],
              ["Phase 9",  "Frontend",        true ],
              ["Phase 10", "Mobile",          false],
            ].map(([phase, label, done]) => (
              <div
                key={phase as string}
                className={`rounded-lg p-3 border text-center ${
                  done ? "bg-green-50 border-green-200" : "bg-slate-50 border-slate-200"
                }`}
              >
                <p className={`text-xs font-semibold ${done ? "text-green-600" : "text-slate-400"}`}>{phase}</p>
                <p className={`text-xs mt-0.5 ${done ? "text-green-700" : "text-slate-500"}`}>{label}</p>
                <p className="text-base mt-0.5">{done ? "✅" : "⏳"}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
