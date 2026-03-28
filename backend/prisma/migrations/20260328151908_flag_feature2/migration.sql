/*
  Warnings:

  - You are about to drop the column `activatesAt` on the `FeatureFlagOverrideRequest` table. All the data in the column will be lost.
  - You are about to drop the column `activationMode` on the `FeatureFlagOverrideRequest` table. All the data in the column will be lost.
  - You are about to drop the column `approvedAt` on the `FeatureFlagOverrideRequest` table. All the data in the column will be lost.
  - You are about to drop the column `approvedBy` on the `FeatureFlagOverrideRequest` table. All the data in the column will be lost.
  - You are about to drop the column `approverNote` on the `FeatureFlagOverrideRequest` table. All the data in the column will be lost.
  - You are about to drop the column `autoRevokeIfNotUpgradedDays` on the `FeatureFlagOverrideRequest` table. All the data in the column will be lost.
  - You are about to drop the column `cancelledAt` on the `FeatureFlagOverrideRequest` table. All the data in the column will be lost.
  - You are about to drop the column `cancelledBy` on the `FeatureFlagOverrideRequest` table. All the data in the column will be lost.
  - You are about to drop the column `isEnabled` on the `FeatureFlagOverrideRequest` table. All the data in the column will be lost.
  - You are about to drop the column `notifiedSchoolAt` on the `FeatureFlagOverrideRequest` table. All the data in the column will be lost.
  - You are about to drop the column `rejectedAt` on the `FeatureFlagOverrideRequest` table. All the data in the column will be lost.
  - You are about to drop the column `rejectedBy` on the `FeatureFlagOverrideRequest` table. All the data in the column will be lost.
  - You are about to drop the column `rejectionReason` on the `FeatureFlagOverrideRequest` table. All the data in the column will be lost.
  - You are about to drop the column `requestReason` on the `FeatureFlagOverrideRequest` table. All the data in the column will be lost.
  - You are about to drop the column `requestedAt` on the `FeatureFlagOverrideRequest` table. All the data in the column will be lost.
  - You are about to drop the column `revokeReason` on the `FeatureFlagOverrideRequest` table. All the data in the column will be lost.
  - You are about to drop the column `revokedAt` on the `FeatureFlagOverrideRequest` table. All the data in the column will be lost.
  - You are about to drop the column `revokedBy` on the `FeatureFlagOverrideRequest` table. All the data in the column will be lost.
  - You are about to drop the column `targetName` on the `FeatureFlagOverrideRequest` table. All the data in the column will be lost.
  - You are about to drop the column `trialDays` on the `FeatureFlagOverrideRequest` table. All the data in the column will be lost.
  - You are about to drop the column `upgradedDetectedAt` on the `FeatureFlagOverrideRequest` table. All the data in the column will be lost.
  - The `status` column on the `FeatureFlagOverrideRequest` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `createdBy` on the `FeatureFlagSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `executedAt` on the `FeatureFlagSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `reason` on the `FeatureFlagSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `FeatureFlagSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `targetId` on the `FeatureFlagSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `targetType` on the `FeatureFlagSchedule` table. All the data in the column will be lost.
  - Added the required column `tenantId` to the `FeatureFlagOverrideRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `FeatureFlagSchedule` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `action` on the `FeatureFlagSchedule` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED');

-- DropIndex
DROP INDEX "FeatureFlagOverrideRequest_flagId_status_idx";

-- DropIndex
DROP INDEX "FeatureFlagOverrideRequest_requestedBy_idx";

-- DropIndex
DROP INDEX "FeatureFlagOverrideRequest_targetType_targetId_idx";

-- DropIndex
DROP INDEX "FeatureFlagSchedule_flagId_idx";

-- DropIndex
DROP INDEX "FeatureFlagSchedule_scheduledAt_status_idx";

-- AlterTable
ALTER TABLE "FeatureFlagOverrideRequest" DROP COLUMN "activatesAt",
DROP COLUMN "activationMode",
DROP COLUMN "approvedAt",
DROP COLUMN "approvedBy",
DROP COLUMN "approverNote",
DROP COLUMN "autoRevokeIfNotUpgradedDays",
DROP COLUMN "cancelledAt",
DROP COLUMN "cancelledBy",
DROP COLUMN "isEnabled",
DROP COLUMN "notifiedSchoolAt",
DROP COLUMN "rejectedAt",
DROP COLUMN "rejectedBy",
DROP COLUMN "rejectionReason",
DROP COLUMN "requestReason",
DROP COLUMN "requestedAt",
DROP COLUMN "revokeReason",
DROP COLUMN "revokedAt",
DROP COLUMN "revokedBy",
DROP COLUMN "targetName",
DROP COLUMN "trialDays",
DROP COLUMN "upgradedDetectedAt",
ADD COLUMN     "adminNotes" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "gracePeriodUntil" TIMESTAMP(3),
ADD COLUMN     "isGraceActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "metadata" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "slaBreachedAt" TIMESTAMP(3),
ADD COLUMN     "tenantId" TEXT NOT NULL,
ALTER COLUMN "targetType" SET DEFAULT 'TENANT',
DROP COLUMN "status",
ADD COLUMN     "status" "RequestStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "FeatureFlagSchedule" DROP COLUMN "createdBy",
DROP COLUMN "executedAt",
DROP COLUMN "reason",
DROP COLUMN "status",
DROP COLUMN "targetId",
DROP COLUMN "targetType",
ADD COLUMN     "isexecuted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tenantId" TEXT NOT NULL,
DROP COLUMN "action",
ADD COLUMN     "action" BOOLEAN NOT NULL;

-- DropEnum
DROP TYPE "ActivationMode";

-- DropEnum
DROP TYPE "FlagAction";

-- DropEnum
DROP TYPE "OverrideRequestStatus";

-- DropEnum
DROP TYPE "ScheduleStatus";

-- CreateTable
CREATE TABLE "FeatureFlagUsage" (
    "id" TEXT NOT NULL,
    "flagName" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "lastUsed" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlagUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlagCacheVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlagCacheVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeatureFlagUsage_tenantId_idx" ON "FeatureFlagUsage"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlagUsage_flagName_tenantId_key" ON "FeatureFlagUsage"("flagName", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlagCacheVersion_tenantId_key" ON "FeatureFlagCacheVersion"("tenantId");

-- CreateIndex
CREATE INDEX "FeatureFlagOverrideRequest_tenantId_idx" ON "FeatureFlagOverrideRequest"("tenantId");

-- CreateIndex
CREATE INDEX "FeatureFlagOverrideRequest_status_idx" ON "FeatureFlagOverrideRequest"("status");

-- CreateIndex
CREATE INDEX "FeatureFlagSchedule_scheduledAt_idx" ON "FeatureFlagSchedule"("scheduledAt");

-- CreateIndex
CREATE INDEX "FeatureFlagSchedule_tenantId_idx" ON "FeatureFlagSchedule"("tenantId");
