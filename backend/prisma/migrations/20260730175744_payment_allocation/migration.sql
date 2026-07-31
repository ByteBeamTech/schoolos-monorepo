/*
  M10 (redesigned roadmap): PaymentAllocation.

  Backfill scope, one deliberate refinement of the literal spec text
  ("one allocation per existing payment for its full amount against its
  current invoice"): scoped to payments whose status indicates money was
  actually applied -- SUCCESS, REFUNDED, PARTIALLY_REFUNDED. A PENDING,
  PROCESSING, or FAILED payment never credited anything; backfilling an
  allocation for one would misrepresent money that was never actually
  collected. REFUNDED/PARTIALLY_REFUNDED payments ARE included: the
  refund is a separate, later event tracked by the Refund table -- the
  original settlement genuinely did allocate the full amount at the time
  it happened, and this backfill is reconstructing that original fact,
  not the current net position.

  Execution-tested against real Postgres before trusting it, same
  discipline as every other migration this stretch -- see the
  accompanying commit message for what was verified.
*/

-- CreateEnum
CREATE TYPE "ChargeType" AS ENUM ('INVOICE', 'LATE_FEE');
CREATE TYPE "AllocationRule" AS ENUM ('OLDEST_DUE_FIRST', 'MANUAL');

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tenantId"  TEXT NOT NULL,
    "branchId"  TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "chargeType" "ChargeType" NOT NULL,
    "chargeId"   TEXT NOT NULL,
    "amount"     DECIMAL(12,2) NOT NULL,
    "rule"       "AllocationRule" NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentAllocation_tenantId_idx" ON "PaymentAllocation"("tenantId");
CREATE INDEX "PaymentAllocation_branchId_idx" ON "PaymentAllocation"("branchId");
CREATE INDEX "PaymentAllocation_paymentId_idx" ON "PaymentAllocation"("paymentId");
CREATE INDEX "PaymentAllocation_chargeType_chargeId_idx" ON "PaymentAllocation"("chargeType", "chargeId");

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: Payment.invoiceId becomes nullable. Not dropped, per the
-- frozen spec. The FK itself is unaffected -- relaxing NOT NULL does not
-- require touching the existing FK or unique constraint definitions.
ALTER TABLE "Payment" ALTER COLUMN "invoiceId" DROP NOT NULL;

-- Backfill: one INVOICE-targeted allocation per historical payment that
-- actually applied money, for its full amount, against its own invoiceId.
INSERT INTO "PaymentAllocation" ("tenantId", "branchId", "paymentId", "chargeType", "chargeId", "amount", "rule")
SELECT "tenantId", "branchId", "id", 'INVOICE'::"ChargeType", "invoiceId", "amount", 'OLDEST_DUE_FIRST'::"AllocationRule"
FROM "Payment"
WHERE "invoiceId" IS NOT NULL
  AND "status" IN ('SUCCESS', 'REFUNDED', 'PARTIALLY_REFUNDED');
