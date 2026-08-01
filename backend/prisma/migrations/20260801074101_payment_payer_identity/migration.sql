/*
  M12 (redesigned roadmap, D-1): Payment.payerId.

  Purely additive, nullable, no backfill -- per the frozen spec:
  "Historical payments are not back-attributed; inferring a payer is
  fabrication." Every existing Payment row simply gets payerId = NULL,
  which is already its default; there is nothing to compute or migrate.

  Execution-tested against real Postgres before trusting it, same
  discipline as every other migration this stretch.
*/

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "payerId" TEXT;

-- CreateIndex
CREATE INDEX "Payment_payerId_idx" ON "Payment"("payerId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "Guardian"("id") ON DELETE SET NULL ON UPDATE CASCADE;
