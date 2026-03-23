import React, { useState } from 'react';
import { useApi } from '../lib/hooks';

function ScoreBadge({ score }) {
  const color = score >= 70 ? 'text-emerald-400 bg-emerald-500/10' : score >= 40 ? 'text-amber-400 bg-amber-500/10' : 'text-red-400 bg-red-500/10';
  return <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${color}`}>{score}</span>;
}

export default function HealthPage() {
  const { data, loading } = useApi('/api/superadmin/health');
  const [filter, setFilter] = useState('all');

  const summary = data?.summary || {};
  const scores = (data?.scores || []).filter((s) => filter === 'all' || s.tier === filter);

  return (
    <div>
      <div className="mb-8">
        <h1 data-testid="page-title" className="text-2xl font-bold text-white tracking-tight">Tenant Health Scores</h1>
        <p className="text-slate-400 text-sm mt-1">Scored 0–100 based on logins, feature usage, students and payment health</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { key: 'all', label: 'All', value: (summary.healthy || 0) + (summary.at_risk || 0) + (summary.critical || 0), color: 'text-white' },
          { key: 'healthy', label: 'Healthy', value: summary.healthy || 0, color: 'text-emerald-400' },
          { key: 'at_risk', label: 'At risk', value: summary.at_risk || 0, color: 'text-amber-400' },
          { key: 'critical', label: 'Critical', value: summary.critical || 0, color: 'text-red-400' },
        ].map(({ key, label, value, color }) => (
          <button
            key={key}
            data-testid={`health-filter-${key}`}
            onClick={() => setFilter(key)}
            className={`bg-slate-900 rounded-xl border p-5 text-left transition-colors ${
              filter === key ? 'border-orange-500/50' : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
          </button>
        ))}
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              {['School', 'Status', 'Score', 'Logins 7d', 'Students', 'Sub status', 'Trial ends'].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {loading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i}>
                  {[...Array(7)].map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 bg-slate-800 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : scores.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                  No tenants found
                </td>
              </tr>
            ) : (
              scores.map((s) => (
                <tr key={s.id} className="hover:bg-slate-800/30">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-slate-200">{s.name}</p>
                    <p className="text-xs text-slate-500 font-mono">{s.slug}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`text-xs font-medium ${
                        s.status === 'ACTIVE' ? 'text-emerald-400' : s.status === 'TRIAL' ? 'text-blue-400' : 'text-amber-400'
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <ScoreBadge score={s.score} />
                  </td>
                  <td className="px-5 py-3.5 text-slate-400">{s.signals?.logins7d || 0}</td>
                  <td className="px-5 py-3.5 text-slate-400">{s.signals?.students || 0}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`text-xs ${
                        s.signals?.subStatus === 'ACTIVE'
                          ? 'text-emerald-400'
                          : s.signals?.subStatus === 'PAST_DUE'
                          ? 'text-red-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {s.signals?.subStatus || '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-400">
                    {s.daysToExpiry !== null ? (
                      <span
                        className={
                          s.daysToExpiry <= 3
                            ? 'text-red-400 font-medium'
                            : s.daysToExpiry <= 7
                            ? 'text-amber-400'
                            : 'text-slate-400'
                        }
                      >
                        {s.daysToExpiry}d left
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
