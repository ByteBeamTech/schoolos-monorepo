import type { PricingPlan, PricingCalculationResult } from '@schoolos/api-contracts/pricing';
import { getBillingCycleLabel, getAnnualDiscountRate } from '@schoolos/api-contracts/pricing';

/**
 * HYBRID model
 *
 * baseFee (flat) + perStudentRate × overage students beyond studentLimit.
 * overageEnabled must be true on the plan for overage to apply.
 * Supports customBaseFee and customPerStudentRate overrides.
 */
export class HybridModel {
  constructor(
    private readonly plan: PricingPlan,
    private readonly customBaseFee?: number,
    private readonly customPerStudentRate?: number,
  ) {}

  calculate(studentCount: number, taxPercent = 0): PricingCalculationResult {
    const {
      currency,
      billingCycleMonths,
      baseFee,
      studentLimit,
      overageRate,
      overageEnabled,
      perStudentRate,
      name,
    } = this.plan;

    const fee = this.customBaseFee ?? Number(baseFee ?? 0);
    const effectiveOverageRate =
      this.customPerStudentRate ?? Number(overageRate ?? perStudentRate ?? 0);
    const includedStudents = studentLimit ?? 0;
    const isCustomRates = this.customBaseFee !== undefined || this.customPerStudentRate !== undefined;

    const breakdown: PricingCalculationResult['breakdown'] = [
      {
        label: `${name} base plan (${getBillingCycleLabel(billingCycleMonths)})${isCustomRates ? ' — custom fee' : ''}`,
        amount: fee,
      },
    ];

    // Overage
    let overageAmount = 0;
    if (overageEnabled && studentCount > includedStudents) {
      const overageStudents = studentCount - includedStudents;
      overageAmount = overageStudents * effectiveOverageRate;
      breakdown.push({
        label: `${overageStudents} overage students × ${currency} ${effectiveOverageRate.toFixed(4)}`,
        amount: overageAmount,
      });
    } else {
      breakdown.push({
        label: `${studentCount}/${includedStudents || '8'} included students`,
        amount: 0,
      });
    }

    let subtotal = fee + overageAmount;

    // Annual discount on total
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
      model: 'HYBRID',
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