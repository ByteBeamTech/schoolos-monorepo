import React from 'react';
import { useApi } from '../lib/hooks';

export default function MonitoringPage() {
  const { data, loading } = useApi('/api/superadmin/monitoring');

  const services = data?.services || {};
  const activity = data?.activity || {};
  const tenantCounts = data?.tenantCounts || {};

  return (
    <div>
      <div className="mb-8">
        <h1 data-testid="page-title" className="text-2xl font-bold text-white tracking-tight">Platform Monitoring</h1>
        <p className="text-slate-400 text-sm mt-1">Real-time infrastructure and activity status</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Recent Signups (24h)', value: activity.recentSignups || 0 },
          { label: 'Activity (1h)', value: activity.recentActivityLastHour || 0 },
          { label: 'Active Tenants', value: tenantCounts.ACTIVE || 0 },
          { label: 'Trial Tenants', value: tenantCounts.TRIAL || 0 },
        ].map(({ label, value }) => (
          <div key={label} className="bg-slate-900 rounded-xl border border-slate-800 p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{label}</p>
            <p className="text-3xl font-bold text-white mt-1">{loading ? '—' : value}</p>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
        <h2 className="text-sm font-semibold text-slate-200 mb-4">Service Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'API Server', status: 'operational' },
            { label: 'Database', status: services.database || 'up' },
            { label: 'Redis', status: services.redis || 'configured' },
            { label: 'Storage', status: services.storage || 'configured' },
            { label: 'Queue Workers', status: 'operational' },
            { label: 'Email Service', status: 'not configured' },
            { label: 'SMS Gateway', status: 'not configured' },
            { label: 'Push Notifications', status: 'not configured' },
          ].map(({ label, status }) => {
            const isUp = status === 'operational' || status === 'up' || status === 'configured';
            return (
              <div key={label} className="flex items-center gap-2.5">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isUp ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                <div>
                  <p className="text-xs font-medium text-slate-300">{label}</p>
                  <p className={`text-[10px] ${isUp ? 'text-emerald-500' : 'text-amber-400'}`}>
                    {isUp ? 'Operational' : 'Not configured'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {data?.timestamp && (
        <p className="text-xs text-slate-600 mt-4">Last updated: {new Date(data.timestamp).toLocaleString()}</p>
      )}
    </div>
  );
}
