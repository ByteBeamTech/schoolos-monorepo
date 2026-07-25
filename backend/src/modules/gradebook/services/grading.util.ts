// ─────────────────────────────────────────────────────────────────────────────
// FILE: backend/src/modules/gradebook/services/grading.util.ts
//
// Single canonical grade-from-percentage computation function.
//
// Per GRADEBOOK_ARCHITECTURE_FREEZE_v1.0.md §3.5:
//   "There SHALL be exactly one grade-from-percentage computation function,
//    owned by `gradebook`, consumed by `examinations`, `report-card`, and
//    `promotion`. No module SHALL implement its own grading logic or
//    hardcoded grade scale."
//
// This function performs no DB access. Callers MUST fetch the tenant/session
// (and, per §4.2, eventually board) scoped `GradeBoundary` rows themselves
// and pass them in. There is no built-in fallback scale — if no configured
// boundary covers a given percentage, the result is 'N/A', which reflects a
// grading-configuration gap rather than a computed grade.
// ─────────────────────────────────────────────────────────────────────────────

export interface GradeBoundaryLike {
  minMark: number | string | { toNumber?: () => number; toString: () => string };
  maxMark: number | string | { toNumber?: () => number; toString: () => string };
  grade: string;
}

const toNumber = (value: GradeBoundaryLike['minMark']): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && typeof value.toNumber === 'function') return value.toNumber();
  return Number(value);
};

/**
 * Resolve the configured grade label for a percentage score.
 *
 * @param percentage - the percentage score to grade (0-100 range expected)
 * @param boundaries - GradeBoundary rows for the relevant tenant/session
 *                     (and, once §4.2 lands, board); any order is accepted,
 *                     the function sorts internally by minMark descending
 *                     so the first matching (i.e. highest) boundary wins.
 * @returns the matched grade label, or 'N/A' if no configured boundary
 *          covers the given percentage.
 */
export function computeGrade(percentage: number, boundaries: GradeBoundaryLike[]): string {
  const sorted = [...boundaries].sort((a, b) => toNumber(b.minMark) - toNumber(a.minMark));

  for (const boundary of sorted) {
    if (percentage >= toNumber(boundary.minMark) && percentage <= toNumber(boundary.maxMark)) {
      return boundary.grade;
    }
  }

  return 'N/A';
}
