"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import React, { useState } from "react"; // useState जोड़ा गया है
import {
  LayoutDashboard, Users, CreditCard, ClipboardCheck,
  Bell, BookOpen, UserCheck, LogOut, School, ChevronRight,
  Settings, Calendar, GraduationCap, CalendarDays, FileText,
  Tag, Bus, Library, MessageSquare, Receipt, UserPlus,
  BookMarked, Package, Award, Layers, BadgeDollarSign,
  Briefcase, Building2, Shield, HeadphonesIcon, Puzzle, Building,
  ChevronDown, // नया आइकॉन
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
}

interface NavGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>; // ग्रुप के लिए आइकॉन
  items: NavItem[];
}

// ── Role constants ─────────────────────────────────────────────────────────────
const ALL_ROLES: string[] = [];
const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"];
const FINANCE_ROLES = [...ADMIN_ROLES, "ACCOUNTANT"];
const ACADEMIC_ROLES = [...ADMIN_ROLES, "TEACHER", "CLASS_TEACHER"];

// ── New Nested Navigation Definition ──────────────────────────────────────────
const NAV: NavGroup[] = [
  {
    label: "People",
    icon: Users,
    items: [
      { href: "/dashboard/students", label: "Students", icon: Users, roles: [...ADMIN_ROLES, "TEACHER", "CLASS_TEACHER", "NURSE", "RECEPTIONIST"] },
      { href: "/dashboard/staff", label: "Staff", icon: UserCheck, roles: ADMIN_ROLES },
      { href: "/dashboard/admissions", label: "Admissions", icon: UserPlus, roles: ADMIN_ROLES },
    ],
  },
  {
    label: "Learning",
    icon: GraduationCap,
    items: [
      { href: "/dashboard/academics", label: "Academics", icon: BookOpen, roles: ACADEMIC_ROLES },
      { href: "/dashboard/attendance", label: "Attendance", icon: ClipboardCheck, roles: ACADEMIC_ROLES },
      { href: "/dashboard/timetable", label: "Timetable", icon: Calendar, roles: [...ACADEMIC_ROLES, "STUDENT", "PARENT"] },
      { href: "/dashboard/exams", label: "Examinations", icon: GraduationCap, roles: ACADEMIC_ROLES },
      { href: "/dashboard/report-cards", label: "Report Cards", icon: FileText, roles: [...ACADEMIC_ROLES, "PARENT"] },
      { href: "/dashboard/homework", label: "Homework", icon: BookMarked, roles: ACADEMIC_ROLES },
    ],
  },
  {
    label: "Finance",
    icon: BadgeDollarSign,
    items: [
      { href: "/dashboard/billing", label: "Billing", icon: CreditCard, roles: FINANCE_ROLES },
      { href: "/dashboard/billing/discounts", label: "Discounts", icon: Tag, roles: FINANCE_ROLES },
      { href: "/dashboard/accounting", label: "Accounting", icon: Receipt, roles: FINANCE_ROLES },
      { href: "/dashboard/payroll", label: "Payroll", icon: BadgeDollarSign, roles: [...FINANCE_ROLES, "HR_MANAGER"] },
    ],
  },
  {
    label: "Operations",
    icon: Building2,
    items: [
      { href: "/dashboard/library", label: "Library", icon: Library, roles: [...ADMIN_ROLES, "LIBRARIAN"] },
      { href: "/dashboard/transport", label: "Transport", icon: Bus, roles: [...ADMIN_ROLES, "TRANSPORT_MANAGER"] },
      { href: "/dashboard/inventory", label: "Inventory", icon: Package, roles: ADMIN_ROLES },
      { href: "/dashboard/reception", label: "Reception", icon: Building2, roles: [...ADMIN_ROLES, "RECEPTIONIST"] },
    ],
  },
{
    label: "System",
    icon: Settings, // [cite: 101]
    items: [
      { href: "/dashboard/inventory", label: "Inventory", icon: Package, roles: ADMIN_ROLES },
      { href: "/dashboard/bulk", label: "Bulk Ops", icon: Layers, roles: ADMIN_ROLES },
      { href: "/dashboard/access-control", label: "Access Control", icon: Shield, roles: ADMIN_ROLES },
      { href: "/dashboard/support", label: "Support", icon: HeadphonesIcon, roles: ALL_ROLES },
      { href: "/dashboard/settings/school-management", label: "School Profile", icon: Building, roles: ADMIN_ROLES },
      { href: "/dashboard/settings/integrations", label: "Integrations", icon: Puzzle, roles: ADMIN_ROLES },
      { href: "/dashboard/settings", label: "Settings", icon: Settings, roles: ALL_ROLES },
    ],
  },



];

// ── Component ──────────────────────────────────────────────────────────────────
export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ People: true });

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const handleLogout = () => { logout(); router.push("/login"); };

  const filterNav = (role: string | undefined) => {
    if (!role) return [];
    return NAV.map(group => ({
      ...group,
      items: group.items.filter(item => item.roles.length === 0 || item.roles.includes(role))
    })).filter(group => group.items.length > 0);
  };

  const filteredNav = filterNav(user?.role);
  const initials = user ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() : "?";

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <aside className="w-64 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col shadow-sm">
        
        {/* Logo */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-blue-100 shadow-lg">
            <School className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-slate-900 tracking-tight">SchoolOS</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
          {/* Static Overview Link */}
          <Link
            href="/dashboard"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all mb-4",
              pathname === "/dashboard" ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Overview</span>
          </Link>

          {filteredNav.map(group => (
            <div key={group.label} className="space-y-1">
              <button
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <group.icon className="w-3.5 h-3.5" />
                  {group.label}
                </div>
                <ChevronDown className={cn("w-3 h-3 transition-transform", openGroups[group.label] ? "rotate-0" : "-rotate-90")} />
              </button>
              
              {openGroups[group.label] && (
                <div className="space-y-0.5 ml-2 border-l-2 border-slate-50 pl-2">
                  {group.items.map(({ href, label, icon: Icon }) => {
                    const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                          active ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                        )}
                      >
                        <Icon className={cn("w-4 h-4", active ? "text-blue-600" : "text-slate-400")} />
                        <span className="truncate">{label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* User Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3 p-2">
            <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-xs uppercase">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-[10px] text-slate-500 truncate uppercase tracking-tighter">{user?.role}</p>
            </div>
            <button onClick={handleLogout} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-slate-50/30">
        <div className="max-w-7xl mx-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
