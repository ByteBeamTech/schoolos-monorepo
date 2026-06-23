/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,branchId,name,academicYear]` on the table `FeePlan` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,branchId,invoiceNumber]` on the table `Invoice` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,branchId,receiptNumber]` on the table `Receipt` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `branchId` to the `FeeAssignment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `branchId` to the `Invoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `branchId` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `branchId` to the `Receipt` table without a default value. This is not possible if the table is not empty.
  - Added the required column `branchId` to the `Refund` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "FeePlan_tenantId_name_academicYear_key";

-- DropIndex
DROP INDEX "Invoice_tenantId_invoiceNumber_key";

-- DropIndex
DROP INDEX "Receipt_receiptNumber_key";

-- AlterTable
ALTER TABLE "FeeAssignment" ADD COLUMN     "branchId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "FeePlan" ADD COLUMN     "branchId" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "branchId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "branchId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN     "branchId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Refund" ADD COLUMN     "branchId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "InvoiceSequence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptSequence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReceiptSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceSequence_tenantId_branchId_idx" ON "InvoiceSequence"("tenantId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceSequence_tenantId_branchId_year_key" ON "InvoiceSequence"("tenantId", "branchId", "year");

-- CreateIndex
CREATE INDEX "ReceiptSequence_tenantId_branchId_idx" ON "ReceiptSequence"("tenantId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptSequence_tenantId_branchId_year_key" ON "ReceiptSequence"("tenantId", "branchId", "year");

-- CreateIndex
CREATE INDEX "FeeAssignment_tenantId_branchId_idx" ON "FeeAssignment"("tenantId", "branchId");

-- CreateIndex
CREATE INDEX "FeePlan_tenantId_branchId_idx" ON "FeePlan"("tenantId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "FeePlan_tenantId_branchId_name_academicYear_key" ON "FeePlan"("tenantId", "branchId", "name", "academicYear");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_branchId_idx" ON "Invoice"("tenantId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_tenantId_branchId_invoiceNumber_key" ON "Invoice"("tenantId", "branchId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "Payment_tenantId_branchId_idx" ON "Payment"("tenantId", "branchId");

-- CreateIndex
CREATE INDEX "Receipt_tenantId_branchId_idx" ON "Receipt"("tenantId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_tenantId_branchId_receiptNumber_key" ON "Receipt"("tenantId", "branchId", "receiptNumber");

-- CreateIndex
CREATE INDEX "Refund_tenantId_branchId_idx" ON "Refund"("tenantId", "branchId");

-- AddForeignKey
ALTER TABLE "FeePlan" ADD CONSTRAINT "FeePlan_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeAssignment" ADD CONSTRAINT "FeeAssignment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceSequence" ADD CONSTRAINT "InvoiceSequence_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptSequence" ADD CONSTRAINT "ReceiptSequence_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
