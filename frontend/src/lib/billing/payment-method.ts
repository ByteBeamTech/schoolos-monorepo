// frontend/src/lib/billing/payment-method.ts
//
// FDD Section 8.2: Cash, UPI, Card, Instant Bank Transfer -- exactly these
// four. Mirrors backend/src/modules/student-billing/dto/billing.dto.ts's
// OfflinePaymentMethod enum precisely. If that enum ever changes, this is
// the one place on the frontend that needs to change with it.

export type OfflinePaymentMethod = "CASH" | "UPI" | "CARD" | "INSTANT_BANK_TRANSFER";

export const PAYMENT_METHODS: { value: OfflinePaymentMethod; label: string; needsReference: boolean }[] = [
  { value: "CASH",                  label: "Cash",                needsReference: false },
  { value: "UPI",                   label: "UPI",                 needsReference: true },
  { value: "CARD",                  label: "Card",                needsReference: true },
  { value: "INSTANT_BANK_TRANSFER", label: "Instant Bank Transfer", needsReference: true },
];
