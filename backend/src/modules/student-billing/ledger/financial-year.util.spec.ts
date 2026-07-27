// backend/src/modules/student-billing/ledger/financial-year.util.spec.ts
import { financialYearFor } from './financial-year.util';

describe('financialYearFor', () => {
  it('31 March belongs to the PREVIOUS calendar year\'s FY', () => {
    expect(financialYearFor(new Date('2026-03-31T23:59:59Z'))).toBe(2025);
  });

  it('1 April rolls the FY over to the current calendar year', () => {
    expect(financialYearFor(new Date('2026-04-01T00:00:00Z'))).toBe(2026);
  });

  it('31 December stays within the same FY as 1 April', () => {
    expect(financialYearFor(new Date('2026-12-31T23:59:59Z'))).toBe(2026);
  });

  it('1 January still belongs to the FY that started the PREVIOUS April', () => {
    expect(financialYearFor(new Date('2027-01-01T00:00:00Z'))).toBe(2026);
  });

  // The exact bug this function exists to prevent: naive getFullYear() would
  // return 2027 here, not 2026.
  it('is never derived from getFullYear() alone', () => {
    const january = new Date('2027-01-15T00:00:00Z');
    expect(financialYearFor(january)).not.toBe(january.getUTCFullYear());
    expect(financialYearFor(january)).toBe(january.getUTCFullYear() - 1);
  });
});
