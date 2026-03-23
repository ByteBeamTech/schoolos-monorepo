-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "address" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "principal" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantBranding" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#1E40AF',
    "secondaryColor" TEXT NOT NULL DEFAULT '#DBEAFE',
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "portalTitle" TEXT,
    "tagline" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantBranding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantSecuritySettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionTimeoutMinutes" INTEGER NOT NULL DEFAULT 60,
    "requireMfaForAdmins" BOOLEAN NOT NULL DEFAULT false,
    "maxLoginAttempts" INTEGER NOT NULL DEFAULT 5,
    "allowedIpRanges" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enforcePasswordPolicy" BOOLEAN NOT NULL DEFAULT false,
    "passwordExpiryDays" INTEGER NOT NULL DEFAULT 90,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSecuritySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeType" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isMandatory" BOOLEAN NOT NULL DEFAULT false,
    "isRecurring" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeStructure" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "feeTypeId" TEXT,
    "frequency" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeStructure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Branch_tenantId_idx" ON "Branch"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_tenantId_name_key" ON "Branch"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TenantBranding_tenantId_key" ON "TenantBranding"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantSecuritySettings_tenantId_key" ON "TenantSecuritySettings"("tenantId");

-- CreateIndex
CREATE INDEX "FeeType_tenantId_idx" ON "FeeType"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "FeeType_tenantId_name_key" ON "FeeType"("tenantId", "name");

-- CreateIndex
CREATE INDEX "FeeStructure_tenantId_idx" ON "FeeStructure"("tenantId");

-- AddForeignKey
ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_feeTypeId_fkey" FOREIGN KEY ("feeTypeId") REFERENCES "FeeType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
