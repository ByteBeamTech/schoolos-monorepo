-- CreateEnum
CREATE TYPE "TripIncidentType" AS ENUM ('DRIVER_REPLACEMENT', 'VEHICLE_BREAKDOWN', 'ROUTE_DIVERSION', 'OTHER');

-- AlterEnum
ALTER TYPE "TripType" ADD VALUE 'EMERGENCY';

-- DropForeignKey
ALTER TABLE "LateFeeRule" DROP CONSTRAINT "LateFeeRule_branchId_fkey";

-- DropForeignKey
ALTER TABLE "LateFeeRule" DROP CONSTRAINT "LateFeeRule_feePlanId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentAllocation" DROP CONSTRAINT "PaymentAllocation_paymentId_fkey";

-- DropIndex
DROP INDEX "LateFee_ruleId_idx";

-- AlterTable
ALTER TABLE "FeeHead" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PaymentAllocation" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TripIncident" ADD COLUMN     "type" "TripIncidentType" NOT NULL DEFAULT 'OTHER';

-- CreateIndex
CREATE INDEX "LateFeeRule_tenantId_branchId_feePlanId_effectiveFrom_idx" ON "LateFeeRule"("tenantId", "branchId", "feePlanId", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "LateFeeRule" ADD CONSTRAINT "LateFeeRule_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LateFeeRule" ADD CONSTRAINT "LateFeeRule_feePlanId_fkey" FOREIGN KEY ("feePlanId") REFERENCES "FeePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
