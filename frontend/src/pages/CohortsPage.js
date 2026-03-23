import React from 'react';
import { useApi } from '../lib/hooks';

export default function CohortsPage() {
  const { data, loading } = useApi('/api/superadmin/cohorts');
  const cohorts = data?.cohorts || [];

  return (
    <div>
      <div className="mb-8">
        <h1 data-testid="page-title" className="text-2xl font-bold text-white tracking-tight">Cohort Analysis</h1>
        <p className="text-slate-400 text-sm mt-1">Monthly signups and retention by cohort</p>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              {['Month', 'Total Signups', 'Active', 'On Trial', 'Churned', 'Retention %'].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {loading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i}>
                  {[...Array(6)].map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 bg-slate-800 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : cohorts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                  No cohort data yet
                </td>
              </tr>
            ) : (
              cohorts.map((c) => (
                <tr key={c.month} className="hover:bg-slate-800/30">
                  <td className="px-5 py-3.5 font-medium text-slate-200">{c.month}</td>
                  <td className="px-5 py-3.5 text-slate-300">{c.total}</td>
                  <td className="px-5 py-3.5 text-emerald-400">{c.active}</td>
                  <td className="px-5 py-3.5 text-blue-400">{c.trial}</td>
                  <td className="px-5 py-3.5 text-red-400">{c.churned}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${c.retentionRate >= 70 ? 'bg-emerald-500' : c.retentionRate >= 40 ? 'bg-amber-400' : 'bg-red-500'}`}
                          style={{ width: `${c.retentionRate}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400">{c.retentionRate}%</span>
                    </div>
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
