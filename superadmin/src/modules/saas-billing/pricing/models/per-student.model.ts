import type { PricingPlan, PricingCalculationResult } from '@schoolos/api-contracts/pricing';
import { getBillingCycleLabel, getAnnualDiscountRate } from '@schoolos/api-contracts/pricing';

/**
 * PER_STUDENT model
 *
 * Uses PricingPlan.perStudentRate as the base rate.
 * Supports custom rate override for ENTERPRISE deals via customPerStudentRate.
 * Applies annual discount automatically for billingCycleMonths === 12.
 */
export class PerStudentModel {
  constructor(
    private readonly plan: PricingPlan,
    private readonly customPerStudentRate?: number,
  ) {}

  calculate(studentCount: number, taxPercent = 0): PricingCalculationResult {
    const { currency, billingCycleMonths, perStudentRate } = this.plan;

    const rate = this.customPerStudentRate ?? Number(perStudentRate ?? 0);
    const isCustomRates = this.customPerStudentRate !== undefined;

    let subtotal = rate * studentCount;

    const breakdown: PricingCalculationResult['breakdown'] = [
      {
        label: `${studentCount} students × ${currency} ${rate.toFixed(4)}${isCustomRates ? ' (custom rate)' : ''}`,
        amount: subtotal,
      },
    ];

    // Annual discount
    const discountRate = getAnnualDiscountRate(billingCycleMonths);
    const discountAmount = subtotal * discountRate;
    if (discountAmount > 0) {
      breakdown.push({
        label: `Annual discount (${(discountRate * 100).toFixed(0)}%)`,
        amount: -discountAmount,
      });
    }

    const afterDiscount = subtotal - discountAmount;
    const taxAmount = afterDiscount * (taxPercent / 100);
    if (taxPercent > 0) {
      breakdown.push({ label: `Tax (${taxPercent}%)`, amount: taxAmount });
    }

    const total = afterDiscount + taxAmount;

    return {
      model: 'PER_STUDENT',
      currency,
      billingCycleMonths,
      billingCycleLabel: getBillingCycleLabel(billingCycleMonths),
      subtotal,
      discountAmount,
      taxAmount,
      total,
      breakdown,
      studentCount,
      effectivePricePerStudent: studentCount > 0 ? total / studentCount : 0,
      isCustomRates,
    };
  }
}