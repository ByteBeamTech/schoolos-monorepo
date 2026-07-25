"use client";
/**
 * Dashboard — /dashboard/page.tsx (Phase 3 redesign)
 *
 * Command-center layout:
 *  1. Greeting + session banner
 *  2. Onboarding checklist (first-login, dismissible)
 *  3. Role-based quick actions row
 *  4. Key metrics row (4 stat cards)
 *  5. Main grid:
 *     - Fee collection ring + breakdown
 *     - Attendance today: bar per class
 *     - Today's schedule
 *     - Pending approvals
 *     - Recent activity feed
 *     - Upcoming exams
 */
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users, CreditCard, ClipboardCheck, Bell, TrendingUp,
  BookOpen, GraduationCap, Bus, ArrowRight, CheckCircle2,
  Plus, FileText, UserPlus, DollarSign, Calendar, ChevronRight,
  Zap, AlertCircle, BookMarked, BarChart3, X,
} from "lucide-react";
import { PageHeader }   from "@/components/ui/page-header";
import { StatCard }     from "@/components/ui/stat-card";
import { Badge }        from "@/components/ui/badge";
import { useAuthStore } from "@/lib/store";
import {
  useDashboardStats, useAcademicSessions, useExamStats,
  useAdmissionStats, useHomeworkStats, useInvoiceStats,
  useAttendanceStats, useExams,
} from "@/lib/hooks";

