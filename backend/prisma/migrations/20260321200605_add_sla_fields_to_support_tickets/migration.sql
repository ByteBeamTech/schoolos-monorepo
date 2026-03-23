-- AlterTable
ALTER TABLE "SupportTicket" ADD COLUMN     "escalationLevel" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "firstResponseAt" TIMESTAMP(3),
ADD COLUMN     "lastEscalatedAt" TIMESTAMP(3),
ADD COLUMN     "slaResolutionBreached" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slaResolutionDueAt" TIMESTAMP(3),
ADD COLUMN     "slaResponseBreached" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slaResponseDueAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "SupportTicket_slaResponseBreached_idx" ON "SupportTicket"("slaResponseBreached");

-- CreateIndex
CREATE INDEX "SupportTicket_slaResolutionBreached_idx" ON "SupportTicket"("slaResolutionBreached");
