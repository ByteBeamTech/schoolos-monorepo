// backend/src/modules/student-billing/plans/utils/billing-period.util.ts
//
// Phase 3 (frozen): billing periods are NOT a database table. This is the
// entire implementation of "Billing Period" -- a pure function over
// AcademicSession + BillingRule, computed fresh wherever it's needed,
// never persisted, never regenerated (there's nothing stored to
// regenerate). Same inputs always produce the same output -- no I/O, no
// randomness, no mutable state.

export interface BillingPeriodRef {
  periodLabel: string; // e.g. "April 2026"
  periodMonth: number; // 1-12, calendar month
  periodYear: number;  // calendar year this occurrence actually falls in
  dueDate: Date;
}

export interface BillingRuleLike {
  billingMonths: number[]; // 1-12, e.g. [4,5,6,7,8,9,10,11,12,1,2,3] for monthly
  dueDayOfMonth: number;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Phase 4 addition: extracted so BillingRunService.trigger() can compute
 * a periodLabel from an operator-supplied (periodMonth, periodYear) pair
 * WITHOUT needing any BillingRule -- a run's target period is a calendar
 * fact, independent of any one student's resolved plan/rule. This is
 * what breaks the chicken-and-egg problem calculateBillingPeriods()
 * alone would otherwise create: computing "which month" requires a rule
 * per Phase 3's original design, but a BillingRun doesn't know any
 * student's rule until it resolves their plan, per-student, during
 * execution.
 */
export function formatPeriodLabel(month: number, year: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/**
 * The calendar YEAR a given month falls in, relative to a session's start.
 * A session starting in April (month 4): months 4-12 fall in the start
 * year; months 1-3 fall in the start year + 1. This is what makes the
 * December -> January session-boundary case resolve correctly without
 * any special-casing at the call site.
 */
function resolveYearForMonth(sessionStartMonth: number, sessionStartYear: number, month: number): number {
  return month >= sessionStartMonth ? sessionStartYear : sessionStartYear + 1;
}

/**
 * Clamps a requested day-of-month to the last real day of that month --
 * dueDayOfMonth=31 in a 30-day month, or =30 in February, resolves to
 * that month's actual last day rather than throwing or producing an
 * invalid date (new Date(2026, 1, 30) would silently roll over into
 * March otherwise).
 */
export function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate(); // month is 1-indexed here; JS Date's day-0-of-next-month trick
}

/**
 * Deterministic: identical (session, rule) input always produces an
 * identical output array, in every environment, every time. No frequency
 * branching needed -- billingMonths already fully specifies which months
 * occur (Phase 2's own design decision, closing the ambiguity a rigid
 * frequency-only enum would have had for e.g. "quarterly" anchored to a
 * calendar quarter vs. a session-relative one).
 */
export function calculateBillingPeriods(
  session: { startDate: Date },
  rule: BillingRuleLike,
): BillingPeriodRef[] {
  const sessionStartMonth = session.startDate.getMonth() + 1; // JS Date months are 0-indexed
  const sessionStartYear  = session.startDate.getFullYear();

  return rule.billingMonths.map((month) => {
    const year = resolveYearForMonth(sessionStartMonth, sessionStartYear, month);
    const day  = Math.min(rule.dueDayOfMonth, lastDayOfMonth(year, month));
    return {
      periodLabel: formatPeriodLabel(month, year),
      periodMonth: month,
      periodYear:  year,
      dueDate:     new Date(year, month - 1, day),
    };
  });
}
