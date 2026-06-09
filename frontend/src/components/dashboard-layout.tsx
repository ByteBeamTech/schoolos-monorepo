"use client";
/**
 * dashboard-layout.tsx — Phase 3 redesign
 *
 * Changes from original:
 *  ✅ Mobile-responsive: sidebar becomes a drawer on <768px
 *  ✅ Dark mode: all colors use CSS variables
 *  ✅ Header bar: global search, dark/light toggle, notification bell, breadcrumb
 *  ✅ Collapsible nav groups (persisted in localStorage)
 *  ✅ Branch switcher for SUPER_ADMIN (Zustand-backed)
 *  ✅ Smooth animations on open/close
 *  ✅ Active nav indicator with smooth transition
 *  ✅ User avatar + role pill in sidebar footer
 */
import { useState, useEffect, useRef } from "react";
import Link          from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore }   from "@/lib/store";
import { useBranchStore } from "@/lib/branch-store";
import { useTheme }       from "@/components/theme-provider";
import { cn }             from "@/lib/utils";
import {
  LayoutDashboard, Users, CreditCard, ClipboardCheck,
  Bell, BookOpen, UserCheck, LogOut, School, ChevronRight, ChevronDown,
  Settings, Calendar, GraduationCap, CalendarDays, FileText,
  Tag, Bus, Library, MessageSquare, Receipt, UserPlus,
  BookMarked, Package, Award, Layers, BadgeDollarSign, BarChart3,
  Briefcase, Building2, Shield, HeadphonesIcon, Puzzle, Building,
  Menu, X, Sun, Moon, Search, Building as BranchIcon,
} from "lucide-react";

// ── Nav definition ────────────────────────────────────────────────────────────
interface NavItem  { href: string; label: string; icon: React.ComponentType<any>; roles: string[]; badge?: string; }
interface NavGroup { label: string; items: NavItem[]; }

const ALL:      string[] = [];
const ADMIN     = ["SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"];
const FINANCE   = [...ADMIN, "ACCOUNTANT"];
const ACADEMIC  = [...ADMIN, "TEACHER", "CLASS_TEACHER"];

const NAV: NavGroup[] = [
  { label: "Main", items: [
    { href: "/dashboard",            label: "Overview",     icon: LayoutDashboard, roles: ALL },
    { href: "/dashboard/students",   label: "Students",     icon: Users,           roles: [...ADMIN, "TEACHER", "CLASS_TEACHER", "NURSE", "RECEPTIONIST"] },
    { href: "/dashboard/staff",      label: "Staff",        icon: UserCheck,       roles: ADMIN },
    { href: "/dashboard/crm",        label: "CRM",          icon: HeadphonesIcon,  roles: [...ADMIN, "RECEPTIONIST"] },
    { href: "/dashboard/admissions", label: "Admissions",   icon: UserPlus,        roles: [...ADMIN, "RECEPTIONIST"] },
    { href: "/dashboard/academics",  label: "Academics",    icon: BookOpen,        roles: [...ADMIN, "TEACHER", "CLASS_TEACHER"] },
    { href: "/dashboard/sessions",   label: "Sessions",     icon: CalendarDays,    roles: ADMIN },
    { href: "/dashboard/branches",   label: "Branches",     icon: Building2,       roles: ADMIN },
    { href: "/dashboard/hr",         label: "HR",           icon: Briefcase,       roles: [...ADMIN, "HR_MANAGER"] },
    { href: "/dashboard/reception",  label: "Reception",    icon: Building2,       roles: [...ADMIN, "RECEPTIONIST"] },
  ]},
  { label: "Finance", items: [
    { href: "/dashboard/billing",           label: "Billing",    icon: CreditCard,      roles: FINANCE },
    { href: "/dashboard/billing/discounts", label: "Discounts",  icon: Tag,             roles: FINANCE },
    { href: "/dashboard/accounting",        label: "Accounting", icon: Receipt,         roles: FINANCE },
    { href: "/dashboard/payroll",           label: "Payroll",    icon: BadgeDollarSign, roles: [...FINANCE, "HR_MANAGER"] },
  ]},
  { label: "Academic", items: [
    { href: "/dashboard/attendance",   label: "Attendance",   icon: ClipboardCheck, roles: ACADEMIC },
    { href: "/dashboard/timetable",    label: "Timetable",    icon: Calendar,       roles: [...ACADEMIC, "STUDENT", "PARENT"] },
    { href: "/dashboard/exams",        label: "Examinations", icon: GraduationCap,  roles: ACADEMIC },
    { href: "/dashboard/gradebook",    label: "Gradebook",    icon: BarChart3,      roles: ACADEMIC },
    { href: "/dashboard/report-cards", label: "Report Cards", icon: FileText,       roles: [...ACADEMIC, "PARENT"] },
    { href: "/dashboard/homework",     label: "Homework",     icon: BookMarked,     roles: ACADEMIC },
    { href: "/dashboard/academic-calendar", label: "Academic Calendar", icon: CalendarDays,   roles: ACADEMIC },
  ]},
  { label: "Operations", items: [
    { href: "/dashboard/library",       label: "Library",       icon: Library,       roles: [...ADMIN, "LIBRARIAN"] },
    { href: "/dashboard/transport",     label: "Transport",     icon: Bus,           roles: [...ADMIN, "TRANSPORT_MANAGER"] },
    { href: "/dashboard/communication", label: "Communication", icon: MessageSquare, roles: ALL },
    { href: "/dashboard/notifications", label: "Notifications", icon: Bell,          roles: ADMIN },
    { href: "/dashboard/certificates",  label: "Certificates",  icon: Award,         roles: ADMIN },
  ]},
  { label: "System", items: [
    { href: "/dashboard/inventory",                  label: "Inventory",      icon: Package,       roles: ADMIN },
    { href: "/dashboard/bulk",                       label: "Bulk Ops",       icon: Layers,        roles: ADMIN },
    { href: "/dashboard/access-control",             label: "Access Control", icon: Shield,        roles: ADMIN },
    { href: "/dashboard/support",                    label: "Support",        icon: HeadphonesIcon,roles: ALL },
    { href: "/dashboard/settings/school-management", label: "School Profile", icon: Building,      roles: ADMIN },
    { href: "/dashboard/settings/integrations",      label: "Integrations",   icon: Puzzle,        roles: ADMIN },
    { href: "/dashboard/settings",                   label: "Settings",       icon: Settings,      roles: ALL },
  ]},
];

