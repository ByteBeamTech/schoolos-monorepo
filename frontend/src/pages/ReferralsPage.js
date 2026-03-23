import React from 'react';
import { Gift } from 'lucide-react';

const MOCK_REFERRALS = [
  { referrerSchool: 'Delhi Public School', newSchool: 'St. Mary Academy', status: 'VERIFIED', reward: 2000 },
  { referrerSchool: 'Modern School', newSchool: 'City Montessori', status: 'PENDING', reward: 2000 },
  { referrerSchool: 'Kendriya Vidyalaya', newSchool: 'Ryan International', status: 'VERIFIED', reward: 3000 },
];

export default function ReferralsPage() {
  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 data-testid="page-title" className="text-2xl font-bold text-white tracking-tight">Referral Command Center</h1>
          <p className="text-slate-400 text-sm mt-1">Track school referrals and rewards</p>
        </div>
        <button
          data-testid="new-referral-btn"
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg font-medium transition-colors"
        >
          <Gift className="w-4 h-4" /> Create referral link
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Referrals', value: MOCK_REFERRALS.length },
          { label: 'Verified', value: MOCK_REFERRALS.filter((r) => r.status === 'VERIFIED').length },
          { label: 'Total Rewards', value: `₹${MOCK_REFERRALS.reduce((sum, r) => sum + (r.status === 'VERIFIED' ? r.reward : 0), 0).toLocaleString('en-IN')}` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-slate-900 rounded-xl border border-slate-800 p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{label}</p>
            <p className="text-3xl font-bold text-white mt-1">{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              {['Referrer School', 'New School', 'Status', 'Reward'].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {MOCK_REFERRALS.map((r, i) => (
              <tr key={i} className="hover:bg-slate-800/30">
                <td className="px-5 py-4 text-slate-200">{r.referrerSchool}</td>
                <td className="px-5 py-4 text-slate-200">{r.newSchool}</td>
                <td className="px-5 py-4">
                  <span
                    className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      r.status === 'VERIFIED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-5 py-4 text-slate-200 font-semibold">₹{r.reward.toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
