-- CreateTable
CREATE TABLE "TenantJobSchedule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantJobSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantJobSchedule_nextRunAt_idx" ON "TenantJobSchedule"("nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "TenantJobSchedule_tenantId_jobName_key" ON "TenantJobSchedule"("tenantId", "jobName");

-- AddForeignKey
ALTER TABLE "TenantJobSchedule" ADD CONSTRAINT "TenantJobSchedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
