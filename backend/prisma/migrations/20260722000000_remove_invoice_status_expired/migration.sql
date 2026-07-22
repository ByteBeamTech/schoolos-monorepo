/*
  Warnings:

  - The value [EXPIRED] on the enum `InvoiceStatus` will be removed. If this
    variant is still used in the database, this will fail.

  Context (FEE-1 / IMPLEMENTATION_HANDOFF.md §2, §6.2):

  `InvoiceStatus.EXPIRED` was removed from the Prisma schema in commit
  e9e052f as verified dead code -- never set, never read. Its migration was
  never generated, so schema and database have been divergent since. This
  migration closes that gap, deliberately on its own so the enum change is
  reviewable and revertible independently of any other schema work.

  PRE-CHECK -- MUST be run against the TARGET database before applying,
  because this migration fails if any row still holds the value. Two tables
  share this enum; the original handoff note listed only the first:

      SELECT COUNT(*) FROM "Invoice"     WHERE status = 'EXPIRED';
      SELECT COUNT(*) FROM "SaasInvoice" WHERE status = 'EXPIRED';

  Both must return 0. Confirmed 0/0 on schoolos_dev on 2026-07-22. That
  result does NOT carry over to production -- re-run both queries there
  before deploying. If either is non-zero, stop: those rows need an explicit
  target-status decision (ADR-level), not a silent data fix inside this
  migration.

  Postgres cannot drop a value from an enum in place, so the type is
  recreated without it and both dependent columns are moved across. Defaults
  are dropped and restored around the type swap because a column default
  cannot survive a type change.
*/

-- AlterEnum
BEGIN;
CREATE TYPE "InvoiceStatus_new" AS ENUM ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');
ALTER TABLE "Invoice" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "SaasInvoice" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Invoice" ALTER COLUMN "status" TYPE "InvoiceStatus_new" USING ("status"::text::"InvoiceStatus_new");
ALTER TABLE "SaasInvoice" ALTER COLUMN "status" TYPE "InvoiceStatus_new" USING ("status"::text::"InvoiceStatus_new");
ALTER TYPE "InvoiceStatus" RENAME TO "InvoiceStatus_old";
ALTER TYPE "InvoiceStatus_new" RENAME TO "InvoiceStatus";
DROP TYPE "InvoiceStatus_old";
ALTER TABLE "Invoice" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
ALTER TABLE "SaasInvoice" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;
