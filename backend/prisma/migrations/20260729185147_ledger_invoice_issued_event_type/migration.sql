/*
  M8 (redesigned roadmap): adds INVOICE_ISSUED to LedgerEventType.
  Additive-only per §4.8 (frozen decision 28). Standalone migration
  containing only the ALTER TYPE statement -- same reasoning as the
  LATE_FEE_ASSESSED migration (M4): Postgres does not allow a newly-added
  enum value to be used within the same transaction that added it.
*/

ALTER TYPE "LedgerEventType" ADD VALUE 'INVOICE_ISSUED';
