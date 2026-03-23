import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { useApi } from '../lib/hooks';
import { api } from '../lib/api';

const CHANNELS = ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH'];

export default function AnnouncementsPage() {
  const { data: tenants } = useApi('/api/onboarding/tenants?limit=200');
  const tenantList = tenants?.data || [];

  const [form, setForm] = useState({
    title: '',
    body: '',
    channel: 'EMAIL',
    targetAll: true,
    targetTenantId: '',
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const send = async (e) => {
    e.preventDefault();
    if (!form.title || !form.body) {
      alert('Title and body required');
      return;
    }
    setSending(true);
    try {
      // In production, this would call a notifications API
      await new Promise((r) => setTimeout(r, 1000));
      setSent(true);
      setTimeout(() => setSent(false), 5000);
      setForm((p) => ({ ...p, title: '', body: '' }));
    } catch (e) {
      alert(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 data-testid="page-title" className="text-2xl font-bold text-white tracking-tight">Announcements</h1>
        <p className="text-slate-400 text-sm mt-1">Send platform-wide or targeted messages to schools</p>
      </div>

      {sent && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm px-4 py-3 rounded-lg mb-5">
          ✓ Announcement queued for delivery
        </div>
      )}

      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 max-w-2xl">
        <form onSubmit={send} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Channel</label>
            <div className="flex gap-2">
              {CHANNELS.map((c) => (
                <button
                  key={c}
                  type="button"
                  data-testid={`channel-${c.toLowerCase()}`}
                  onClick={() => setForm((p) => ({ ...p, channel: c }))}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                    form.channel === c ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Subject / Title *</label>
            <input
              data-testid="announcement-title"
              required
              type="text"
              value={form.title}
              onChange={f('title')}
              placeholder="e.g. Scheduled maintenance — March 25"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Message *</label>
            <textarea
              data-testid="announcement-body"
              required
              rows={5}
              value={form.body}
              onChange={f('body')}
              placeholder="Write your announcement..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-600 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Target</label>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={form.targetAll}
                onChange={f('targetAll')}
                className="accent-orange-500 w-4 h-4"
              />
              <span className="text-sm text-slate-300">All tenants ({tenantList.length} schools)</span>
            </label>
            {!form.targetAll && (
              <select
                value={form.targetTenantId}
                onChange={f('targetTenantId')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-orange-500"
              >
                <option value="">Specific tenant...</option>
                {tenantList.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.slug})
                  </option>
                ))}
              </select>
            )}
          </div>

          <button
            data-testid="send-announcement-btn"
            type="submit"
            disabled={sending}
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" /> {sending ? 'Sending...' : 'Send announcement'}
          </button>
        </form>
      </div>
    </div>
  );
}
