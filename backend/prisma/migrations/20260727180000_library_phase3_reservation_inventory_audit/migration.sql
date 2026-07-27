-- ADR-LIB-001 Phase 3: Reservation + Inventory Audit.
-- Purely additive -- no existing table is altered or dropped.
-- See docs/architecture/library/LIBRARY_DOMAIN_ARCHITECTURE_FREEZE.md
-- SS6/SS8 and docs/architecture/library/IMPLEMENTATION_STATE.md.

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('QUEUED', 'READY_FOR_PICKUP', 'FULFILLED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "InventoryAuditStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "borrowerType" "BorrowerType" NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "borrowerNameSnapshot" TEXT NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'QUEUED',
    "copyId" TEXT,
    "holdExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fulfilledAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryAudit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "status" "InventoryAuditStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "conductedBy" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "InventoryAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryAuditItem" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "copyId" TEXT NOT NULL,
    "expectedStatus" "BookCopyStatus" NOT NULL,
    "scannedStatus" "BookCopyStatus",
    "scannedAt" TIMESTAMP(3),
    "discrepancy" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "InventoryAuditItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reservation_tenantId_branchId_bookId_status_createdAt_idx" ON "Reservation"("tenantId", "branchId", "bookId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Reservation_borrowerType_borrowerId_idx" ON "Reservation"("borrowerType", "borrowerId");

-- CreateIndex
CREATE INDEX "Reservation_copyId_idx" ON "Reservation"("copyId");

-- CreateIndex
CREATE INDEX "InventoryAudit_tenantId_branchId_status_idx" ON "InventoryAudit"("tenantId", "branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryAuditItem_auditId_copyId_key" ON "InventoryAuditItem"("auditId", "copyId");

-- CreateIndex
CREATE INDEX "InventoryAuditItem_auditId_idx" ON "InventoryAuditItem"("auditId");

-- CreateIndex
CREATE INDEX "InventoryAuditItem_copyId_idx" ON "InventoryAuditItem"("copyId");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "BookCopy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAudit" ADD CONSTRAINT "InventoryAudit_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAuditItem" ADD CONSTRAINT "InventoryAuditItem_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "InventoryAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAuditItem" ADD CONSTRAINT "InventoryAuditItem_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "BookCopy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- Partial unique index -- at most one ACTIVE (QUEUED or
-- READY_FOR_PICKUP) reservation per borrower per (tenantId, branchId,
-- bookId). Cannot be expressed in schema.prisma (no partial-index
-- attribute) -- see the NOTE on the Reservation model. Prevents the
-- same borrower double-queuing for a title, and is the DB-level
-- backstop under ReservationService's own application-level check.
-- ============================================================
CREATE UNIQUE INDEX "Reservation_borrower_active_key"
  ON "Reservation"("tenantId", "branchId", "bookId", "borrowerType", "borrowerId")
  WHERE "status" IN ('QUEUED', 'READY_FOR_PICKUP');
