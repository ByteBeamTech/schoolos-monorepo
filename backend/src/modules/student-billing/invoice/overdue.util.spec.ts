// modules/student-billing/invoice/overdue.util.spec.ts
import { overdueWhere, isInvoiceOverdue, OVERDUE_STATUS_MATCH } from './overdue.util';

describe('overdueWhere', () => {
  it('matches the exported OVERDUE_STATUS_MATCH set, with a dueDate-before-now filter', () => {
    const now = new Date('2026-06-01');
    const w = overdueWhere(now);

    // Compared against the shared export, not a duplicated literal -- if
    // the status set ever changes (e.g. the legacy flag in overdue.util.ts
    // is flipped), this test updates automatically instead of needing a
    // separate edit here and in every other spec that checks this shape.
    expect(w.status.in).toEqual(OVERDUE_STATUS_MATCH);
    expect(w.dueDate).toEqual({ lt: now });
  });

  it('defaults to the current time when none is supplied', () => {
    const before = Date.now();
    const w = overdueWhere();
    const after = Date.now();

    const lt = (w.dueDate as any).lt as Date;
    expect(lt.getTime()).toBeGreaterThanOrEqual(before);
    expect(lt.getTime()).toBeLessThanOrEqual(after);
  });
});

describe('isInvoiceOverdue', () => {
  const now = new Date('2026-06-15');

  it('is true for a SENT invoice past its due date', () => {
    expect(isInvoiceOverdue({ status: 'SENT', dueDate: new Date('2026-06-01') }, now)).toBe(true);
  });

  it('is true for a PARTIALLY_PAID invoice past its due date', () => {
    expect(isInvoiceOverdue({ status: 'PARTIALLY_PAID', dueDate: new Date('2026-06-01') }, now)).toBe(true);
  });

  // M5's transitional compatibility path (temporary -- see
  // LEGACY_OVERDUE_STATUSES and the TODO(remove after legacy backfill) in
  // overdue.util.ts): a row still carrying the old persisted OVERDUE value
  // (written before this milestone, or not yet backfilled) must still read
  // as overdue -- it must not vanish from any UI/report just because
  // nothing writes that value anymore. This is NOT part of the long-term
  // rule (PERMANENT_OVERDUE_STATUSES); it exists only until cleanup, which
  // happens after backfill, not within M5 itself.
  it('is true for a legacy invoice still carrying status OVERDUE (transitional compatibility, temporary)', () => {
    expect(isInvoiceOverdue({ status: 'OVERDUE', dueDate: new Date('2026-06-01') }, now)).toBe(true);
  });

  it('is false for a SENT invoice not yet due', () => {
    expect(isInvoiceOverdue({ status: 'SENT', dueDate: new Date('2026-07-01') }, now)).toBe(false);
  });

  it('is false for a PAID invoice past what was its due date', () => {
    expect(isInvoiceOverdue({ status: 'PAID', dueDate: new Date('2026-06-01') }, now)).toBe(false);
  });

  it('is false for a CANCELLED invoice past what was its due date', () => {
    expect(isInvoiceOverdue({ status: 'CANCELLED', dueDate: new Date('2026-06-01') }, now)).toBe(false);
  });

  it('is false when dueDate is null', () => {
    expect(isInvoiceOverdue({ status: 'SENT', dueDate: null }, now)).toBe(false);
  });

  it('accepts a string-typed dueDate (as Prisma may serialize it)', () => {
    expect(isInvoiceOverdue({ status: 'SENT', dueDate: '2026-06-01T00:00:00.000Z' }, now)).toBe(true);
  });
});
