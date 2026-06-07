/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,eventType,channel,language]` on the table `CommunicationTemplate` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "CommunicationTemplate_tenantId_eventType_channel_language_key" ON "CommunicationTemplate"("tenantId", "eventType", "channel", "language");
