-- CreateEnum
CREATE TYPE "NotificationProviderMode" AS ENUM ('SCHOOL_PROVIDER', 'BYTEBEAM_MANAGED');

-- CreateTable
CREATE TABLE "NotificationSetting" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "providerMode" "NotificationProviderMode" NOT NULL DEFAULT 'SCHOOL_PROVIDER',
    "smsProvider" TEXT,
    "emailProvider" TEXT,
    "whatsappProvider" TEXT,
    "smsConfig" JSONB,
    "emailConfig" JSONB,
    "whatsappConfig" JSONB,
    "senderName" TEXT,
    "replyTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSetting_tenantId_key" ON "NotificationSetting"("tenantId");

-- CreateIndex
CREATE INDEX "NotificationSetting_tenantId_idx" ON "NotificationSetting"("tenantId");

-- AddForeignKey
ALTER TABLE "NotificationSetting" ADD CONSTRAINT "NotificationSetting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
