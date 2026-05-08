-- CreateEnum
CREATE TYPE "CronStatus" AS ENUM ('SUCCESS', 'FAILED', 'SKIPPED', 'DEFERRED');

-- CreateEnum
CREATE TYPE "CronSkipReason" AS ENUM ('LOCK_NOT_ACQUIRED', 'ALREADY_PROCESSED', 'BACKPRESSURE', 'MISSED_WINDOW_EXCEEDED');

-- AlterTable
ALTER TABLE "TenantJobSchedule" ADD COLUMN     "missedWindow" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "time" TEXT NOT NULL DEFAULT '08:00';

-- CreateTable
CREATE TABLE "CronExecutionLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "tenantSlug" TEXT,
    "branchSlug" TEXT,
    "jobName" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL,
    "lagMs" INTEGER NOT NULL,
    "durationMs" INTEGER,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "status" "CronStatus" NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CronExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CronExecutionLog_tenantId_jobName_idx" ON "CronExecutionLog"("tenantId", "jobName");

-- CreateIndex
CREATE INDEX "CronExecutionLog_status_idx" ON "CronExecutionLog"("status");

-- CreateIndex
CREATE INDEX "CronExecutionLog_jobId_idx" ON "CronExecutionLog"("jobId");

-- CreateIndex
CREATE INDEX "CronExecutionLog_executionId_idx" ON "CronExecutionLog"("executionId");

-- CreateIndex
CREATE INDEX "CronExecutionLog_tenantId_createdAt_idx" ON "CronExecutionLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "CronExecutionLog_branchId_idx" ON "CronExecutionLog"("branchId");

-- AddForeignKey
ALTER TABLE "CronExecutionLog" ADD CONSTRAINT "CronExecutionLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CronExecutionLog" ADD CONSTRAINT "CronExecutionLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
