// frontend/src/lib/billing/discount-options.ts
//
// Mirrors backend/src/modules/student-billing/dto/billing.dto.ts's
// DiscountCategory/DiscountType enums. Extracted here rather than
// hardcoded per-page (was previously duplicated inline in
// billing/discounts/page.tsx before discount creation moved to the
// Student Financial Profile, per FDD FR-DISC-02).

export const DISCOUNT_CATEGORIES = [
  "SIBLING", "MERIT", "STAFF_CHILD", "FINANCIAL_HARDSHIP", "SCHOLARSHIP", "CUSTOM",
] as const;

export const DISCOUNT_TYPES = ["PERCENTAGE", "FIXED"] as const;

export function formatDiscountValue(type: string, value: number): string {
  return type === "PERCENTAGE" ? `${value}%` : `₹${value.toLocaleString("en-IN")}`;
}
