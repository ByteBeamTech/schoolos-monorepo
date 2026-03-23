import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { useApi } from '../lib/hooks';
import { formatCurrency } from '../lib/utils';
import { api } from '../lib/api';

const TIERS = ['STARTER', 'GROWTH', 'PRO', 'ENTERPRISE'];
const MODELS = ['PER_STUDENT', 'SUBSCRIPTION', 'HYBRID'];
const REGIONS = ['IN', 'US', 'EU', 'UK', 'GLOBAL'];
const CURRENCIES = ['INR', 'USD', 'GBP', 'EUR'];

function tierVariant(t) {
  if (t === 'ENTERPRISE') return 'purple';
  if (t === 'PRO') return 'info';
  if (t === 'GROWTH') return 'success';
  return 'neutral';
}

export default function PricingPage() {
  const { data, loading, refetch } = useApi('/api/saas/pricing-plans');
  const plans = Array.isArray(data) ? data : [];

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    tier: 'STARTER',
    model: 'SUBSCRIPTION',
    currency: 'INR',
    region: 'IN',
    baseFee: '',
    perStudentRate: '',
    studentLimit: '',
    overageRate: '',
    overageEnabled: false,
    trialDays: '30',
  });

  const save = async () => {
    setSaving(true);
    try {
      await api.post('/api/saas/pricing-plans', {
        ...form,
        baseFee: form.baseFee ? Number(form.baseFee) : null,
        perStudentRate: form.perStudentRate ? Number(form.perStudentRate) : null,
        studentLimit: form.studentLimit ? Number(form.studentLimit) : null,
        overageRate: form.overageRate ? Number(form.overageRate) : null,
        trialDays: Number(form.trialDays),
      });
      setShowModal(false);
      setForm({
        name: '',
        tier: 'STARTER',
        model: 'SUBSCRIPTION',
        currency: 'INR',
        region: 'IN',
        baseFee: '',
        perStudentRate: '',
        studentLimit: '',
        overageRate: '',
        overageEnabled: false,
        trialDays: '30',
      });
      refetch();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const f = (k) => (e) =>
    setForm((p) => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <div>
      <PageHeader
        title="Pricing Plans"
        subtitle="Define subscription tiers and pricing models"
        action={
          <button
            data-testid="new-plan-btn"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> New Plan
          </button>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-slate-900 rounded-xl border border-slate-800 p-5 h-52 animate-pulse" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-16 text-center">
          <p className="text-slate-400 text-lg mb-2">No pricing plans yet</p>
          <p className="text-slate-600 text-sm">Create your first plan to start onboarding schools</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {plans.map((plan) => (
            <div
              key={plan.id}
              data-testid={`plan-card-${plan.id}`}
              className={`bg-slate-900 rounded-xl border p-5 ${plan.isActive ? 'border-slate-700' : 'border-slate-800 opacity-60'}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-white text-base">{plan.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {plan.region} · {plan.currency}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 items-end">
                  <Badge label={plan.tier} variant={tierVariant(plan.tier)} />
                  <Badge label={plan.model} variant="neutral" />
                </div>
              </div>

              <div className="space-y-2 mt-4">
                {plan.model === 'SUBSCRIPTION' && plan.baseFee && (
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-orange-400">
                      {formatCurrency(Number(plan.baseFee), plan.currency)}
                    </span>
                    <span className="text-xs text-slate-500">/month</span>
                  </div>
                )}
                {plan.model === 'PER_STUDENT' && plan.perStudentRate && (
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-orange-400">
                      {formatCurrency(Number(plan.perStudentRate), plan.currency)}
                    </span>
                    <span className="text-xs text-slate-500">/student/month</span>
                  </div>
                )}
                {plan.model === 'HYBRID' && (
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold text-orange-400">
                        {formatCurrency(Number(plan.baseFee || 0), plan.currency)}
                      </span>
                      <span className="text-xs text-slate-500">base</span>
                    </div>
                    {plan.overageEnabled && plan.overageRate && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        + {formatCurrency(Number(plan.overageRate), plan.currency)}/student above {plan.studentLimit || '—'}
                      </p>
                    )}
                  </div>
                )}
                {plan.studentLimit && (
                  <p className="text-xs text-slate-500">Up to {plan.studentLimit.toLocaleString()} students</p>
                )}
                <p className="text-xs text-slate-500">{plan.trialDays} day free trial</p>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-800">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${plan.isActive ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                  <span className="text-xs text-slate-500">{plan.isActive ? 'Active' : 'Inactive'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Pricing Plan">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Plan Name', key: 'name', type: 'text', span: 2 },
              { label: 'Tier', key: 'tier', type: 'select', options: TIERS },
              { label: 'Model', key: 'model', type: 'select', options: MODELS },
              { label: 'Region', key: 'region', type: 'select', options: REGIONS },
              { label: 'Currency', key: 'currency', type: 'select', options: CURRENCIES },
              { label: 'Base Fee', key: 'baseFee', type: 'number' },
              { label: 'Per Student Rate', key: 'perStudentRate', type: 'number' },
              { label: 'Student Limit', key: 'studentLimit', type: 'number' },
              { label: 'Overage Rate', key: 'overageRate', type: 'number' },
              { label: 'Trial Days', key: 'trialDays', type: 'number' },
            ].map(({ label, key, type, options, span }) => (
              <div key={key} className={span === 2 ? 'col-span-2' : ''}>
                <label className="block text-xs font-semibold text-slate-400 mb-1">{label}</label>
                {type === 'select' ? (
                  <select
                    data-testid={`plan-${key}`}
                    value={form[key]}
                    onChange={f(key)}
                    className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 text-slate-200 rounded-lg focus:outline-none focus:border-orange-500"
                  >
                    {options.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    data-testid={`plan-${key}`}
                    type={type}
                    value={form[key]}
                    onChange={f(key)}
                    className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 text-slate-200 rounded-lg focus:outline-none focus:border-orange-500 placeholder-slate-600"
                    placeholder="—"
                  />
                )}
              </div>
            ))}
            <div className="col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="overage"
                checked={form.overageEnabled}
                onChange={f('overageEnabled')}
                className="accent-orange-500"
              />
              <label htmlFor="overage" className="text-sm text-slate-300">
                Enable overage billing
              </label>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowModal(false)}
              className="flex-1 px-4 py-2 text-sm bg-slate-800 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              data-testid="create-plan-btn"
              onClick={save}
              disabled={saving || !form.name}
              className="flex-1 px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Create Plan'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
