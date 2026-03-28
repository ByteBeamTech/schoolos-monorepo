/*
  Warnings:

  - The primary key for the `FeatureFlagCacheVersion` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `FeatureFlagCacheVersion` table. All the data in the column will be lost.
  - You are about to drop the column `adminNotes` on the `FeatureFlagOverrideRequest` table. All the data in the column will be lost.
  - You are about to drop the column `expiresAt` on the `FeatureFlagOverrideRequest` table. All the data in the column will be lost.
  - You are about to drop the column `gracePeriodUntil` on the `FeatureFlagOverrideRequest` table. All the data in the column will be lost.
  - You are about to drop the column `isGraceActive` on the `FeatureFlagOverrideRequest` table. All the data in the column will be lost.
  - You are about to drop the column `lastNotifiedAt` on the `FeatureFlagOverrideRequest` table. All the data in the column will be lost.
  - You are about to drop the column `metadata` on the `FeatureFlagOverrideRequest` table. All the data in the column will be lost.
  - You are about to drop the column `reason` on the `FeatureFlagOverrideRequest` table. All the data in the column will be lost.
  - You are about to drop the column `slaBreachedAt` on the `FeatureFlagOverrideRequest` table. All the data in the column will be lost.
  - You are about to drop the column `tenantId` on the `FeatureFlagOverrideRequest` table. All the data in the column will be lost.
  - The `status` column on the `FeatureFlagOverrideRequest` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `isexecuted` on the `FeatureFlagSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `tenantId` on the `FeatureFlagSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `count` on the `FeatureFlagUsage` table. All the data in the column will be lost.
  - You are about to drop the column `lastUsed` on the `FeatureFlagUsage` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[flagName,tenantId,date]` on the table `FeatureFlagUsage` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `activationMode` to the `FeatureFlagOverrideRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `requestReason` to the `FeatureFlagOverrideRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `targetId` to the `FeatureFlagSchedule` table without a default value. This is not possible if the table is not empty.
  - Added the required column `targetType` to the `FeatureFlagSchedule` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `action` on the `FeatureFlagSchedule` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `date` to the `FeatureFlagUsage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `FeatureFlagUsage` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "FlagAction" AS ENUM ('ENABLE', 'DISABLE');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('PENDING', 'EXECUTED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ActivationMode" AS ENUM ('IMMEDIATE', 'SCHEDULED', 'TRIAL', 'UPGRADE_GATED');

-- CreateEnum
CREATE TYPE "OverrideRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'ACTIVE', 'EXPIRED', 'REVOKED');

-- DropIndex
DROP INDEX "FeatureFlagCacheVersion_tenantId_key";

-- DropIndex
DROP INDEX "FeatureFlagOverrideRequest_tenantId_idx";

-- DropIndex
DROP INDEX "FeatureFlagSchedule_scheduledAt_idx";

-- DropIndex
DROP INDEX "FeatureFlagSchedule_tenantId_idx";

-- DropIndex
DROP INDEX "FeatureFlagUsage_flagName_tenantId_key";

-- DropIndex
DROP INDEX "FeatureFlagUsage_tenantId_idx";

-- AlterTable
ALTER TABLE "FeatureFlagCacheVersion" DROP CONSTRAINT "FeatureFlagCacheVersion_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "FeatureFlagCacheVersion_pkey" PRIMARY KEY ("tenantId");

-- AlterTable
ALTER TABLE "FeatureFlagOverrideRequest" DROP COLUMN "adminNotes",
DROP COLUMN "expiresAt",
DROP COLUMN "gracePeriodUntil",
DROP COLUMN "isGraceActive",
DROP COLUMN "lastNotifiedAt",
DROP COLUMN "metadata",
DROP COLUMN "reason",
DROP COLUMN "slaBreachedAt",
DROP COLUMN "tenantId",
ADD COLUMN     "activatesAt" TIMESTAMP(3),
ADD COLUMN     "activationMode" "ActivationMode" NOT NULL,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "approverNote" TEXT,
ADD COLUMN     "autoRevokeIfNotUpgradedDays" INTEGER,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledBy" TEXT,
ADD COLUMN     "escalatedAt" TIMESTAMP(3),
ADD COLUMN     "escalatedTo" TEXT,
ADD COLUMN     "graceEndsAt" TIMESTAMP(3),
ADD COLUMN     "gracePeriodDays" INTEGER,
ADD COLUMN     "inGracePeriod" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifiedSchoolAt" TIMESTAMP(3),
ADD COLUMN     "planSnapshotAtApproval" JSONB,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedBy" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "requestReason" TEXT NOT NULL,
ADD COLUMN     "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "revokeReason" TEXT,
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "revokedBy" TEXT,
ADD COLUMN     "slaDeadlineAt" TIMESTAMP(3),
ADD COLUMN     "targetName" TEXT,
ADD COLUMN     "trialDays" INTEGER,
ADD COLUMN     "upgradedDetectedAt" TIMESTAMP(3),
ALTER COLUMN "targetType" DROP DEFAULT,
DROP COLUMN "status",
ADD COLUMN     "status" "OverrideRequestStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "FeatureFlagSchedule" DROP COLUMN "isexecuted",
DROP COLUMN "tenantId",
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "executedAt" TIMESTAMP(3),
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "status" "ScheduleStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "targetId" TEXT NOT NULL,
ADD COLUMN     "targetType" "FlagTargetType" NOT NULL,
DROP COLUMN "action",
ADD COLUMN     "action" "FlagAction" NOT NULL;

-- AlterTable
ALTER TABLE "FeatureFlagUsage" DROP COLUMN "count",
DROP COLUMN "lastUsed",
ADD COLUMN     "callCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "hitCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastNudgeAt" TIMESTAMP(3),
ADD COLUMN     "missCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- DropEnum
DROP TYPE "RequestStatus";

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
CREATE INDEX "FeatureFlagUsage_tenantId_date_idx" ON "FeatureFlagUsage"("tenantId", "date");

-- CreateIndex
CREATE INDEX "FeatureFlagUsage_flagName_date_idx" ON "FeatureFlagUsage"("flagName", "date");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlagUsage_flagName_tenantId_date_key" ON "FeatureFlagUsage"("flagName", "tenantId", "date");
