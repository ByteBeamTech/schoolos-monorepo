/*
  Warnings:

  - The values [PENDING,IN_PROGRESS,COMPLETED,FAILED,SKIPPED,HOLD] on the enum `AdmissionStepStatus` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[userId]` on the table `StaffProfile` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `StaffProfile` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AdmissionStepStatus_new" AS ENUM ('UNDER_REVIEW', 'INQUIRY', 'DOCUMENT_UPLOAD', 'VERIFICATION', 'FEE_DEPOSIT', 'CONVERTED', 'WAITLISTED', 'REJECTED', 'WITHDRAWN');
ALTER TABLE "Admission" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Admission" ALTER COLUMN "status" TYPE "AdmissionStepStatus_new" USING ("status"::text::"AdmissionStepStatus_new");
ALTER TYPE "AdmissionStepStatus" RENAME TO "AdmissionStepStatus_old";
ALTER TYPE "AdmissionStepStatus_new" RENAME TO "AdmissionStepStatus";
DROP TYPE "AdmissionStepStatus_old";
ALTER TABLE "Admission" ALTER COLUMN "status" SET DEFAULT 'INQUIRY';
COMMIT;

-- AlterEnum
ALTER TYPE "NotificationChannel" ADD VALUE 'TELEGRAM';

-- AlterEnum
ALTER TYPE "NotificationStatus" ADD VALUE 'RETRYING';

-- AlterTable
ALTER TABLE "Admission" ALTER COLUMN "status" SET DEFAULT 'INQUIRY';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "staffId" TEXT;

-- AlterTable
ALTER TABLE "StaffProfile" ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "eventType" TEXT,
    "priority" "Priority",
    "channel" "NotificationChannel" NOT NULL,
    "recipient" TEXT NOT NULL,
    "provider" TEXT,
    "providerMessageId" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "traceId" TEXT,
    "workerId" TEXT,
    "error" TEXT,
    "metadata" JSONB,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "language" "Language" NOT NULL DEFAULT 'ENGLISH',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "variables" JSONB,
    "dltTemplateId" TEXT,
    "dltPeId" TEXT,
    "whatsappTemplateId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationPolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "channels" "NotificationChannel"[],
    "fallbackEnabled" BOOLEAN NOT NULL DEFAULT false,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventOutbox" (
    "id" TEXT NOT NULL,
    "uniqueKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationLog_tenantId_channel_idx" ON "NotificationLog"("tenantId", "channel");

-- CreateIndex
CREATE INDEX "NotificationLog_recipient_idx" ON "NotificationLog"("recipient");

-- CreateIndex
CREATE INDEX "NotificationLog_traceId_idx" ON "NotificationLog"("traceId");

-- CreateIndex
CREATE INDEX "CommunicationTemplate_tenantId_eventType_idx" ON "CommunicationTemplate"("tenantId", "eventType");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationPolicy_tenantId_eventType_key" ON "CommunicationPolicy"("tenantId", "eventType");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventOutbox_uniqueKey_key" ON "EventOutbox"("uniqueKey");

-- CreateIndex
CREATE INDEX "EventOutbox_status_nextRetryAt_idx" ON "EventOutbox"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "EventOutbox_type_idx" ON "EventOutbox"("type");

-- CreateIndex
CREATE INDEX "EventOutbox_createdAt_idx" ON "EventOutbox"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_userId_key" ON "StaffProfile"("userId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
