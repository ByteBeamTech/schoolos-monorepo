/*
  Warnings:

  - You are about to drop the column `code` on the `Branch` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tenantId,branchCode]` on the table `Branch` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "BranchStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "LicenseType" AS ENUM ('BRANCH', 'TENANT');

-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('UNUSED', 'ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- AlterTable
ALTER TABLE "Branch" DROP COLUMN "code",
ADD COLUMN     "activatedAt" TIMESTAMP(3),
ADD COLUMN     "branchCode" TEXT,
ADD COLUMN     "currentStaffCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "currentStudentCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "licenseId" TEXT,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "status" "BranchStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "suspendedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "License" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "tenantId" TEXT,
    "branchId" TEXT,
    "issuedById" TEXT,
    "subscriptionId" TEXT,
    "orderId" TEXT,
    "type" "LicenseType" NOT NULL,
    "status" "LicenseStatus" NOT NULL DEFAULT 'UNUSED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "maxStudents" INTEGER,
    "maxStaff" INTEGER,
    "maxBranches" INTEGER,
    "storageLimit" INTEGER,
    "features" JSONB,
    "domain" TEXT,
    "hardwareHash" TEXT,
    "metadata" JSONB,
    "expiresAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revocationReason" TEXT,
    "gracePeriod" INTEGER NOT NULL DEFAULT 7,
    "activatedVia" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "License_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LicenseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "License_key_key" ON "License"("key");

-- CreateIndex
CREATE INDEX "License_tenantId_idx" ON "License"("tenantId");

-- CreateIndex
CREATE INDEX "License_branchId_idx" ON "License"("branchId");

-- CreateIndex
CREATE INDEX "License_subscriptionId_idx" ON "License"("subscriptionId");

-- CreateIndex
CREATE INDEX "License_orderId_idx" ON "License"("orderId");

-- CreateIndex
CREATE INDEX "License_key_status_expiresAt_idx" ON "License"("key", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "LicenseOrder_tenantId_idx" ON "LicenseOrder"("tenantId");

-- CreateIndex
CREATE INDEX "UsageRecord_tenantId_idx" ON "UsageRecord"("tenantId");

-- CreateIndex
CREATE INDEX "Branch_tenantId_status_idx" ON "Branch"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_tenantId_branchCode_key" ON "Branch"("tenantId", "branchCode");

-- AddForeignKey
ALTER TABLE "License" ADD CONSTRAINT "License_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "License" ADD CONSTRAINT "License_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
