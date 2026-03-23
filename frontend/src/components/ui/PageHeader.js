import React from 'react';

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1 data-testid="page-title" className="text-2xl font-bold text-white tracking-tight">{title}</h1>
        {subtitle && <p className="text-slate-400 text-sm mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
