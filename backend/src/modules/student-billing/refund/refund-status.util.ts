// modules/student-billing/refund/refund-status.util.ts
//
// M6 (redesigned roadmap, D-3/D-4): refund state derived from a payment's
// Refund records, never persisted on Payment.status. This is the exact
// mechanism behind the defect M2 corrected -- writing REFUNDED/
// PARTIALLY_REFUNDED independently of the Refund rows let the two
// disagree. PaymentStatus no longer HAS those values (see the enum
// narrowing migration) -- unlike overdue.util.ts's transitional
// compatibility path for OVERDUE (M5), no such accommodation is needed
// here: the migration hard-backfilled every existing row and narrowed the
// enum in the same change, so no row can structurally carry the removed
// values anymore. There is nothing to stay compatible with.

import { Prisma } from '@prisma/client';

// Refund statuses that have already committed money and therefore count
// toward how much of a payment has been refunded. RefundStatus is
// PENDING | COMPLETED | FAILED; FAILED is excluded -- no money moved.
// Single source of truth: refund.service.ts previously defined this
// locally; moved here so the derivation functions below and the
// reservation-guard logic in refund.service.ts share one definition.
export const CONSUMING_REFUND_STATUSES = ['PENDING', 'COMPLETED'] as const;

/**
 * Sum of a payment's refunds that have committed money (PENDING +
 * COMPLETED). The single computation every derivation below is built from,
 * so they can never disagree with each other.
 */
export function refundedAmountFor(
  refunds: { status: string; amount: Prisma.Decimal | number | string }[],
): Prisma.Decimal {
  return refunds
    .filter((r) => (CONSUMING_REFUND_STATUSES as readonly string[]).includes(r.status))
    .reduce((sum, r) => sum.plus(new Prisma.Decimal(r.amount)), new Prisma.Decimal(0));
}

export type PaymentRefundState = 'NONE' | 'PARTIAL' | 'FULL';

/**
 * Per-payment derived state, for API response shaping and UI-facing
 * display (replaces the removed PaymentStatus.REFUNDED/PARTIALLY_REFUNDED
 * values). Built from the same refundedAmountFor() as the reservation
 * guard in refund.service.ts, so a payment can never simultaneously pass
 * "still refundable" there and report FULL here.
 */
export function derivePaymentRefundState(
  payment: { amount: Prisma.Decimal | number | string },
  refundedAmount: Prisma.Decimal,
): PaymentRefundState {
  if (refundedAmount.lessThanOrEqualTo(0)) return 'NONE';
  if (refundedAmount.greaterThanOrEqualTo(new Prisma.Decimal(payment.amount))) return 'FULL';
  return 'PARTIAL';
}
