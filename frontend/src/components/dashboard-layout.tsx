"use client";
import Link          from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { cn }        from "@/lib/utils";
import {
  LayoutDashboard, Users, CreditCard, ClipboardCheck,
  Bell, BookOpen, UserCheck, LogOut, School, ChevronRight,
  Settings, Calendar, GraduationCap, CalendarDays, FileText,
  Tag, Bus, Library, MessageSquare, Receipt, UserPlus,
  BookMarked, Package, Award, Layers, BadgeDollarSign,
  Briefcase, Building2, Shield, HeadphonesIcon, Puzzle, Building,
} from "lucide-react";

// ── Nav item type ─────────────────────────────────────────────────────────────
interface NavItem {
  href:  string;
  label: string;
  icon:  React.ComponentType<{ className?: string }>;
  roles: string[]; // empty = all roles
}
interface NavGroup {
  label: string;
  items: NavItem[];
}

// ── Role constants (match enums.prisma exactly) ────────────────────────────────
const ALL_ROLES: string[] = []; // sentinel: visible to everyone
const ADMIN_ROLES  = ["SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"];
const FINANCE_ROLES = [...ADMIN_ROLES, "ACCOUNTANT"];
const ACADEMIC_ROLES = [...ADMIN_ROLES, "TEACHER", "CLASS_TEACHER"];

// ── Full nav definition — roles array controls visibility ──────────────────────
const NAV: NavGroup[] = [
  {
    label: "Main",
    items: [
      { href: "/dashboard",             label: "Overview",      icon: LayoutDashboard, roles: ALL_ROLES },
      { href: "/dashboard/students",    label: "Students",      icon: Users,           roles: [...ADMIN_ROLES, "TEACHER", "CLASS_TEACHER", "NURSE", "RECEPTIONIST"] },
      { href: "/dashboard/staff",       label: "Staff",         icon: UserCheck,       roles: ADMIN_ROLES },
      { href: "/dashboard/admissions",  label: "Admissions",    icon: UserPlus,        roles: ADMIN_ROLES },
      { href: "/dashboard/academics",   label: "Academics",     icon: BookOpen,        roles: [...ADMIN_ROLES, "TEACHER", "CLASS_TEACHER"] },
      { href: "/dashboard/sessions",    label: "Sessions",      icon: CalendarDays,    roles: ADMIN_ROLES },
      { href: "/dashboard/branches",    label: "Branches",      icon: Building2,       roles: ADMIN_ROLES },
      { href: "/dashboard/hr",          label: "HR Management", icon: Briefcase,       roles: [...ADMIN_ROLES, "HR_MANAGER"] },
      { href: "/dashboard/reception",   label: "Reception",     icon: Building2,       roles: [...ADMIN_ROLES, "RECEPTIONIST"] },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/dashboard/billing",           label: "Billing",    icon: CreditCard,      roles: FINANCE_ROLES },
      { href: "/dashboard/billing/discounts", label: "Discounts",  icon: Tag,             roles: FINANCE_ROLES },
      { href: "/dashboard/accounting",        label: "Accounting", icon: Receipt,         roles: FINANCE_ROLES },
      { href: "/dashboard/payroll",           label: "Payroll",    icon: BadgeDollarSign, roles: [...FINANCE_ROLES, "HR_MANAGER"] },
    ],
  },
  {
    label: "Academic",
    items: [
      { href: "/dashboard/attendance",   label: "Attendance",    icon: ClipboardCheck, roles: ACADEMIC_ROLES },
      { href: "/dashboard/timetable",    label: "Timetable",     icon: Calendar,       roles: [...ACADEMIC_ROLES, "STUDENT", "PARENT"] },
      { href: "/dashboard/exams",        label: "Examinations",  icon: GraduationCap,  roles: ACADEMIC_ROLES },
      { href: "/dashboard/report-cards", label: "Report Cards",  icon: FileText,       roles: [...ACADEMIC_ROLES, "PARENT"] },
      { href: "/dashboard/homework",     label: "Homework",      icon: BookMarked,     roles: ACADEMIC_ROLES },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/dashboard/library",       label: "Library",       icon: Library,       roles: [...ADMIN_ROLES, "LIBRARIAN"] },
      { href: "/dashboard/transport",     label: "Transport",     icon: Bus,           roles: [...ADMIN_ROLES, "TRANSPORT_MANAGER"] },
      { href: "/dashboard/communication", label: "Communication", icon: MessageSquare, roles: ALL_ROLES },
      { href: "/dashboard/notifications", label: "Notifications", icon: Bell,          roles: ADMIN_ROLES },
      { href: "/dashboard/certificates",  label: "Certificates",  icon: Award,         roles: ADMIN_ROLES },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/dashboard/inventory",                  label: "Inventory",     icon: Package,        roles: ADMIN_ROLES },
      { href: "/dashboard/bulk",                       label: "Bulk Ops",      icon: Layers,         roles: ADMIN_ROLES },
      { href: "/dashboard/access-control",             label: "Access Control",icon: Shield,         roles: ADMIN_ROLES },
      { href: "/dashboard/support",                    label: "Support",       icon: HeadphonesIcon, roles: ALL_ROLES },
      { href: "/dashboard/settings/school-management", label: "School Profile",icon: Building,       roles: ADMIN_ROLES },
      { href: "/dashboard/settings/integrations",      label: "Integrations",  icon: Puzzle,         roles: ADMIN_ROLES },
      { href: "/dashboard/settings",                   label: "Settings",      icon: Settings,       roles: ALL_ROLES },
    ],
  },
];

