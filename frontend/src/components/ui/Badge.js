import React from 'react';

const V = {
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  error: 'bg-red-500/10 text-red-400 border-red-500/30',
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  neutral: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  purple: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
};

export function Badge({ label, variant = 'neutral' }) {
  return (
    <span
      data-testid={`badge-${label.toLowerCase().replace(/\s+/g, '-')}`}
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${V[variant] || V.neutral}`}
    >
      {label}
    </span>
  );
}
