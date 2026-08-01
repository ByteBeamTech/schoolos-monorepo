// modules/student-billing/refund/refund-status.util.spec.ts
import { Prisma } from '@prisma/client';
import { refundedAmountFor, derivePaymentRefundState } from './refund-status.util';

describe('refundedAmountFor', () => {
  it('sums PENDING and COMPLETED refunds', () => {
    const total = refundedAmountFor([
      { status: 'PENDING', amount: 100 },
      { status: 'COMPLETED', amount: 250 },
    ]);
    expect(total.toNumber()).toBe(350);
  });

  it('excludes FAILED refunds -- no money moved', () => {
    const total = refundedAmountFor([
      { status: 'COMPLETED', amount: 100 },
      { status: 'FAILED', amount: 500 },
    ]);
    expect(total.toNumber()).toBe(100);
  });

  it('returns zero for no refunds', () => {
    expect(refundedAmountFor([]).toNumber()).toBe(0);
  });
});

describe('derivePaymentRefundState', () => {
  it('NONE when nothing has been refunded', () => {
    const state = derivePaymentRefundState({ amount: 1000 }, new Prisma.Decimal(0));
    expect(state).toBe('NONE');
  });

  it('PARTIAL when refunded amount is less than the payment amount', () => {
    const state = derivePaymentRefundState({ amount: 1000 }, new Prisma.Decimal(400));
    expect(state).toBe('PARTIAL');
  });

  it('FULL when refunded amount equals the payment amount exactly', () => {
    const state = derivePaymentRefundState({ amount: 1000 }, new Prisma.Decimal(1000));
    expect(state).toBe('FULL');
  });

  it('FULL when refunded amount exceeds the payment amount (defensive -- should not happen given invariant 3, but never mis-derives to PARTIAL)', () => {
    const state = derivePaymentRefundState({ amount: 1000 }, new Prisma.Decimal(1001));
    expect(state).toBe('FULL');
  });

  it('is built from the SAME refundedAmountFor() a caller would compute -- consistent by construction', () => {
    const refunds = [{ status: 'COMPLETED', amount: 1000 }];
    const state = derivePaymentRefundState({ amount: 1000 }, refundedAmountFor(refunds));
    expect(state).toBe('FULL');
  });
});
