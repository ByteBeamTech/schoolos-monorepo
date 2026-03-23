import React from 'react';
import { Building2, ShieldAlert, Activity } from 'lucide-react';
import { StatCard } from '../components/ui/StatCard';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { useApi } from '../lib/hooks';
import { formatRelative } from '../lib/utils';

function statusVariant(s) {
  if (s === 'ACTIVE') return 'success';
  if (s === 'TRIAL') return 'info';
  if (s === 'SUSPENDED') return 'warning';
  return 'error';
}

function severityVariant(s) {
  if (s === 'CRITICAL') return 'error';
  if (s === 'HIGH') return 'error';
  if (s === 'MEDIUM') return 'warning';
  return 'neutral';
}

export default function DashboardPage() {
  const { data: tenants, loading: tLoading } = useApi('/api/onboarding/tenants?limit=5');
  const { data: alerts, loading: aLoading } = useApi('/api/fraud/alerts?status=OPEN&limit=5');

  const tenantList = tenants?.data || [];
  const alertList = Array.isArray(alerts) ? alerts : [];
  const total = tenants?.meta?.total || 0;
  const active = tenantList.filter((t) => t.status === 'ACTIVE').length;
  const trial = tenantList.filter((t) => t.status === 'TRIAL').length;
  const openAlerts = alertList.length;

  return (
    <div>
      <PageHeader title="Platform Overview" subtitle="SchoolOS SaaS control center" />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Tenants" value={total} sub={`${active} active · ${trial} trial`} loading={tLoading} />
        <StatCard label="MRR" value="—" sub="Billing module coming" />
        <StatCard label="Total Students" value="—" sub="Across all schools" />
        <StatCard label="Open Alerts" value={openAlerts} sub="Fraud signals" loading={aLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent tenants */}
        <div className="bg-slate-900 rounded-xl border border-slate-800">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-500" />
              <h2 className="font-semibold text-slate-200 text-sm">Recent Tenants</h2>
            </div>
            <a href="/dashboard/tenants" className="text-xs text-orange-400 hover:text-orange-300">
              View all →
            </a>
          </div>
          <div className="divide-y divide-slate-800">
            {tLoading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="h-4 flex-1 bg-slate-800 rounded animate-pulse" />
                </div>
              ))
            ) : tenantList.length === 0 ? (
              <p className="px-5 py-8 text-center text-slate-500 text-sm">No tenants yet</p>
            ) : (
              tenantList.map((t) => (
                <a
                  key={t.id}
                  href={`/dashboard/tenants/${t.id}`}
                  data-testid={`tenant-row-${t.slug}`}
                  className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-800/50 transition-colors group"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-200 group-hover:text-white">{t.name}</p>
                    <p className="text-xs text-slate-500">
                      {t.slug} · {t.region} · {formatRelative(t.createdAt)}
                    </p>
                  </div>
                  <Badge label={t.status} variant={statusVariant(t.status)} />
                </a>
              ))
            )}
          </div>
        </div>

        {/* Fraud alerts */}
        <div className="bg-slate-900 rounded-xl border border-slate-800">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-slate-500" />
              <h2 className="font-semibold text-slate-200 text-sm">Open Fraud Alerts</h2>
            </div>
            <a href="/dashboard/fraud" className="text-xs text-orange-400 hover:text-orange-300">
              View all →
            </a>
          </div>
          <div className="divide-y divide-slate-800">
            {aLoading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="px-5 py-3.5">
                  <div className="h-4 bg-slate-800 rounded animate-pulse" />
                </div>
              ))
            ) : alertList.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-emerald-500 font-medium text-sm">✓ No open alerts</p>
                <p className="text-slate-500 text-xs mt-1">Platform is clean</p>
              </div>
            ) : (
              alertList.map((a) => (
                <div key={a.id} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{a.ruleName}</p>
                      <p className="text-xs text-slate-500 truncate">{a.description}</p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {a.tenant?.name || '—'} · {formatRelative(a.createdAt)}
                      </p>
                    </div>
                    <Badge label={a.severity} variant={severityVariant(a.severity)} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Platform health */}
      <div className="mt-6 bg-slate-900 rounded-xl border border-slate-800">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
          <Activity className="w-4 h-4 text-slate-500" />
          <h2 className="font-semibold text-slate-200 text-sm">Platform Health</h2>
        </div>
        <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'API Server', status: 'operational' },
            { label: 'Database', status: 'operational' },
            { label: 'Redis', status: 'operational' },
            { label: 'Queue Workers', status: 'operational' },
            { label: 'Notifications', status: 'operational' },
            { label: 'File Storage', status: 'degraded' },
            { label: 'Email Service', status: 'degraded' },
            { label: 'SMS Gateway', status: 'degraded' },
          ].map(({ label, status }) => (
            <div key={label} className="flex items-center gap-2.5">
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  status === 'operational' ? 'bg-emerald-500' : 'bg-amber-400'
                }`}
              />
              <div>
                <p className="text-xs font-medium text-slate-300">{label}</p>
                <p
                  className={`text-[10px] ${status === 'operational' ? 'text-emerald-500' : 'text-amber-400'}`}
                >
                  {status === 'operational' ? 'Operational' : 'Not configured'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
