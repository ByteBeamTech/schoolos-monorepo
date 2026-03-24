'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import type {
  PricingModel,
  SubscriptionTier,
  Currency,
  Region,
  CreatePricingPlanDto,
} from '@schoolos/api-contracts/pricing';

// --- Constants ----------------------------------------------------------------

const MODELS: { type: PricingModel; label: string; description: string; color: string }[] = [
  {
    type: 'PER_STUDENT',
    label: 'Per Student',
    description: 'Charge per active student — scales with school size',
    color: 'bg-blue-50 border-blue-200 text-blue-700',
  },
  {
    type: 'SUBSCRIPTION',
    label: 'Subscription',
    description: 'Fixed fee per billing cycle with student cap',
    color: 'bg-violet-50 border-violet-200 text-violet-700',
  },
  {
    type: 'HYBRID',
    label: 'Hybrid',
    description: 'Base fee + overage per extra student beyond limit',
    color: 'bg-amber-50 border-amber-200 text-amber-700',
  },
];

const TIERS: SubscriptionTier[] = ['STARTER', 'GROWTH', 'PRO', 'ENTERPRISE'];
const CURRENCIES: Currency[] = ['USD', 'INR', 'GBP', 'EUR', 'AED'];
const REGIONS: Region[] = ['GLOBAL', 'IN', 'US', 'EU', 'UK'];
const CURRENCY_SYMBOL: Record<Currency, string> = {
  USD: '$', INR: '?', GBP: '£', EUR: '€', AED: '?.?',
};

// --- Form state ---------------------------------------------------------------

const defaultForm = (): CreatePricingPlanDto => ({
  name: '',
  tier: 'STARTER',
  model: 'PER_STUDENT',
  currency: 'USD',
  region: 'GLOBAL',
  billingCycleMonths: 1,
  trialDays: 30,
  prorateEnabled: true,
  overageEnabled: false,
  features: [],
});

// --- Bill preview -------------------------------------------------------------

function BillPreview({
  planId,
  studentCount,
  customPerStudentRate,
  customBaseFee,
}: {
  planId?: string;
  studentCount: number;
  customPerStudentRate?: number;
  customBaseFee?: number;
}) {
  const { data, isLoading } = trpc.pricing.calculate.useQuery(
    { planId: planId!, studentCount, customPerStudentRate, customBaseFee },
    { enabled: !!planId && studentCount > 0 },
  );

  if (!planId) return <p className="text-xs text-gray-400">Select a plan to preview</p>;
  if (isLoading) return <p className="text-xs text-gray-400">Calculating...</p>;
  if (!data) return null;

  const sym = CURRENCY_SYMBOL[data.currency as Currency] ?? data.currency;

  return (
    <div className="space-y-2 text-sm">
      {data.breakdown.map((item, i) => (
        <div key={i} className="flex justify-between text-gray-600">
          <span className="text-xs">{item.label}</span>
          <span className={item.amount < 0 ? 'text-green-600 font-medium' : ''}>
            {item.amount === 0 ? '—' : `${sym}${Math.abs(item.amount).toFixed(2)}`}
          </span>
        </div>
      ))}
      <div className="border-t border-gray-100 pt-2 flex justify-between font-semibold text-gray-900">
        <span>Total</span>
        <span>{sym}{data.total.toFixed(2)}</span>
      </div>
      {data.effectivePricePerStudent !== undefined && (
        <p className="text-xs text-gray-400">
          {sym}{data.effectivePricePerStudent.toFixed(4)} / student effective rate
          {data.isCustomRates && ' (custom)'}
        </p>
      )}
    </div>
  );
}

// --- Main Page ----------------------------------------------------------------

