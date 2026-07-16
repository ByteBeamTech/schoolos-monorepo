-- CreateEnum
CREATE TYPE "LicenseGenerationReason" AS ENUM ('ONBOARDING_TRIAL', 'SUBSCRIPTION_ACTIVATED', 'PLAN_CHANGED', 'RENEWAL', 'OVERRIDE_APPLIED', 'OVERRIDE_EXPIRED', 'MANUAL_ADMIN', 'BACKFILL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LicenseStatus" ADD VALUE 'TRIAL';
ALTER TYPE "LicenseStatus" ADD VALUE 'GRACE_PERIOD';
ALTER TYPE "LicenseStatus" ADD VALUE 'SUSPENDED';

-- AlterTable
ALTER TABLE "License" ADD COLUMN     "generationVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "LicenseHistory" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "generationVersion" INTEGER NOT NULL,
    "reason" "LicenseGenerationReason" NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "planId" TEXT,
    "planVersion" INTEGER,
    "subscriptionId" TEXT,
    "subscriptionStatus" TEXT,
    "sourceEventKey" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "planSnapshot" JSONB,
    "featuresSnapshot" JSONB,
    "limitsSnapshot" JSONB,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LicenseHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LicenseHistory_sourceEventKey_key" ON "LicenseHistory"("sourceEventKey");

-- CreateIndex
CREATE INDEX "LicenseHistory_licenseId_idx" ON "LicenseHistory"("licenseId");

-- CreateIndex
CREATE INDEX "LicenseHistory_tenantId_idx" ON "LicenseHistory"("tenantId");

-- CreateIndex
CREATE INDEX "LicenseHistory_licenseId_generationVersion_idx" ON "LicenseHistory"("licenseId", "generationVersion");

-- AddForeignKey
ALTER TABLE "LicenseHistory" ADD CONSTRAINT "LicenseHistory_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
