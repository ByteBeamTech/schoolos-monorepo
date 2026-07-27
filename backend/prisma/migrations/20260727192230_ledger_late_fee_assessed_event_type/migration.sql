/*
  M4 (redesigned roadmap): adds LATE_FEE_ASSESSED to LedgerEventType.
  Additive-only per §4.8 (frozen decision 28) -- the two existing values
  (PAYMENT_COMPLETED, REFUND_COMPLETED) are untouched.

  Deliberately a standalone migration containing ONLY this ALTER TYPE
  statement, nothing else: Postgres does not allow a newly-added enum
  value to be USED (in an INSERT, a WHERE clause, a cast, etc.) within the
  SAME transaction that added it. Since Prisma applies each migration.sql
  file as one implicit transaction, keeping this migration to just the
  type alteration -- with no accompanying data statement that references
  LATE_FEE_ASSESSED -- avoids that restriction entirely rather than
  needing an explicit transaction-boundary workaround.
*/

ALTER TYPE "LedgerEventType" ADD VALUE 'LATE_FEE_ASSESSED';
