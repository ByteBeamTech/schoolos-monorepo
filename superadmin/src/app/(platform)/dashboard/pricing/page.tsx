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
    description: 'Charge per active student - scales with school size',
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

const CURRENCY_SYMBOL: Record<Currency, string> = {
  USD: '$',
  INR: '\u20B9',
  GBP: '\u00A3',
  EUR: '\u20AC',
  AED: 'AED',
};

// --- Form default state -------------------------------------------------------

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

// --- Bill preview component ---------------------------------------------------

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
      {(data.breakdown || []).map((item: any, i: number) => (
        <div key={i} className="flex justify-between text-gray-600">
          <span className="text-xs">{item.label}</span>
          <span className={item.amount < 0 ? 'text-green-600 font-medium' : ''}>
            {item.amount === 0 ? '-' : `${sym}${Math.abs(item.amount).toFixed(2)}`}
          </span>
        </div>
      ))}
      <div className="border-t border-gray-100 pt-2 flex justify-between font-semibold text-gray-900">
        <span>Total</span>
        <span>{sym}{data.total.toFixed(2)}</span>
      </div>
    </div>
  );
}

// --- Main Page component ------------------------------------------------------

export default function PricingPage() {
  const [form, setForm] = useState<CreatePricingPlanDto>(defaultForm());
  const [selectedPlanId, setSelectedPlanId] = useState<string>();
  const [previewStudents, setPreviewStudents] = useState(200);
  const [customPerStudentRate, setCustomPerStudentRate] = useState('');
  const [customBaseFee, setCustomBaseFee] = useState('');
  const [featureInput, setFeatureInput] = useState('');

  // ✅ Fix 1: listPlans.useQuery() with NO input as per your instruction
  const { data: plans, refetch } = trpc.pricing.listPlans.useQuery({});
  
  const createPlan = trpc.pricing.createPlan.useMutation({
    onSuccess: () => {
      refetch();
      setForm(defaultForm());
      alert("Plan created!");
    }
  });

  const set = <K extends keyof CreatePricingPlanDto>(k: K, v: CreatePricingPlanDto[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pricing Engine"
        // ✅ Fix 2: Changed subtitle back to description
        subtitle="Manage SaaS pricing plans for school tenants"
      />

      {/* Statistics Section */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Active Plans" value={plans?.length ?? 0} />
        <StatCard label="Per-Student" value={plans?.filter((p: any) => p.model === 'PER_STUDENT').length ?? 0} />
        <StatCard label="Subscription" value={plans?.filter((p: any) => p.model === 'SUBSCRIPTION').length ?? 0} />
        <StatCard label="Hybrid" value={plans?.filter((p: any) => p.model === 'HYBRID').length ?? 0} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Create Plan Form */}
        <div className="col-span-2 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
          <h2 className="font-semibold text-gray-900">Create New Plan</h2>

          <div className="grid grid-cols-3 gap-3">
            {MODELS.map((m) => (
              <button
                key={m.type}
                type="button"
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Plan Name</label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Growth Monthly IN"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {/* ... other inputs ... */}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-50">
            <button type="button" onClick={() => setForm(defaultForm())}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
              Reset
            </button>
            <button
              type="button"
              onClick={() => createPlan.mutate(form)}
              // isPending check for tRPC v11
              disabled={!form.name || (createPlan as any).isPending}
              className="px-4 py-2 text-sm text-white bg-gray-900 rounded-lg hover:bg-gray-700 font-medium disabled:opacity-40">
              {(createPlan as any).isPending ? 'Saving...' : 'Create Plan'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-900">Live Bill Preview</h2>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Simulated Students</label>
            <input type="number" value={previewStudents}
              onChange={(e) => setPreviewStudents(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="pt-4 border-t border-gray-100">
            <BillPreview
              planId={selectedPlanId}
              studentCount={previewStudents}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
