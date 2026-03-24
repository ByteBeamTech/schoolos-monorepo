import type { PricingPlan, PricingCalculationResult } from '@schoolos/api-contracts/pricing';
import { getBillingCycleLabel } from '@schoolos/api-contracts/pricing';

/**
 * CUSTOM RATES model (Enterprise deals)
 *
 * Not a separate PricingModel enum value — this wraps any existing plan
 * (PER_STUDENT, SUBSCRIPTION, or HYBRID) and applies custom rate overrides
 * stored in TenantSubscription.customPerStudentRate / customBaseFee.
 *
 * This maps to your schema's customPerStudentRate + customBaseFee fields
 * on TenantSubscription rather than a separate PricingModel enum entry.
 */
export class CustomRatesModel {
  constructor(
    private readonly plan: PricingPlan,
    private readonly overrides: {
      customPerStudentRate?: number;
      customBaseFee?: number;
      notes?: string;
    },
  ) {}

  calculate(studentCount: number, taxPercent = 0): PricingCalculationResult {
    const { currency, billingCycleMonths, model } = this.plan;
    const { customPerStudentRate, customBaseFee, notes } = this.overrides;

    const breakdown: PricingCalculationResult['breakdown'] = [];
    let subtotal = 0;

    if (customBaseFee !== undefined) {
      subtotal += customBaseFee;
      breakdown.push({
        label: `Custom base fee (${this.plan.name})`,
        amount: customBaseFee,
      });
    }

    if (customPerStudentRate !== undefined && studentCount > 0) {
      const perStudentTotal = customPerStudentRate * studentCount;
      subtotal += perStudentTotal;
      breakdown.push({
        label: `${studentCount} students × ${currency} ${customPerStudentRate.toFixed(4)} (custom rate)`,
        amount: perStudentTotal,
      });
    }

    if (notes) {
      breakdown.push({ label: `Note: ${notes}`, amount: 0 });
    }

    const taxAmount = subtotal * (taxPercent / 100);
    if (taxPercent > 0) {
      breakdown.push({ label: `Tax (${taxPercent}%)`, amount: taxAmount });
    }

    const total = subtotal + taxAmount;

    return {
      model,
      currency,
      billingCycleMonths,
      billingCycleLabel: getBillingCycleLabel(billingCycleMonths),
      subtotal,
      discountAmount: 0,
      taxAmount,
      total,
      breakdown,
      studentCount,
      effectivePricePerStudent: studentCount > 0 ? total / studentCount : 0,
      isCustomRates: true,
    };
  }
}