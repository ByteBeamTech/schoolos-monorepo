import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from './lib/store';
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  TrendingUp,
  BarChart3,
  Settings,
  LogOut,
  Zap,
  ChevronRight,
} from 'lucide-react';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TenantsPage from './pages/TenantsPage';
import TenantDetailPage from './pages/TenantDetailPage';
import PricingPage from './pages/PricingPage';
import AnalyticsPage from './pages/AnalyticsPage';

const NAV = [
  {
    group: 'Platform',
    items: [
      { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
      { href: '/dashboard/analytics', label: 'Revenue', icon: TrendingUp },
    ],
  },
  {
    group: 'Tenants',
    items: [{ href: '/dashboard/tenants', label: 'All Schools', icon: Building2 }],
  },
  {
    group: 'Revenue',
    items: [{ href: '/dashboard/pricing', label: 'Pricing Plans', icon: BarChart3 }],
  },
];

function ProtectedRoute({ children }) {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && !isAuthenticated) navigate('/login');
  }, [hydrated, isAuthenticated, navigate]);

  if (!hydrated || !isAuthenticated)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  return <>{children}</>;
}

function PlatformLayout({ children }) {
  const pathname = useLocation().pathname;
  const navigate = useNavigate();
  const { logout, user } = useAuthStore();

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
              <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-2 mb-1.5">
                {group}
              </p>
              {items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    to={href}
                    data-testid={`nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      active
                        ? 'bg-orange-500/10 text-orange-400'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-orange-400' : 'text-slate-500'}`} />
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
              {user?.email?.[0]?.toUpperCase() || 'S'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-300 truncate">{user?.email || 'superadmin'}</p>
              <p className="text-[10px] text-slate-500">Platform Admin</p>
            </div>
            <button
              data-testid="logout-btn"
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="text-slate-500 hover:text-red-400 transition-colors"
              title="Logout"
            >
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

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <PlatformLayout>
              <DashboardPage />
            </PlatformLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/tenants"
        element={
          <ProtectedRoute>
            <PlatformLayout>
              <TenantsPage />
            </PlatformLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/tenants/:id"
        element={
          <ProtectedRoute>
            <PlatformLayout>
              <TenantDetailPage />
            </PlatformLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/pricing"
        element={
          <ProtectedRoute>
            <PlatformLayout>
              <PricingPage />
            </PlatformLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/analytics"
        element={
          <ProtectedRoute>
            <PlatformLayout>
              <AnalyticsPage />
            </PlatformLayout>
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
