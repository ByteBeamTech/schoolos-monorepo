-- CreateEnum
CREATE TYPE "CommunicationChannel" AS ENUM ('SMS', 'EMAIL', 'WHATSAPP', 'PUSH', 'IN_APP');

-- CreateEnum
CREATE TYPE "CommunicationRecipient" AS ENUM ('STUDENT', 'GUARDIAN', 'STAFF', 'TENANT_ADMIN', 'BULK');

-- CreateEnum
CREATE TYPE "CommunicationTrigger" AS ENUM ('FEE_REMINDER', 'FEE_RECEIPT', 'ATTENDANCE_ALERT', 'EXAM_RESULT', 'HOMEWORK_ASSIGNED', 'BROADCAST', 'MANUAL', 'SYSTEM_ALERT', 'WELCOME', 'PASSWORD_RESET', 'FEATURE_FLAG_CHANGE');

-- CreateEnum
CREATE TYPE "CommunicationStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BulkJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "CommunicationLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "initiatedBy" TEXT NOT NULL,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" "CommunicationChannel" NOT NULL,
    "templateId" TEXT,
    "subject" TEXT,
    "bodyPreview" TEXT,
    "recipientType" "CommunicationRecipient" NOT NULL,
    "recipientId" TEXT,
    "recipientRef" TEXT,
    "triggerType" "CommunicationTrigger" NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "status" "CommunicationStatus" NOT NULL DEFAULT 'QUEUED',
    "queuedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "providerRef" TEXT,
    "costUnits" INTEGER,
    "costAmount" DECIMAL(10,4),
    "bulkJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkNotificationJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerType" "CommunicationTrigger" NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "templateId" TEXT,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "queuedCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "status" "BulkJobStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulkNotificationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommunicationLog_tenantId_channel_status_idx" ON "CommunicationLog"("tenantId", "channel", "status");

-- CreateIndex
CREATE INDEX "CommunicationLog_tenantId_recipientId_idx" ON "CommunicationLog"("tenantId", "recipientId");

-- CreateIndex
CREATE INDEX "CommunicationLog_tenantId_triggerType_idx" ON "CommunicationLog"("tenantId", "triggerType");

-- CreateIndex
CREATE INDEX "CommunicationLog_tenantId_initiatedAt_idx" ON "CommunicationLog"("tenantId", "initiatedAt");

-- CreateIndex
CREATE INDEX "CommunicationLog_bulkJobId_idx" ON "CommunicationLog"("bulkJobId");

-- CreateIndex
CREATE INDEX "CommunicationLog_providerRef_idx" ON "CommunicationLog"("providerRef");

-- CreateIndex
CREATE INDEX "BulkNotificationJob_tenantId_status_idx" ON "BulkNotificationJob"("tenantId", "status");

-- CreateIndex
CREATE INDEX "BulkNotificationJob_tenantId_createdAt_idx" ON "BulkNotificationJob"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "FraudAlert_createdAt_idx" ON "FraudAlert"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_tenantId_status_idx" ON "Notification"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Notification_tenantId_recipientId_status_idx" ON "Notification"("tenantId", "recipientId", "status");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "StudentDailyCount_date_idx" ON "StudentDailyCount"("date");

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_bulkJobId_fkey" FOREIGN KEY ("bulkJobId") REFERENCES "BulkNotificationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkNotificationJob" ADD CONSTRAINT "BulkNotificationJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
