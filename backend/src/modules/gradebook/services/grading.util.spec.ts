// backend/src/modules/gradebook/services/grading.util.spec.ts
//
// Covers the single canonical grade-from-percentage computation function
// introduced per GRADEBOOK_ARCHITECTURE_FREEZE_v1.0.md §3.5. This function
// is now the sole grading implementation consumed by GradebookService,
// ReportCardService, and ExaminationsService — no module implements its
// own grading logic or hardcoded scale.

import { computeGrade, GradeBoundaryLike } from './grading.util';

describe('computeGrade', () => {
  const boundaries: GradeBoundaryLike[] = [
    { minMark: 90, maxMark: 100, grade: 'A+' },
    { minMark: 80, maxMark: 89.99, grade: 'A' },
    { minMark: 70, maxMark: 79.99, grade: 'B+' },
    { minMark: 60, maxMark: 69.99, grade: 'B' },
    { minMark: 50, maxMark: 59.99, grade: 'C' },
    { minMark: 40, maxMark: 49.99, grade: 'D' },
    { minMark: 0, maxMark: 39.99, grade: 'F' },
  ];

  it('returns the matching grade for a percentage within a boundary', () => {
    expect(computeGrade(95, boundaries)).toBe('A+');
    expect(computeGrade(85, boundaries)).toBe('A');
    expect(computeGrade(45, boundaries)).toBe('D');
    expect(computeGrade(0, boundaries)).toBe('F');
  });

  it('is independent of the order boundaries are supplied in', () => {
    const shuffled = [...boundaries].reverse();
    expect(computeGrade(72, shuffled)).toBe('B+');
    expect(computeGrade(72, boundaries)).toBe('B+');
  });

  it('matches at exact boundary edges (inclusive minMark and maxMark)', () => {
    expect(computeGrade(90, boundaries)).toBe('A+');
    expect(computeGrade(89.99, boundaries)).toBe('A');
    expect(computeGrade(40, boundaries)).toBe('D');
    expect(computeGrade(39.99, boundaries)).toBe('F');
  });

  it('returns N/A when no configured boundary covers the percentage', () => {
    // Deliberate gap: nothing configured between 40 and 60.
    const gappedBoundaries: GradeBoundaryLike[] = [
      { minMark: 60, maxMark: 100, grade: 'PASS' },
    ];
    expect(computeGrade(50, gappedBoundaries)).toBe('N/A');
  });

  it('returns N/A when no boundaries are configured at all (no hardcoded fallback scale)', () => {
    // Architecture freeze §3.5: "No module SHALL implement its own grading
    // logic or hardcoded grade scale." An empty boundary set must never
    // silently fall back to a built-in scale.
    expect(computeGrade(95, [])).toBe('N/A');
    expect(computeGrade(10, [])).toBe('N/A');
  });

  it('accepts Prisma Decimal-like values (objects with toNumber())', () => {
    const decimalLike = (n: number) => ({ toNumber: () => n, toString: () => String(n) });
    const decimalBoundaries: GradeBoundaryLike[] = [
      { minMark: decimalLike(90), maxMark: decimalLike(100), grade: 'A+' },
      { minMark: decimalLike(0), maxMark: decimalLike(89.99), grade: 'B' },
    ];
    expect(computeGrade(95, decimalBoundaries)).toBe('A+');
    expect(computeGrade(55, decimalBoundaries)).toBe('B');
  });

  it('resolves overlapping boundaries by preferring the highest minMark', () => {
    const overlapping: GradeBoundaryLike[] = [
      { minMark: 75, maxMark: 100, grade: 'DISTINCTION' },
      { minMark: 50, maxMark: 100, grade: 'PASS' },
    ];
    expect(computeGrade(80, overlapping)).toBe('DISTINCTION');
  });
});
