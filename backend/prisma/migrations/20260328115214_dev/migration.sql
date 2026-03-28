/*
  Warnings:

  - You are about to drop the column `config` on the `FeatureFlag` table. All the data in the column will be lost.
  - You are about to drop the column `enabledAt` on the `FeatureFlag` table. All the data in the column will be lost.
  - You are about to drop the column `enabledBy` on the `FeatureFlag` table. All the data in the column will be lost.
  - You are about to drop the column `isEnabled` on the `FeatureFlag` table. All the data in the column will be lost.
  - You are about to drop the column `tenantId` on the `FeatureFlag` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `FeatureFlag` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "FlagCategory" AS ENUM ('MODULE', 'FEATURE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "FlagTargetType" AS ENUM ('GLOBAL', 'TENANT', 'BRANCH', 'ROLE', 'USER');

-- CreateEnum
CREATE TYPE "FlagAction" AS ENUM ('ENABLE', 'DISABLE');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('PENDING', 'EXECUTED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ActivationMode" AS ENUM ('IMMEDIATE', 'SCHEDULED', 'TRIAL', 'UPGRADE_GATED');

-- CreateEnum
CREATE TYPE "OverrideRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'ACTIVE', 'EXPIRED', 'REVOKED');

-- DropForeignKey
ALTER TABLE "FeatureFlag" DROP CONSTRAINT "FeatureFlag_tenantId_fkey";

-- DropIndex
DROP INDEX "FeatureFlag_tenantId_idx";

-- DropIndex
DROP INDEX "FeatureFlag_tenantId_name_key";

-- AlterTable
ALTER TABLE "FeatureFlag" DROP COLUMN "config",
DROP COLUMN "enabledAt",
DROP COLUMN "enabledBy",
DROP COLUMN "isEnabled",
DROP COLUMN "tenantId",
ADD COLUMN     "allowedTiers" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "category" "FlagCategory" NOT NULL DEFAULT 'FEATURE',
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "defaultValue" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "enabledFromAt" TIMESTAMP(3),
ADD COLUMN     "enabledUntilAt" TIMESTAMP(3),
ADD COLUMN     "label" TEXT NOT NULL DEFAULT 'New Feature',
ADD COLUMN     "rolloutPercentage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tenantControllable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedBy" TEXT;

-- CreateTable
CREATE TABLE "FeatureFlagOverride" (
    "id" TEXT NOT NULL,
    "flagId" TEXT NOT NULL,
    "targetType" "FlagTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "reason" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlagOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlagOverrideRequest" (
    "id" TEXT NOT NULL,
    "flagId" TEXT NOT NULL,
    "targetType" "FlagTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetName" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestReason" TEXT NOT NULL,
    "activationMode" "ActivationMode" NOT NULL,
    "activatesAt" TIMESTAMP(3),
    "trialDays" INTEGER,
    "autoRevokeIfNotUpgradedDays" INTEGER,
    "upgradedDetectedAt" TIMESTAMP(3),
    "status" "OverrideRequestStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approverNote" TEXT,
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "cancelledBy" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "revokedBy" TEXT,
    "notifiedSchoolAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlagOverrideRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlagSchedule" (
    "id" TEXT NOT NULL,
    "flagId" TEXT NOT NULL,
    "targetType" "FlagTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "action" "FlagAction" NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "status" "ScheduleStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureFlagSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_FeatureFlagToTenant" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlagOverride_requestId_key" ON "FeatureFlagOverride"("requestId");

-- CreateIndex
CREATE INDEX "FeatureFlagOverride_flagId_idx" ON "FeatureFlagOverride"("flagId");

-- CreateIndex
CREATE INDEX "FeatureFlagOverride_targetType_targetId_idx" ON "FeatureFlagOverride"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "FeatureFlagOverride_expiresAt_idx" ON "FeatureFlagOverride"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlagOverride_flagId_targetType_targetId_key" ON "FeatureFlagOverride"("flagId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "FeatureFlagOverrideRequest_status_idx" ON "FeatureFlagOverrideRequest"("status");

-- CreateIndex
CREATE INDEX "FeatureFlagOverrideRequest_requestedBy_idx" ON "FeatureFlagOverrideRequest"("requestedBy");

-- CreateIndex
CREATE INDEX "FeatureFlagOverrideRequest_targetType_targetId_idx" ON "FeatureFlagOverrideRequest"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "FeatureFlagOverrideRequest_flagId_status_idx" ON "FeatureFlagOverrideRequest"("flagId", "status");

-- CreateIndex
CREATE INDEX "FeatureFlagSchedule_scheduledAt_status_idx" ON "FeatureFlagSchedule"("scheduledAt", "status");

-- CreateIndex
CREATE INDEX "FeatureFlagSchedule_flagId_idx" ON "FeatureFlagSchedule"("flagId");

-- CreateIndex
CREATE UNIQUE INDEX "_FeatureFlagToTenant_AB_unique" ON "_FeatureFlagToTenant"("A", "B");

-- CreateIndex
CREATE INDEX "_FeatureFlagToTenant_B_index" ON "_FeatureFlagToTenant"("B");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_name_key" ON "FeatureFlag"("name");

-- CreateIndex
CREATE INDEX "FeatureFlag_category_idx" ON "FeatureFlag"("category");

-- CreateIndex
CREATE INDEX "FeatureFlag_name_idx" ON "FeatureFlag"("name");

-- AddForeignKey
ALTER TABLE "FeatureFlagOverride" ADD CONSTRAINT "FeatureFlagOverride_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "FeatureFlag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureFlagOverride" ADD CONSTRAINT "FeatureFlagOverride_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "FeatureFlagOverrideRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureFlagOverrideRequest" ADD CONSTRAINT "FeatureFlagOverrideRequest_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "FeatureFlag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureFlagSchedule" ADD CONSTRAINT "FeatureFlagSchedule_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "FeatureFlag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FeatureFlagToTenant" ADD CONSTRAINT "_FeatureFlagToTenant_A_fkey" FOREIGN KEY ("A") REFERENCES "FeatureFlag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FeatureFlagToTenant" ADD CONSTRAINT "_FeatureFlagToTenant_B_fkey" FOREIGN KEY ("B") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
