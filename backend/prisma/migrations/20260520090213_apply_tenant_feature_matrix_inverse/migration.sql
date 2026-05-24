-- CreateTable
CREATE TABLE "TenantFeatureMatrix" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantFeatureMatrix_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantFeatureMatrix_tenantId_enabled_idx" ON "TenantFeatureMatrix"("tenantId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "TenantFeatureMatrix_tenantId_featureKey_key" ON "TenantFeatureMatrix"("tenantId", "featureKey");

-- AddForeignKey
ALTER TABLE "TenantFeatureMatrix" ADD CONSTRAINT "TenantFeatureMatrix_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
