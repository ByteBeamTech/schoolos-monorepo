/*
  M6 (redesigned roadmap, D-3/D-4, §4.4): PaymentStatus narrows -- REFUNDED
  and PARTIALLY_REFUNDED removed (refund state is now derived, see
  refund/refund-status.util.ts), REVERSED added (unused until M13's tender
  bounce, built now so M13 doesn't need to reshape this enum).

  PRE-FLIGHT CHECK, per §4.4 -- run this BEFORE applying, and stop to
  investigate if the count is unexpectedly high for your environment
  (this migration converts every such row to SUCCESS; know the blast
  radius first):

    SELECT status, count(*) FROM "Payment" WHERE status IN ('REFUNDED', 'PARTIALLY_REFUNDED') GROUP BY status;
    SELECT status, count(*) FROM "SaasPayment" WHERE status IN ('REFUNDED', 'PARTIALLY_REFUNDED') GROUP BY status;

  PaymentStatus is NOT student-billing-only: it is also used by
  SaasPayment.status (backend/prisma/schema/saas-billing/saas-billing.prisma)
  -- a completely separate, unrelated commercial/subscription billing
  domain. Confirmed by exhaustive search before writing this migration:
  no code anywhere outside refund.service.ts actually reads or writes
  REFUNDED/PARTIALLY_REFUNDED today, on either table -- but a shared
  enum's DATA can still carry historical values no current code path
  would create, so both tables are backfilled and migrated here, not
  just Payment.

  Postgres has no ALTER TYPE ... DROP VALUE. Removing an enum value
  requires: create a new type with the desired final value set, migrate
  every column using the old type to the new one, drop the old type,
  rename the new type to the original name. Done here in that order.

  Execution-tested against real Postgres before trusting it, with a
  fixture covering both tables and confirming the old values are
  genuinely gone at the type level afterward, not just unused by
  current code.
*/

-- Step 1: backfill. Both tables, defensively, even though no current code
-- path writes these values to SaasPayment -- a shared enum's data can
-- predate any particular reader.
UPDATE "Payment" SET status = 'SUCCESS' WHERE status IN ('REFUNDED', 'PARTIALLY_REFUNDED');
UPDATE "SaasPayment" SET status = 'SUCCESS' WHERE status IN ('REFUNDED', 'PARTIALLY_REFUNDED');

-- Step 2: the new, narrowed type.
CREATE TYPE "PaymentStatus_new" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'REVERSED');

-- Step 3: migrate both columns. Defaults are dropped and re-added against
-- the new type explicitly -- ALTER COLUMN TYPE does not reliably carry a
-- DEFAULT referencing the old enum type forward on its own.
ALTER TABLE "Payment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Payment" ALTER COLUMN "status" TYPE "PaymentStatus_new" USING ("status"::text::"PaymentStatus_new");
ALTER TABLE "Payment" ALTER COLUMN "status" SET DEFAULT 'PENDING';

ALTER TABLE "SaasPayment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "SaasPayment" ALTER COLUMN "status" TYPE "PaymentStatus_new" USING ("status"::text::"PaymentStatus_new");
ALTER TABLE "SaasPayment" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- Step 4: drop the old type, rename the new one into its place.
DROP TYPE "PaymentStatus";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";
