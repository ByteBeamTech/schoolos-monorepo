-- ADR-LIB-001 Phase 4: Fine architecture (charge-request only -- Library
-- never holds money). See
-- docs/architecture/library/LIBRARY_DOMAIN_ARCHITECTURE_FREEZE.md §9 and
-- docs/architecture/library/IMPLEMENTATION_STATE.md.

-- CreateEnum
CREATE TYPE "ChargeReason" AS ENUM ('OVERDUE', 'LOST', 'DAMAGED');

-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('PENDING', 'SENT_TO_BILLING', 'BILLED', 'WAIVED', 'CANCELLED');

-- AlterTable: per-branch flat fee settings for lost/damaged copies.
ALTER TABLE "LibraryBranchSettings"
  ADD COLUMN "lostBookReplacementFee" DECIMAL(10,2) NOT NULL DEFAULT 500.00,
  ADD COLUMN "damagedBookFee" DECIMAL(10,2) NOT NULL DEFAULT 200.00;

-- AlterTable: BookIssue.fine/finePaid predate Phase 2 and were left
-- write-only/unused since (audit finding S7 -- a client-settable fine
-- amount with no server-side calculation). LibraryChargeRequest below is
-- the real replacement; nothing in this codebase still reads these two
-- columns as of this migration.
ALTER TABLE "BookIssue" DROP COLUMN "fine";
ALTER TABLE "BookIssue" DROP COLUMN "finePaid";

-- CreateTable
CREATE TABLE "LibraryChargeRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "borrowerType" "BorrowerType" NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "borrowerNameSnapshot" TEXT NOT NULL,
    "reason" "ChargeReason" NOT NULL,
    "computedAmount" DECIMAL(10,2) NOT NULL,
    "billingStatus" "BillingStatus" NOT NULL DEFAULT 'PENDING',
    "billingReferenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "waivedAt" TIMESTAMP(3),
    "waivedBy" TEXT,

    CONSTRAINT "LibraryChargeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LibraryChargeRequest_tenantId_branchId_billingStatus_idx" ON "LibraryChargeRequest"("tenantId", "branchId", "billingStatus");

-- CreateIndex
CREATE INDEX "LibraryChargeRequest_issueId_idx" ON "LibraryChargeRequest"("issueId");

-- CreateIndex
CREATE INDEX "LibraryChargeRequest_borrowerType_borrowerId_idx" ON "LibraryChargeRequest"("borrowerType", "borrowerId");

-- AddForeignKey
ALTER TABLE "LibraryChargeRequest" ADD CONSTRAINT "LibraryChargeRequest_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "BookIssue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryChargeRequest" ADD CONSTRAINT "LibraryChargeRequest_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