export default function PricingPage() {
  const [form, setForm] = useState<CreatePricingPlanDto>(defaultForm());
  const [selectedPlanId, setSelectedPlanId] = useState<string>();
  const [previewStudents, setPreviewStudents] = useState(200);
  const [customPerStudentRate, setCustomPerStudentRate] = useState('');
  const [customBaseFee, setCustomBaseFee] = useState('');
  const [featureInput, setFeatureInput] = useState('');

  const { data: plans, refetch } = trpc.pricing.listPlans.useQuery({});
  const createPlan = trpc.pricing.createPlan.useMutation({ onSuccess: () => { refetch(); setForm(defaultForm()); } });

  const set = <K extends keyof CreatePricingPlanDto>(k: K, v: CreatePricingPlanDto[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const sym = CURRENCY_SYMBOL[form.currency] ?? form.currency;
  const activeModel = MODELS.find((m) => m.type === form.model)!;

  const addFeature = () => {
    if (!featureInput.trim()) return;
    set('features', [...(form.features ?? []), featureInput.trim()]);
    setFeatureInput('');
  };

  const removeFeature = (i: number) =>
    set('features', (form.features ?? []).filter((_, idx) => idx !== i));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pricing Engine"
        description="Manage SaaS pricing plans for school tenants"
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Active Plans" value={plans?.length ?? 0} />
        <StatCard label="Per-Student" value={plans?.filter((p) => p.model === 'PER_STUDENT').length ?? 0} />
        <StatCard label="Subscription" value={plans?.filter((p) => p.model === 'SUBSCRIPTION').length ?? 0} />
        <StatCard label="Hybrid" value={plans?.filter((p) => p.model === 'HYBRID').length ?? 0} />
      </div>

      {/* Existing Plans */}
      {plans && plans.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Existing Plans
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Tier</th>
                  <th className="pb-2 font-medium">Model</th>
                  <th className="pb-2 font-medium">Currency</th>
                  <th className="pb-2 font-medium">Region</th>
                  <th className="pb-2 font-medium">Cycle</th>
                  <th className="pb-2 font-medium">Rate / Fee</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {plans.map((plan) => (
                  <tr
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`cursor-pointer hover:bg-gray-50 transition-colors ${selectedPlanId === plan.id ? 'bg-blue-50' : ''}`}
                  >
                    <td className="py-3 font-medium text-gray-900">{plan.name}</td>
                    <td className="py-3">
                      <Badge className="bg-gray-100 text-gray-600 text-xs">{plan.tier}</Badge>
                    </td>
                    <td className="py-3">
                      <Badge className={MODELS.find((m) => m.type === plan.model)?.color + ' text-xs'}>
                        {plan.model}
                      </Badge>
                    </td>
                    <td className="py-3 text-gray-600">{plan.currency}</td>
                    <td className="py-3 text-gray-600">{plan.region}</td>
                    <td className="py-3 text-gray-600">
                      {plan.billingCycleMonths === 1 ? 'Monthly' : plan.billingCycleMonths === 12 ? 'Annual' : `${plan.billingCycleMonths}mo`}
                    </td>
                    <td className="py-3 text-gray-600">
                      {plan.perStudentRate ? `${CURRENCY_SYMBOL[plan.currency as Currency]}${Number(plan.perStudentRate).toFixed(4)}/student` : ''}
                      {plan.baseFee ? `${CURRENCY_SYMBOL[plan.currency as Currency]}${Number(plan.baseFee).toFixed(2)}/cycle` : ''}
                    </td>
                    <td className="py-3">
                      {selectedPlanId === plan.id && (
                        <span className="text-xs text-blue-600 font-medium">Selected ?</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Create Plan Form */}
        <div className="col-span-2 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
          <h2 className="font-semibold text-gray-900">Create New Plan</h2>

          {/* Model selector */}
          <div className="grid grid-cols-3 gap-3">
            {MODELS.map((m) => (
              <button
                key={m.type}
                onClick={() => set('model', m.type)}
                className={`rounded-xl border-2 p-3 text-left transition-all ${
                  form.model === m.type ? m.color + ' border-current' : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="font-semibold text-sm">{m.label}</div>
                <div className="text-xs text-gray-500 mt-1 leading-tight">{m.description}</div>
              </button>
            ))}
          </div>

          {/* Basic fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Plan Name</label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Growth Monthly IN"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tier</label>
              <select value={form.tier} onChange={(e) => set('tier', e.target.value as SubscriptionTier)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Currency</label>
              <select value={form.currency} onChange={(e) => set('currency', e.target.value as Currency)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Region</label>
              <select value={form.region} onChange={(e) => set('region', e.target.value as Region)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Billing Cycle (months)</label>
              <input type="number" min={1} value={form.billingCycleMonths}
                onChange={(e) => set('billingCycleMonths', Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <p className="text-xs text-gray-400 mt-1">1 = monthly, 12 = annual</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Trial Days</label>
              <input type="number" min={0} value={form.trialDays}
                onChange={(e) => set('trialDays', Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Model-specific fields */}
          <div className="border-t border-gray-100 pt-4 space-y-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {activeModel.label} Settings
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {(form.model === 'PER_STUDENT' || form.model === 'HYBRID') && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Per Student Rate ({sym})
                  </label>
                  <input type="number" step="0.0001"
                    value={form.perStudentRate ?? ''}
                    onChange={(e) => set('perStudentRate', e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="e.g. 2.5000"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
              {(form.model === 'SUBSCRIPTION' || form.model === 'HYBRID') && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Base Fee ({sym})
                  </label>
                  <input type="number" step="0.01"
                    value={form.baseFee ?? ''}
                    onChange={(e) => set('baseFee', e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="e.g. 499.00"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
              {(form.model === 'SUBSCRIPTION' || form.model === 'HYBRID') && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Student Limit</label>
                  <input type="number"
                    value={form.studentLimit ?? ''}
                    onChange={(e) => set('studentLimit', e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="Leave blank for unlimited"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
              {form.model === 'HYBRID' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Overage Rate ({sym})</label>
                    <input type="number" step="0.0001"
                      value={form.overageRate ?? ''}
                      onChange={(e) => set('overageRate', e.target.value ? Number(e.target.value) : undefined)}
                      placeholder="Per extra student"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <input type="checkbox" id="overageEnabled" checked={form.overageEnabled}
                      onChange={(e) => set('overageEnabled', e.target.checked)} className="rounded" />
                    <label htmlFor="overageEnabled" className="text-sm text-gray-700">Enable overage billing</label>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="prorate" checked={form.prorateEnabled}
                onChange={(e) => set('prorateEnabled', e.target.checked)} className="rounded" />
              <label htmlFor="prorate" className="text-sm text-gray-700">Enable proration</label>
            </div>
          </div>

          {/* Features */}
          <div className="border-t border-gray-100 pt-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Features
            </label>
            <div className="flex gap-2 mb-2">
              <input value={featureInput} onChange={(e) => setFeatureInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addFeature()}
                placeholder="e.g. Unlimited branches"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={addFeature}
                className="px-3 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 font-medium">
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(form.features ?? []).map((f, i) => (
                <span key={i} className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full">
                  {f}
                  <button onClick={() => removeFeature(i)} className="hover:text-blue-900">?</button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setForm(defaultForm())}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
              Reset
            </button>
            <button
              onClick={() => createPlan.mutate(form)}
              disabled={!form.name || createPlan.isLoading}
              className="px-4 py-2 text-sm text-white bg-gray-900 rounded-lg hover:bg-gray-700 font-medium disabled:opacity-40">
              {createPlan.isLoading ? 'Saving...' : 'Create Plan'}
            </button>
          </div>
        </div>

        {/* Bill Preview */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-900">Bill Preview</h2>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Student count</label>
            <input type="number" value={previewStudents}
              onChange={(e) => setPreviewStudents(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Custom per-student rate (optional)</label>
            <input type="number" step="0.0001" value={customPerStudentRate}
              onChange={(e) => setCustomPerStudentRate(e.target.value)}
              placeholder="Override for enterprise"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Custom base fee (optional)</label>
            <input type="number" step="0.01" value={customBaseFee}
              onChange={(e) => setCustomBaseFee(e.target.value)}
              placeholder="Override for enterprise"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="border-t border-gray-100 pt-4">
            <BillPreview
              planId={selectedPlanId}
              studentCount={previewStudents}
              customPerStudentRate={customPerStudentRate ? Number(customPerStudentRate) : undefined}
              customBaseFee={customBaseFee ? Number(customBaseFee) : undefined}
            />
          </div>
          {!selectedPlanId && plans && plans.length > 0 && (
            <p className="text-xs text-gray-400">? Click a plan in the table to preview its bill</p>
          )}
        </div>
      </div>
    </div>
  );
}
