/*
  M11 (redesigned roadmap): FundingSource generalisation.

  paymentId becomes nullable (a STUDENT_ACCOUNT-sourced row, once M17
  exists, won't have one) but is NOT dropped -- kept as a convenience FK
  for query joins when the source is a payment, always populated
  alongside fundingSourceId in that case, never the sole reference. Every
  existing row is backfilled as PAYMENT-sourced with fundingSourceId
  copied from its existing paymentId -- Additive per the frozen spec, no
  existing data is altered beyond adding the new columns' values.

  Execution-tested against real Postgres before trusting it, same
  discipline as every other migration this stretch.
*/

-- CreateEnum
CREATE TYPE "FundingSourceType" AS ENUM ('PAYMENT', 'STUDENT_ACCOUNT');

-- AlterTable: add the generalized funding-source columns, nullable for
-- now since the backfill below populates them in a second pass (adding
-- a NOT NULL column with no default would fail against existing rows).
ALTER TABLE "PaymentAllocation" ADD COLUMN "fundingSourceType" "FundingSourceType";
ALTER TABLE "PaymentAllocation" ADD COLUMN "fundingSourceId" TEXT;

-- Backfill: every existing allocation was payment-sourced (M10 had no
-- other kind).
UPDATE "PaymentAllocation" SET "fundingSourceType" = 'PAYMENT'::"FundingSourceType", "fundingSourceId" = "paymentId";

-- Now that every row has a value, enforce NOT NULL going forward.
ALTER TABLE "PaymentAllocation" ALTER COLUMN "fundingSourceType" SET NOT NULL;
ALTER TABLE "PaymentAllocation" ALTER COLUMN "fundingSourceId" SET NOT NULL;

-- AlterTable: paymentId relaxed to nullable, not dropped.
ALTER TABLE "PaymentAllocation" ALTER COLUMN "paymentId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "PaymentAllocation_fundingSourceType_fundingSourceId_idx" ON "PaymentAllocation"("fundingSourceType", "fundingSourceId");
