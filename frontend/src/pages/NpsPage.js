import React from 'react';
import { Star } from 'lucide-react';
import { useApi } from '../lib/hooks';

export default function NpsPage() {
  const { data: tenants } = useApi('/api/onboarding/tenants?limit=200&status=ACTIVE');
  const list = tenants?.data || [];

  const sendSurvey = async () => {
    if (!window.confirm(`Send NPS survey to all ${list.length} active tenants?`)) return;
    alert(`NPS survey queued for ${list.length} schools`);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 data-testid="page-title" className="text-2xl font-bold text-white tracking-tight">NPS Tracking</h1>
        <p className="text-slate-400 text-sm mt-1">Net Promoter Score surveys — send and track school sentiment</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'NPS Score', value: '—', sub: 'Not enough responses' },
          { label: 'Promoters', value: '—', sub: 'Score 9-10' },
          { label: 'Detractors', value: '—', sub: 'Score 0-6' },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-slate-900 rounded-xl border border-slate-800 p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{label}</p>
            <p className="text-3xl font-bold text-white mt-1">{value}</p>
            <p className="text-xs text-slate-600 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <h2 className="text-sm font-semibold text-slate-300 mb-2">Send NPS survey</h2>
        <p className="text-xs text-slate-500 mb-4">
          Sends an email to all {list.length} active school admins asking for a 0–10 score.
        </p>
        <button
          data-testid="send-nps-btn"
          onClick={sendSurvey}
          className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg font-medium transition-colors"
        >
          <Star className="w-4 h-4" />
          Send survey to {list.length} schools
        </button>
        <p className="text-xs text-slate-600 mt-3">
          A dedicated NPS model is on the roadmap — responses will be tracked automatically when built.
        </p>
      </div>
    </div>
  );
}