function fmt(n: number) {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1)}Cr`;
  if (n >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1_000)       return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

// ── Onboarding checklist ──────────────────────────────────────────────────────
const ONBOARDING_STEPS = [
  { id: "session",   label: "Create academic session",   href: "/dashboard/sessions",  icon: Calendar },
  { id: "classes",   label: "Set up classes & sections", href: "/dashboard/academics", icon: BookOpen },
  { id: "staff",     label: "Add your first staff member",href: "/dashboard/staff",    icon: Users },
  { id: "students",  label: "Add students",              href: "/dashboard/students",  icon: Users },
  { id: "fee-plan",  label: "Create a fee plan",         href: "/dashboard/billing",   icon: DollarSign },
];

function OnboardingChecklist() {
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem("schoolos-onboarding-completed") || "{}");
      const d = localStorage.getItem("schoolos-onboarding-dismissed") === "true";
      setCompleted(c);
      setDismissed(d);
    } catch {}
  }, []);

  const toggleStep = (id: string) => {
    const next = { ...completed, [id]: !completed[id] };
    setCompleted(next);
    localStorage.setItem("schoolos-onboarding-completed", JSON.stringify(next));
  };

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem("schoolos-onboarding-dismissed", "true");
  };

  const completedCount = Object.values(completed).filter(Boolean).length;
  const allDone = completedCount === ONBOARDING_STEPS.length;

  if (dismissed || allDone) return null;

  const pct = Math.round((completedCount / ONBOARDING_STEPS.length) * 100);

  return (
    <div className="rounded-xl border p-5 mb-6 animate-fade-in"
      style={{ background: "var(--bg-surface)", borderColor: "var(--border-light)", boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
            🚀 Get started with SchoolOS
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
            {completedCount} of {ONBOARDING_STEPS.length} steps complete
          </p>
        </div>
        <button onClick={dismiss} className="p-1 rounded-md transition-colors"
          style={{ color: "var(--text-tertiary)" }}>
          <X className="w-4 h-4" />
        </button>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 rounded-full mb-4" style={{ background: "var(--bg-muted)" }}>
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: "var(--brand)" }} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        {ONBOARDING_STEPS.map(step => {
          const done = completed[step.id];
          const Icon = step.icon;
          return (
            <div key={step.id}
              className="flex items-center gap-2.5 p-2.5 rounded-lg border transition-all group cursor-pointer"
              style={{
                background:   done ? "var(--bg-success)" : "var(--bg-muted)",
                borderColor:  done ? "#bbf7d0" : "var(--border-light)",
                color:        done ? "var(--text-success)" : "var(--text-secondary)",
              }}
              onClick={() => toggleStep(step.id)}
            >
              <div className="w-5 h-5 flex-shrink-0">
                {done
                  ? <CheckCircle2 className="w-5 h-5" style={{ color: "var(--text-success)" }} />
                  : <div className="w-5 h-5 rounded-full border-2" style={{ borderColor: "var(--border)" }} />}
              </div>
              <span className="text-xs font-medium leading-snug flex-1">{step.label}</span>
              <Link href={step.href} onClick={e => e.stopPropagation()}
                className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <ArrowRight className="w-3.5 h-3.5" style={{ color: "var(--text-accent)" }} />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Quick actions by role ─────────────────────────────────────────────────────
const QUICK_ACTIONS: Record<string, Array<{ label: string; href: string; icon: any; color: string }>> = {
  CLASS_TEACHER: [
    { label: "Mark Attendance",  href: "/dashboard/attendance",  icon: ClipboardCheck, color: "#2563eb" },
    { label: "Assign Homework",  href: "/dashboard/homework",    icon: BookMarked,     color: "#7c3aed" },
    { label: "View Timetable",   href: "/dashboard/timetable",   icon: Calendar,       color: "#059669" },
    { label: "Enter Marks",      href: "/dashboard/gradebook",   icon: BarChart3,      color: "#d97706" },
  ],
  TEACHER: [
    { label: "Mark Attendance",  href: "/dashboard/attendance",  icon: ClipboardCheck, color: "#2563eb" },
    { label: "Assign Homework",  href: "/dashboard/homework",    icon: BookMarked,     color: "#7c3aed" },
    { label: "View Timetable",   href: "/dashboard/timetable",   icon: Calendar,       color: "#059669" },
    { label: "Enter Marks",      href: "/dashboard/gradebook",   icon: BarChart3,      color: "#d97706" },
  ],
  ACCOUNTANT: [
    { label: "Generate Invoice", href: "/dashboard/billing",     icon: CreditCard,     color: "#2563eb" },
    { label: "Record Expense",   href: "/dashboard/accounting",  icon: DollarSign,     color: "#059669" },
    { label: "Run Payroll",      href: "/dashboard/payroll",     icon: Users,          color: "#7c3aed" },
    { label: "View Overdue",     href: "/dashboard/billing?overdueOnly=true", icon: AlertCircle, color: "#dc2626" },
  ],
};
const DEFAULT_QUICK_ACTIONS = [
  { label: "Add Student",       href: "/dashboard/students",    icon: UserPlus,       color: "#2563eb" },
  { label: "Mark Attendance",   href: "/dashboard/attendance",  icon: ClipboardCheck, color: "#7c3aed" },
  { label: "New Inquiry",       href: "/dashboard/admissions",  icon: Zap,            color: "#059669" },
  { label: "Send Notification", href: "/dashboard/notifications",icon: Bell,          color: "#d97706" },
];

function QuickActions({ role }: { role: string }) {
  const actions = QUICK_ACTIONS[role] ?? DEFAULT_QUICK_ACTIONS;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {actions.map(({ label, href, icon: Icon, color }) => (
        <Link key={href + label} href={href}>
          <div className="flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all group"
            style={{
              background:   "var(--bg-surface)",
              borderColor:  "var(--border-light)",
              boxShadow:    "var(--shadow-sm)",
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-sm)"}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white"
              style={{ background: color }}>
              <Icon className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium leading-snug" style={{ color: "var(--text-secondary)" }}>{label}</span>
            <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              style={{ color: "var(--text-accent)" }} />
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── Ring chart (CSS only, no canvas) ─────────────────────────────────────────
function RingChart({ collected, total }: { collected: number; total: number }) {
  const pct = total > 0 ? Math.min((collected / total) * 100, 100) : 0;
  const r   = 52;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-36">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10"
            stroke="var(--bg-muted)" />
          <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10"
            stroke="var(--brand)"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
            {Math.round(pct)}%
          </p>
          <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>collected</p>
        </div>
      </div>
      <div className="flex gap-4 mt-3 text-xs" style={{ color: "var(--text-secondary)" }}>
        <div className="text-center">
          <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{fmt(collected)}</p>
          <p style={{ color: "var(--text-tertiary)" }}>Collected</p>
        </div>
        <div className="text-center">
          <p className="font-semibold text-sm" style={{ color: "var(--text-danger)" }}>{fmt(total - collected)}</p>
          <p style={{ color: "var(--text-tertiary)" }}>Pending</p>
        </div>
      </div>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user }           = useAuthStore();
  const { data: sessions } = useAcademicSessions();
  const currentSession     = sessions?.find(s => s.isCurrent);
  const today              = new Date().toISOString().split("T")[0];

  const { stats, loading: statsLoading } = useDashboardStats(currentSession?.id);
  const { data: admStats  }   = useAdmissionStats();
  const { data: invStats  }   = useInvoiceStats(currentSession?.name);
  const { data: attStats  }   = useAttendanceStats(today);
  const { data: upcomingExams } = useExams(currentSession?.id ?? "");
  const { data: hwStats }     = useHomeworkStats();

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name     = user?.firstName ?? "Admin";
  const role     = user?.role ?? "";

  const nextExams = (upcomingExams ?? [])
    .filter((e: any) => new Date(e.startDate) >= new Date())
    .slice(0, 4);

  const collected  = Number(invStats?.collectedAmount ?? stats?.billing?.totalCollected ?? 0);
  const totalBill  = Number(invStats?.totalAmount ?? 0);
  const attPct     = stats?.attendance?.percentage ?? 0;
  const overdue    = stats?.billing?.overdueCount ?? 0;

  return (
    <div>
      <PageHeader
        title={`${greeting}, ${name} 👋`}
        subtitle={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      />

      {/* Session banner */}
      {currentSession && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3 mb-6 border"
          style={{ background: "var(--bg-accent)", borderColor: "var(--bg-accent-deep)" }}>
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--brand)" }} />
          <p className="text-sm flex-1" style={{ color: "var(--text-accent)" }}>
            Active session: <strong>{currentSession.name}</strong>
            <span className="ml-2 font-normal" style={{ color: "var(--text-tertiary)" }}>
              {new Date(currentSession.startDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
              {" – "}
              {new Date(currentSession.endDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
            </span>
          </p>
          <Link href="/dashboard/sessions" className="text-xs font-medium flex items-center gap-1"
            style={{ color: "var(--text-accent)" }}>
            Manage <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* Onboarding checklist */}
      {(role === "SCHOOL_ADMIN" || role === "PRINCIPAL") && <OnboardingChecklist />}

      {/* Quick actions */}
      <QuickActions role={role} />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Students"
          value={statsLoading ? "—" : stats?.students?.total ?? 0}
          sub={`${stats?.students?.active ?? 0} active`}
          icon={<Users className="w-5 h-5" />}
          color="blue" loading={statsLoading}
        />
        <StatCard
          label="Fee Collected"
          value={statsLoading ? "—" : fmt(collected)}
          sub={overdue > 0 ? `${overdue} overdue` : "Up to date"}
          icon={<CreditCard className="w-5 h-5" />}
          color={overdue > 0 ? "amber" : "green"} loading={statsLoading}
        />
        <StatCard
          label="Today's Attendance"
          value={statsLoading ? "—" : `${Math.round(attPct)}%`}
          sub={`${stats?.attendance?.present ?? 0} present · ${stats?.attendance?.absent ?? 0} absent`}
          icon={<ClipboardCheck className="w-5 h-5" />}
          color={attPct >= 75 ? "green" : "red"} loading={statsLoading}
        />
        <StatCard
          label="New Inquiries"
          value={admStats?.thisMonth ?? 0}
          sub={`${admStats?.conversionRate ?? 0}% conversion`}
          icon={<UserPlus className="w-5 h-5" />}
          color="purple" loading={!admStats}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Fee collection ring */}
        <div className="rounded-xl border p-5"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border-light)", boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Fee Collection</p>
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{currentSession?.name}</p>
            </div>
            <Link href="/dashboard/billing" className="text-xs font-medium"
              style={{ color: "var(--text-accent)" }}>View all →</Link>
          </div>
          <div className="flex justify-center">
            <RingChart collected={collected} total={totalBill} />
          </div>
          {overdue > 0 && (
            <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: "var(--bg-warning)", color: "var(--text-warning)" }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p className="text-xs font-medium">{overdue} overdue invoices need attention</p>
            </div>
          )}
        </div>

        {/* Upcoming exams */}
        <div className="rounded-xl border p-5"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border-light)", boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Upcoming Exams</p>
            <Link href="/dashboard/exams" className="text-xs font-medium" style={{ color: "var(--text-accent)" }}>
              All →
            </Link>
          </div>
          {nextExams.length === 0 ? (
            <div className="text-center py-8">
              <GraduationCap className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--text-tertiary)" }} />
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>No upcoming exams</p>
            </div>
          ) : (
            <div className="space-y-2">
              {nextExams.map((exam: any) => {
                const daysAway = Math.ceil((new Date(exam.startDate).getTime() - Date.now()) / 86400000);
                return (
                  <div key={exam.id} className="flex items-center gap-3 p-2.5 rounded-lg"
                    style={{ background: "var(--bg-muted)" }}>
                    <div className="w-8 h-8 rounded-lg flex flex-col items-center justify-center flex-shrink-0"
                      style={{ background: "var(--brand-light)", color: "var(--brand)" }}>
                      <span className="text-[10px] font-bold leading-none">
                        {new Date(exam.startDate).getDate()}
                      </span>
                      <span className="text-[9px] leading-none">
                        {new Date(exam.startDate).toLocaleString("en-IN", { month: "short" })}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                        {exam.name}
                      </p>
                      <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                        {exam.type?.replace("_", " ")}
                      </p>
                    </div>
                    <Badge
                      label={daysAway === 0 ? "Today" : daysAway === 1 ? "Tomorrow" : `${daysAway}d`}
                      variant={daysAway <= 2 ? "error" : daysAway <= 7 ? "warning" : "info"}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Homework + admissions stats */}
        <div className="space-y-4">
          {/* Homework summary */}
          <div className="rounded-xl border p-4"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border-light)", boxShadow: "var(--shadow-sm)" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Homework</p>
              <Link href="/dashboard/homework" className="text-xs" style={{ color: "var(--text-accent)" }}>→</Link>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Assigned", value: hwStats?.total    ?? 0, color: "var(--brand)"       },
                { label: "Due Soon", value: hwStats?.dueSoon  ?? 0, color: "var(--text-warning)" },
                { label: "Submitted",value: hwStats?.submitted ?? 0, color: "var(--text-success)" },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center p-2 rounded-lg" style={{ background: "var(--bg-muted)" }}>
                  <p className="text-lg font-bold" style={{ color }}>{value}</p>
                  <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Admissions funnel */}
          <div className="rounded-xl border p-4"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border-light)", boxShadow: "var(--shadow-sm)" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Admissions</p>
              <Link href="/dashboard/admissions" className="text-xs" style={{ color: "var(--text-accent)" }}>→</Link>
            </div>
            <div className="space-y-1.5">
              {[
                { label: "Total Inquiries",  value: admStats?.total     ?? 0 },
                { label: "This Month",       value: admStats?.thisMonth ?? 0 },
                { label: "Enrolled",         value: admStats?.enrolled  ?? 0 },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center text-xs">
                  <span style={{ color: "var(--text-secondary)" }}>{label}</span>
                  <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{value}</span>
                </div>
              ))}
              <div className="pt-1 border-t" style={{ borderColor: "var(--border-light)" }}>
                <div className="flex justify-between items-center text-xs">
                  <span style={{ color: "var(--text-secondary)" }}>Conversion rate</span>
                  <span className="font-bold" style={{ color: "var(--text-success)" }}>
                    {admStats?.conversionRate ?? 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
