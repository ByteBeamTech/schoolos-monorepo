// backend/src/modules/student-billing/plans/utils/billing-period.util.spec.ts

import { calculateBillingPeriods } from './billing-period.util';

describe('calculateBillingPeriods — pure runtime calculation, no table', () => {
  // April-start session, matching the Indian academic year convention
  // used throughout every example in this design.
  const session = { startDate: new Date(2026, 3, 1) }; // April 1, 2026

  it('ONE_TIME: exactly one period, no thirteenth row ever appears', () => {
    const periods = calculateBillingPeriods(session, { billingMonths: [4], dueDayOfMonth: 10 });
    expect(periods).toHaveLength(1);
    expect(periods[0]).toEqual({
      periodLabel: 'April 2026', periodMonth: 4, periodYear: 2026, dueDate: new Date(2026, 3, 10),
    });
  });

  it('MONTHLY: 12 periods for a full April-March session, correctly spanning both calendar years', () => {
    const periods = calculateBillingPeriods(session, {
      billingMonths: [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3], dueDayOfMonth: 5,
    });
    expect(periods).toHaveLength(12);
    expect(periods[0]).toMatchObject({ periodLabel: 'April 2026', periodYear: 2026 });
    expect(periods[11]).toMatchObject({ periodLabel: 'March 2027', periodYear: 2027 });
  });

  it('QUARTERLY: 4 periods, session-anchored (Apr/Jul/Oct/Jan), not calendar-quarter-anchored', () => {
    const periods = calculateBillingPeriods(session, { billingMonths: [4, 7, 10, 1], dueDayOfMonth: 5 });
    expect(periods.map((p) => p.periodLabel)).toEqual(['April 2026', 'July 2026', 'October 2026', 'January 2027']);
  });

  it('HALF_YEARLY: 2 periods', () => {
    const periods = calculateBillingPeriods(session, { billingMonths: [4, 10], dueDayOfMonth: 5 });
    expect(periods.map((p) => p.periodLabel)).toEqual(['April 2026', 'October 2026']);
  });

  it('ANNUAL: 1 period', () => {
    const periods = calculateBillingPeriods(session, { billingMonths: [4], dueDayOfMonth: 1 });
    expect(periods).toHaveLength(1);
  });

  it('CUSTOM: an arbitrary, non-evenly-spaced list produces exactly the months specified, nothing inferred', () => {
    const periods = calculateBillingPeriods(session, { billingMonths: [6, 12], dueDayOfMonth: 15 });
    expect(periods.map((p) => p.periodLabel)).toEqual(['June 2026', 'December 2026']);
  });

  it('December -> January session boundary resolves to the correct following calendar year', () => {
    const periods = calculateBillingPeriods(session, { billingMonths: [12, 1], dueDayOfMonth: 5 });
    expect(periods[0]).toMatchObject({ periodMonth: 12, periodYear: 2026 });
    expect(periods[1]).toMatchObject({ periodMonth: 1, periodYear: 2027 });
  });

  it('invalid day-of-month (31st in a 30-day month) clamps to that month\'s real last day, never throws', () => {
    const periods = calculateBillingPeriods(session, { billingMonths: [4], dueDayOfMonth: 31 }); // April has 30 days
    expect(periods[0].dueDate).toEqual(new Date(2026, 3, 30));
  });

  it('invalid day-of-month (30th in February) clamps to February\'s real last day', () => {
    const periods = calculateBillingPeriods(session, { billingMonths: [2], dueDayOfMonth: 30 });
    expect(periods[0].dueDate).toEqual(new Date(2027, 1, 28)); // 2027 is not a leap year
  });

  it('is deterministic -- identical inputs always produce an identical result, called repeatedly', () => {
    const rule = { billingMonths: [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3], dueDayOfMonth: 5 };
    const first  = calculateBillingPeriods(session, rule);
    const second = calculateBillingPeriods(session, rule);
    expect(first).toEqual(second);
  });
});
