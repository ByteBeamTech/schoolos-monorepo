import React from 'react';
import { useApi } from '../lib/hooks';
import { formatCurrency, formatDate } from '../lib/utils';

function Kpi({ label, value, sub }) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function AnalyticsPage() {
  const { data, loading } = useApi('/api/superadmin/revenue');

  if (loading)
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  const aging = data?.aging?.buckets || {};
  const agingDetail = data?.aging?.details || [];
  const churn = data?.churn || {};
  const byReason = Object.entries(churn.byReason || {});
  const byRegion = Object.entries(data?.revenueByRegion || {});

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">Revenue Intelligence</h1>
        <p className="text-slate-400 text-sm mt-1">MRR, ARR, churn analysis and invoice aging</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Kpi label="MRR" value={formatCurrency(data?.mrr || 0)} sub="Monthly recurring" />
        <Kpi label="ARR" value={formatCurrency(data?.arr || 0)} sub="Annualised" />
        <Kpi label="Active Subs" value={String(data?.activeSubscriptions || 0)} sub="Paying tenants" />
        <Kpi label="Overdue (60d+)" value={formatCurrency(aging.days90plus || 0)} sub="Needs collection" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-slate-900 rounded-xl border border-slate-800 p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Invoice aging buckets</h2>
          {[
            { label: 'Current (not due)', value: aging.current || 0, color: 'bg-emerald-500' },
            { label: '1–30 days', value: aging.days30 || 0, color: 'bg-amber-400' },
            { label: '31–60 days', value: aging.days60 || 0, color: 'bg-orange-500' },
            { label: '60+ days', value: aging.days90plus || 0, color: 'bg-red-500' },
          ].map(({ label, value, color }) => {
            const max = Math.max(aging.current, aging.days30, aging.days60, aging.days90plus, 1);
            return (
              <div key={label} className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">{label}</span>
                  <span className="text-slate-200 font-medium">{formatCurrency(value)}</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${color}`}
                    style={{ width: `${Math.round((value / max) * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Revenue by region</h2>
          {byRegion.length === 0 ? (
            <p className="text-slate-500 text-sm">No data yet</p>
          ) : (
            byRegion.map(([region, amount]) => (
              <div key={region} className="flex justify-between text-sm py-2 border-b border-slate-800 last:border-0">
                <span className="text-slate-400">{region}</span>
                <span className="text-slate-200 font-medium">{formatCurrency(amount)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-200">Overdue Invoices ({agingDetail.length})</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              {['Invoice', 'School', 'Amount', 'Days overdue', 'Due date', 'Status'].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {agingDetail.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-emerald-500 text-sm">
                  ✓ No overdue invoices
                </td>
              </tr>
            ) : (
              agingDetail.slice(0, 20).map((inv, i) => (
                <tr key={i} className="hover:bg-slate-800/30">
                  <td className="px-5 py-3 font-mono text-xs text-slate-400">{inv.invoiceNumber}</td>
                  <td className="px-5 py-3 text-slate-300">{inv.tenantName}</td>
                  <td className="px-5 py-3 font-semibold text-slate-200">{formatCurrency(inv.amount)}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        inv.daysOverdue > 60
                          ? 'bg-red-500/10 text-red-400'
                          : inv.daysOverdue > 30
                          ? 'bg-orange-500/10 text-orange-400'
                          : 'bg-amber-500/10 text-amber-400'
                      }`}
                    >
                      {inv.daysOverdue}d
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500">{formatDate(inv.dueDate)}</td>
                  <td className="px-5 py-3 text-xs text-slate-500">{inv.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