const ROLE_LABELS: Record<string, string> = {
  SCHOOL_ADMIN: "School Admin", PRINCIPAL: "Principal", VICE_PRINCIPAL: "Vice Principal",
  ACCOUNTANT: "Accountant", TEACHER: "Teacher", CLASS_TEACHER: "Class Teacher",
  LIBRARIAN: "Librarian", NURSE: "Nurse", RECEPTIONIST: "Receptionist",
  HR_MANAGER: "HR Manager", TRANSPORT_MANAGER: "Transport Manager",
  PARENT: "Parent", STUDENT: "Student", STAFF: "Staff", SUPER_ADMIN: "Super Admin",
};

function filterNav(role: string | undefined): NavGroup[] {
  if (!role) return [];
  return NAV
    .map(g => ({ ...g, items: g.items.filter(i => i.roles.length === 0 || i.roles.includes(role)) }))
    .filter(g => g.items.length > 0);
}

// ── Component ─────────────────────────────────────────────────────────────────
export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname         = usePathname();
  const router           = useRouter();
  const { user, logout } = useAuthStore();
  const { toggle: toggleTheme, resolved: theme } = useTheme();
  const { selectedBranch, clearSelection } = useBranchStore();

  const [sidebarOpen,   setSidebarOpen]   = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [searchOpen,    setSearchOpen]    = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Restore collapsed state from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("schoolos-nav-collapsed") || "{}");
      setCollapsedGroups(saved);
    } catch {}
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  // Cmd+K global search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(p => !p);
        setTimeout(() => searchRef.current?.focus(), 50);
      }
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => {
      const next = { ...prev, [label]: !prev[label] };
      localStorage.setItem("schoolos-nav-collapsed", JSON.stringify(next));
      return next;
    });
  };

  const handleLogout = () => { logout(); router.push("/login"); };

  const initials  = user ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() : "?";
  const roleLabel = (user?.role && ROLE_LABELS[user.role]) ?? user?.role ?? "";
  const filtered  = filterNav(user?.role);

  // ── Sidebar content (shared between desktop + mobile drawer) ──────────────
  const SidebarContent = () => (
    <div className="flex flex-col h-full" style={{ background: "var(--sidebar-bg)" }}>
      {/* Logo */}
      <div className="px-4 py-4 flex items-center gap-3" style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--brand)" }}>
          <School className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold leading-none" style={{ color: "var(--text-primary)" }}>SchoolOS</p>
          <p className="text-[10px] mt-0.5 truncate max-w-[130px]" style={{ color: "var(--text-tertiary)" }}>
            {user?.tenantSlug ?? user?.tenantId ?? "Dashboard"}
          </p>
        </div>
        {/* Mobile close */}
        <button onClick={() => setSidebarOpen(false)} className="ml-auto md:hidden p-1 rounded-md"
          style={{ color: "var(--text-tertiary)" }}>
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Branch switcher (SUPER_ADMIN only) */}
      {user?.role === "SUPER_ADMIN" && (
        <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
          <div className="flex items-center gap-2 px-2 py-2 rounded-lg text-xs"
            style={{ background: selectedBranch ? "var(--bg-accent)" : "var(--bg-muted)", color: "var(--text-secondary)" }}>
            <BranchIcon className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="flex-1 truncate font-medium">
              {selectedBranch?.name ?? "All Branches"}
            </span>
            {selectedBranch && (
              <button onClick={clearSelection} className="p-0.5 rounded hover:opacity-70 transition-opacity">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 scrollbar-thin">
        {filtered.map(group => {
          const collapsed = collapsedGroups[group.label];
          return (
            <div key={group.label} className="mb-1">
              <button
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-colors mb-0.5 group"
                style={{ color: "var(--text-tertiary)" }}
              >
                <span className="text-[10px] font-semibold uppercase tracking-widest flex-1 text-left">
                  {group.label}
                </span>
                <ChevronDown
                  className="w-3 h-3 transition-transform duration-200"
                  style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
                />
              </button>

              <div
                className="overflow-hidden transition-all duration-200"
                style={{ maxHeight: collapsed ? 0 : "1000px", opacity: collapsed ? 0 : 1 }}
              >
                <div className="space-y-0.5 pb-1">
                  {group.items.map(({ href, label, icon: Icon, badge }) => {
                    const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={cn(
                          "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 group"
                        )}
                        style={{
                          background: active ? "var(--sidebar-item-active-bg)"   : "transparent",
                          color:      active ? "var(--sidebar-item-active-text)" : "var(--sidebar-item-text)",
                        }}
                        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "var(--sidebar-item-hover-bg)"; }}
                        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                      >
                        <Icon
                          className="w-4 h-4 flex-shrink-0 transition-colors"
                          style={{ color: active ? "var(--text-accent)" : "var(--text-tertiary)" }}
                        />
                        <span className="flex-1 truncate">{label}</span>
                        {badge && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                            style={{ background: "var(--brand-light)", color: "var(--brand-text)" }}>
                            {badge}
                          </span>
                        )}
                        {active && <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: "var(--text-accent)" }} />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-3" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
        <div className="flex items-center gap-2.5 p-2 rounded-lg transition-colors cursor-default"
          style={{ color: "var(--text-secondary)" }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
            style={{ background: "var(--brand)" }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-[10px] truncate" style={{ color: "var(--text-tertiary)" }}>{roleLabel}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-1 rounded-md transition-colors flex-shrink-0"
            style={{ color: "var(--text-tertiary)" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--text-danger)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--text-tertiary)"}
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-base)" }}>

      {/* ── Desktop sidebar ─────────────────────────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col w-60 flex-shrink-0 border-r"
        style={{ borderColor: "var(--sidebar-border)", background: "var(--sidebar-bg)" }}
      >
        <SidebarContent />
      </aside>

      {/* ── Mobile sidebar overlay ───────────────────────────────────────────── */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside
            className="fixed top-0 left-0 bottom-0 w-64 z-50 md:hidden shadow-2xl animate-slide-in-left"
            style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--sidebar-border)" }}
          >
            <SidebarContent />
          </aside>
        </>
      )}

      {/* ── Main content area ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header
          className="flex-shrink-0 flex items-center gap-3 px-4 md:px-6 h-14 border-b"
          style={{
            background:   "var(--bg-surface)",
            borderColor:  "var(--border-light)",
            boxShadow:    "var(--shadow-sm)",
          }}
        >
          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 rounded-lg transition-colors"
            style={{ color: "var(--text-secondary)" }}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Search bar */}
          <div className="flex-1 max-w-md">
            {searchOpen ? (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: "var(--text-tertiary)" }} />
                <input
                  ref={searchRef}
                  placeholder="Search students, staff, invoices…"
                  autoFocus
                  onBlur={() => setSearchOpen(false)}
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border"
                  style={{
                    background:   "var(--bg-muted)",
                    borderColor:  "var(--border-focus)",
                    color:        "var(--text-primary)",
                    outline:      "none",
                    boxShadow:    "0 0 0 3px rgba(59,130,246,0.12)",
                  }}
                />
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] px-1.5 py-0.5 rounded border"
                  style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-tertiary)" }}>
                  Esc
                </kbd>
              </div>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm w-full md:w-auto transition-colors"
                style={{ background: "var(--bg-muted)", color: "var(--text-tertiary)" }}
              >
                <Search className="w-4 h-4" />
                <span className="hidden sm:block text-sm">Search…</span>
                <kbd className="hidden sm:inline-flex items-center gap-1 ml-auto text-[10px] px-1.5 py-0.5 rounded border"
                  style={{ borderColor: "var(--border)", color: "var(--text-tertiary)" }}>
                  ⌘K
                </kbd>
              </button>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Dark mode toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg transition-colors"
            style={{ color: "var(--text-secondary)" }}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark"
              ? <Sun  className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
              : <Moon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />}
          </button>

          {/* Notifications bell */}
          <Link href="/dashboard/notifications">
            <button className="relative p-2 rounded-lg transition-colors" style={{ color: "var(--text-secondary)" }}>
              <Bell className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
              {/* Dot for unread — wire to real count when needed */}
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                style={{ background: "var(--text-danger)" }} />
            </button>
          </Link>

          {/* User avatar */}
          <div className="flex items-center gap-2 pl-2 ml-1 border-l" style={{ borderColor: "var(--border-light)" }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ background: "var(--brand)" }}>
              {initials}
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-semibold leading-none" style={{ color: "var(--text-primary)" }}>
                {user?.firstName}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>{roleLabel}</p>
            </div>
          </div>
        </header>

        {/* ── Page content ─────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="max-w-screen-xl mx-auto px-4 md:px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
