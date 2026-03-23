import React from 'react';

export function StatCard({ label, value, sub, delta, positive, loading }) {
  return (
    <div
      data-testid={`stat-card-${label.toLowerCase().replace(/\s+/g, '-')}`}
      className="bg-slate-900 rounded-xl border border-slate-800 p-5"
    >
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{label}</p>
      {loading ? (
        <div className="h-8 w-28 bg-slate-800 rounded animate-pulse mt-2" />
      ) : (
        <p className="text-3xl font-bold text-white mt-1 tracking-tight">{value}</p>
      )}
      <div className="flex items-center gap-2 mt-1">
        {delta && (
          <span className={`text-xs font-medium ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
            {delta}
          </span>
        )}
        {sub && <span className="text-xs text-slate-500">{sub}</span>}
      </div>
    </div>
  );
}
