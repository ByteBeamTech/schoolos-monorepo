-- CreateEnum
CREATE TYPE "BehaviorType" AS ENUM ('POSITIVE', 'NEGATIVE', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "BehaviorSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "BehaviorStatus" AS ENUM ('OPEN', 'RESOLVED', 'ESCALATED');

-- CreateTable
CREATE TABLE "BehaviorRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "BehaviorType" NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "severity" "BehaviorSeverity" NOT NULL DEFAULT 'MEDIUM',
    "actionTaken" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "parentNotified" BOOLEAN NOT NULL DEFAULT false,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "status" "BehaviorStatus" NOT NULL DEFAULT 'OPEN',
    "reportedBy" TEXT NOT NULL,
    "incidentDate" DATE NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BehaviorRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BehaviorRecord_tenantId_idx" ON "BehaviorRecord"("tenantId");

-- CreateIndex
CREATE INDEX "BehaviorRecord_studentId_idx" ON "BehaviorRecord"("studentId");

-- CreateIndex
CREATE INDEX "BehaviorRecord_tenantId_studentId_idx" ON "BehaviorRecord"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "BehaviorRecord_tenantId_type_idx" ON "BehaviorRecord"("tenantId", "type");

-- CreateIndex
CREATE INDEX "BehaviorRecord_incidentDate_idx" ON "BehaviorRecord"("incidentDate");

-- AddForeignKey
ALTER TABLE "BehaviorRecord" ADD CONSTRAINT "BehaviorRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
