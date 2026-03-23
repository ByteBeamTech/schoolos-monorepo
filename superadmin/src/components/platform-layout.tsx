"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSAStore } from "@/lib/store";
import {
  LayoutDashboard, Building2, CreditCard, ShieldAlert,
  Settings, LogOut, Zap, ChevronRight, BarChart3,
  TrendingUp, Heart, FlaskConical, Megaphone, Users,
  Gift, MessageSquare, Tag, Monitor, Network, Star,
  KeyRound,
} from "lucide-react";

const NAV = [
  {
    group: "Platform",
    items: [
      { href: "/dashboard",                  label: "Overview",        icon: LayoutDashboard },
      { href: "/dashboard/analytics",        label: "Revenue",         icon: TrendingUp      },
      { href: "/dashboard/analytics/cohorts",label: "Cohorts",         icon: BarChart3       },
      { href: "/dashboard/health",           label: "Tenant Health",   icon: Heart           },
      { href: "/dashboard/trials",           label: "Trial Funnel",    icon: FlaskConical    },
    ],
  },
  {
    group: "Tenants",
    items: [
      { href: "/dashboard/tenants",          label: "All Schools",     icon: Building2       },
      { href: "/dashboard/knowledge",        label: "Query Builder",   icon: Network         },
      { href: "/dashboard/impersonate",      label: "Shadow Login",    icon: KeyRound        },
      { href: "/dashboard/feature-flags",    label: "Feature Flags",   icon: FlaskConical    },
    ],
  },
  {
    group: "Revenue",
    items: [
      { href: "/dashboard/billing",          label: "SaaS Billing",    icon: CreditCard      },
      { href: "/dashboard/pricing",          label: "Pricing Plans",   icon: BarChart3       },
      { href: "/dashboard/coupons",          label: "Coupons",         icon: Tag             },
      { href: "/dashboard/referrals",        label: "Referrals",       icon: Gift            },
    ],
  },
  {
    group: "Operations",
    items: [
      { href: "/dashboard/fraud",            label: "Fraud Alerts",    icon: ShieldAlert     },
      { href: "/dashboard/announcements",    label: "Announcements",   icon: Megaphone       },
      { href: "/dashboard/support",          label: "Customer Success",icon: Users           },
      { href: "/dashboard/nps",              label: "NPS",             icon: Star            },
      { href: "/dashboard/monitoring",       label: "Monitoring",      icon: Monitor         },
    ],
  },
  {
    group: "System",
    items: [
      { href: "/dashboard/settings",         label: "Settings",        icon: Settings        },
    ],
  },
];

export function PlatformLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { logout, user } = useSAStore();

  return (
    <div className="flex min-h-screen bg-slate-950">
      <aside className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col fixed h-full z-20">
        <div className="px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="bg-orange-500 rounded-lg p-1.5">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-white text-sm tracking-tight">SchoolOS</p>
              <p className="text-[10px] text-orange-400 font-medium tracking-widest uppercase">Platform</p>
            </div>
          </div>
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
      </aside>

      <main className="flex-1 ml-56 min-h-screen bg-slate-950">
        <div className="max-w-7xl mx-auto p-8">{children}</div>
      </main>
    </div>
  );
}
