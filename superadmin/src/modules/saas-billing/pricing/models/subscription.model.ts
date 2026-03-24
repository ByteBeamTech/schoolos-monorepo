import type { PricingPlan, PricingCalculationResult } from '@schoolos/api-contracts/pricing';
import { getBillingCycleLabel, getAnnualDiscountRate } from '@schoolos/api-contracts/pricing';

/**
 * SUBSCRIPTION model
 *
 * Flat baseFee per billing cycle.
 * Enforces studentLimit if set on the plan.
 * Supports customBaseFee override for enterprise deals.
 */
export class SubscriptionModel {
  constructor(
    private readonly plan: PricingPlan,
    private readonly customBaseFee?: number,
  ) {}

  calculate(studentCount: number, taxPercent = 0): PricingCalculationResult {
    const { currency, billingCycleMonths, baseFee, studentLimit, name } = this.plan;

    // Guard: student count within plan limits
    if (studentLimit && studentCount > studentLimit) {
      throw new Error(
        `Student count ${studentCount} exceeds plan limit of ${studentLimit} for "${name}"`,
      );
    }

    const fee = this.customBaseFee ?? Number(baseFee ?? 0);
    const isCustomRates = this.customBaseFee !== undefined;

    const breakdown: PricingCalculationResult['breakdown'] = [
      {
        label: `${name} (${getBillingCycleLabel(billingCycleMonths)})${isCustomRates ? ' — custom fee' : ''}`,
        amount: fee,
      },
    ];

    // Annual discount
    const discountRate = getAnnualDiscountRate(billingCycleMonths);
    const discountAmount = fee * discountRate;
    if (discountAmount > 0) {
      breakdown.push({
        label: `Annual discount (${(discountRate * 100).toFixed(0)}%)`,
        amount: -discountAmount,
      });
    }

    const afterDiscount = fee - discountAmount;
    const taxAmount = afterDiscount * (taxPercent / 100);
    if (taxPercent > 0) {
      breakdown.push({ label: `Tax (${taxPercent}%)`, amount: taxAmount });
    }

    const total = afterDiscount + taxAmount;

    return {
      model: 'SUBSCRIPTION',
      currency,
      billingCycleMonths,
      billingCycleLabel: getBillingCycleLabel(billingCycleMonths),
      subtotal: fee,
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