// backend/src/modules/student-billing/ledger/financial-year.util.ts
//
// Single definition of "financial year" for Student Billing: the FY START
// year, 1 April - 31 March, per D-2 (FINANCE_ARCHITECTURE_FREEZE_v1.2.md).
// 2026 means FY 2026-27. Never derive this from Date.getFullYear() alone --
// that's exactly the bug this function exists to prevent (a date in
// January-March belongs to the PREVIOUS calendar year's FY).
//
// Exported (not private to LedgerService) deliberately: M7's sequence-backed
// numbering infrastructure needs this identical boundary logic
// (InvoiceSequence/ReceiptSequence's `year` field is the same FY-start
// convention). When M7 is implemented, it MUST import this function rather
// than re-deriving the same boundary a second time -- matching §4.9's
// "reuse existing logic, don't duplicate" principle applied to shared
// utilities generally, not just ledger posting specifically.
export function financialYearFor(date: Date): number {
  const month = date.getUTCMonth(); // 0-indexed: 0 = January, 3 = April
  const year = date.getUTCFullYear();
  return month >= 3 ? year : year - 1;
}