// ── Filter NAV by role ─────────────────────────────────────────────────────────
function filterNavByRole(role: string | undefined): NavGroup[] {
  if (!role) return [];
  return NAV
    .map(group => ({
      ...group,
      items: group.items.filter(
        item => item.roles.length === 0 || item.roles.includes(role)
      ),
    }))
    .filter(group => group.items.length > 0);
}

// ── Role display helpers ───────────────────────────────────────────────────────
const ROLE_LABELS: Record<string, string> = {
  SCHOOL_ADMIN:      "School Admin",
  PRINCIPAL:         "Principal",
  VICE_PRINCIPAL:    "Vice Principal",
  ACCOUNTANT:        "Accountant",
  TEACHER:           "Teacher",
  CLASS_TEACHER:     "Class Teacher",
  LIBRARIAN:         "Librarian",
  NURSE:             "Nurse",
  RECEPTIONIST:      "Receptionist",
  HR_MANAGER:        "HR Manager",
  TRANSPORT_MANAGER: "Transport Manager",
  PARENT:            "Parent",
  STUDENT:           "Student",
  STAFF:             "Staff",
};

// ── Component ──────────────────────────────────────────────────────────────────
export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname             = usePathname();
  const router               = useRouter();
  const { user, logout }     = useAuthStore();

  const handleLogout = () => { logout(); router.push("/login"); };

  const initials = user
    ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase()
    : "?";

  const filteredNav = filterNavByRole(user?.role);
  const roleLabel   = (user?.role && ROLE_LABELS[user.role]) ?? user?.role ?? "Dashboard";

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="w-60 flex-shrink-0 bg-white border-r border-slate-100 flex flex-col shadow-sm">

        {/* Logo */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <School className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 leading-none">SchoolOS</p>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[120px]">
              {user?.tenantId ?? "Dashboard"}
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-5 scrollbar-thin">
          {filteredNav.map(group => (
            <div key={group.label}>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-2 mb-1.5">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active =
                    pathname === href ||
                    (href !== "/dashboard" && pathname.startsWith(href));
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors",
                        active
                          ? "bg-blue-50 text-blue-700"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      )}
                    >
                      <Icon className={cn("w-4 h-4 flex-shrink-0", active ? "text-blue-600" : "text-slate-400")} />
                      <span className="flex-1 truncate">{label}</span>
                      {active && <ChevronRight className="w-3 h-3 text-blue-400" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-3 py-3 border-t border-slate-100">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors">
            <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-[10px] text-slate-400 truncate">{roleLabel}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1 text-slate-400 hover:text-red-500 transition-colors"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
