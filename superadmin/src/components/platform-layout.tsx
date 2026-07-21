"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSAStore } from "@/lib/store";
// UI-0.5: migrated off lib/use-api.ts (deleted — see lib/hooks.ts's own
// header comment for why). pollInterval: 30000 preserves the exact 30s
// polling cadence this sidebar badge always had; the consolidated hook
// additionally pauses while the tab is hidden and force-refetches on
// focus, which lib/use-api.ts's SWR-based version did not do.
import { useApi } from "@/lib/hooks";
import { useSocketEvent } from "@/lib/use-socket";
import { notifyTab } from "@/lib/tab-attention";
import {
  LayoutDashboard, Building2, CreditCard, ShieldAlert,
  Settings, Inbox, LogOut, Shield, Zap, ChevronRight, BarChart3,
  TrendingUp, Heart, FlaskConical, Megaphone, Users,
  Gift, MessageSquare, Tag, Monitor, Network, Star,
  KeyRound, UserCog, MailPlus, Laptop, History, Menu, X,
} from "lucide-react";

export function PlatformLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useSAStore();

  // MOBILE NAV: sidebar is a static flex column on desktop (md and up,
  // unchanged behavior from before). Below md it becomes an off-canvas
  // drawer, opened via the mobile top bar's hamburger button — same
  // conditional-render + backdrop + slide-in pattern as the tenant-facing
  // app's DashboardLayout (frontend/src/components/dashboard-layout.tsx),
  // so the two apps' mobile nav behave identically even though their color
  // schemes differ (this app stays dark/orange, on purpose — see note below).
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Close mobile sidebar on route change — same as tenant frontend.
  useEffect(() => { setMobileNavOpen(false); }, [pathname]);

 


// ─── LIVE DATA FETCHING ───
// हम 'any' टाइप का उपयोग कर रहे हैं ताकि बैकएंड के अलग-अलग स्ट्रक्चर को हैंडल कर सकें
const { data: pendingData, loading, refetch: refetchPending } = useApi<any>('/flags/requests/pending', [], { pollInterval: 30000 });
// REALTIME: immediate badge update instead of waiting up to 30s. Poll
// interval above stays as a fallback.
useSocketEvent("flags:new-request",     () => { refetchPending(); notifyTab("New approval request"); });
useSocketEvent("flags:request-updated", () => refetchPending());

// Defensive Logic: पहले check करो कि count सीधा मिल रहा है या 'data' ऑब्जेक्ट के अंदर
const pendingCount = pendingData?.data?.count ?? pendingData?.count ?? 0;

  const NAV = [
    {
      group: "Platform",
      items: [
        { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
        { href: "/dashboard/analytics", label: "Revenue", icon: TrendingUp },
        { href: "/dashboard/analytics/cohorts", label: "Cohorts", icon: BarChart3 },
        { href: "/dashboard/health", label: "Tenant Health", icon: Heart },
        { href: "/dashboard/trials", label: "Trial Funnel", icon: FlaskConical },
      ],
    },
    {
      group: "Tenants",
      items: [
        { href: "/dashboard/tenants", label: "All Schools", icon: Building2 },
        { href: "/dashboard/knowledge", label: "Query Builder", icon: Network },
        { href: "/dashboard/impersonate", label: "Shadow Login", icon: KeyRound },
        { href: "/dashboard/feature-flags", label: "Feature Flags", icon: FlaskConical },
        // ─── UPDATED NAV ITEM WITH BADGE ───
        { 
          href: "/dashboard/approvals", 
          label: `Approvals${pendingCount > 0 ? ` (${pendingCount})` : ""}`, 
          icon: Inbox 
        },
      ],
    },
    {
      group: "Revenue",
      items: [
        { href: "/dashboard/billing", label: "SaaS Billing", icon: CreditCard },
        { href: "/dashboard/pricing", label: "Pricing Plans", icon: BarChart3 },
        { href: "/dashboard/coupons", label: "Coupons", icon: Tag },
        { href: "/dashboard/referrals", label: "Referrals", icon: Gift },
      ],
    },
    {
      group: "Operations",
      items: [
        { href: "/dashboard/fraud", label: "Fraud Alerts", icon: ShieldAlert },
        { href: "/dashboard/announcements", label: "Announcements", icon: Megaphone },
        { href: "/dashboard/support", label: "Customer Success", icon: Users },
        { href: "/dashboard/nps", label: "NPS", icon: Star },
        { href: "/dashboard/monitoring", label: "Monitoring", icon: Monitor },
      ],
    },
    {
      group: "Administration",
      items: [
        { href: "/dashboard/admin/users", label: "Users", icon: UserCog },
        { href: "/dashboard/admin/invitations", label: "Invitations", icon: MailPlus },
        { href: "/dashboard/admin/sessions", label: "Sessions", icon: Laptop },
        { href: "/dashboard/admin/login-history", label: "Login History", icon: History },
      ],
    },
    {
      group: "System",
      items: [
        { href: "/dashboard/audit", label: "Audit Log", icon: Shield },
        { href: "/dashboard/settings", label: "Settings", icon: Settings },
      ],
    },
  ];

  // ── Sidebar content (shared between desktop static column + mobile drawer) ──
  // Same "define once, reuse in both places" shape as the tenant frontend's
  // SidebarContent, so the two don't drift out of sync with each other as
  // nav items get added on either side.
  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="bg-orange-500 rounded-lg p-1.5">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-sm tracking-tight">SchoolOS</p>
            <p className="text-[10px] text-orange-400 font-medium tracking-widest uppercase">Platform</p>
          </div>
        </div>
        {/* Close button — mobile drawer only, no-op (hidden) on desktop */}
        <button
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close menu"
          className="md:hidden text-slate-500 hover:text-white p-1 -mr-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {NAV.map(({ group, items }) => (
          <div key={group}>
            <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-2 mb-1.5">{group}</p>
            {items.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
              return (
                <Link key={href} href={href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    active ? "bg-orange-500/10 text-orange-400" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}>
                  <Icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-orange-400" : "text-slate-500"}`} />
                  <span className="flex-1">{label}</span>
                  {active && <ChevronRight className="w-3 h-3 text-orange-500/50" />}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-800 p-3">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user?.email?.[0]?.toUpperCase() ?? "S"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-300 truncate">{user?.email ?? "superadmin"}</p>
            <p className="text-[10px] text-slate-500">Platform Admin</p>
          </div>
          <button onClick={() => { logout(); router.push("/login"); }}
            className="text-slate-500 hover:text-red-400 transition-colors" title="Logout">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">

      {/* ── Desktop sidebar — static flex column, unchanged visually from before ── */}
      <aside className="hidden md:flex flex-col w-56 flex-shrink-0 bg-slate-900 border-r border-slate-800">
        <SidebarContent />
      </aside>

      {/* ── Mobile sidebar overlay — only in the DOM while open, matching the
           tenant frontend's conditional-render + backdrop + slide-in pattern ── */}
      {mobileNavOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <aside className="fixed top-0 left-0 bottom-0 w-64 z-50 md:hidden bg-slate-900 border-r border-slate-800 animate-slide-in-left">
            <SidebarContent />
          </aside>
        </>
      )}

      {/* ── Main content area ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile top bar — only below md; desktop has no top bar, same as before */}
        <header className="md:hidden flex-shrink-0 flex items-center justify-between px-4 h-14 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="bg-orange-500 rounded-lg p-1.5">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <p className="font-bold text-white text-sm tracking-tight">SchoolOS</p>
          </div>
          <button
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
            aria-expanded={mobileNavOpen}
            className="text-slate-300 hover:text-white p-2 -mr-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-950">
          <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
