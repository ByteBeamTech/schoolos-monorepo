-- CreateEnum
CREATE TYPE "CommercialTier" AS ENUM ('SELF_SERVICE', 'ASSISTED', 'ENTERPRISE');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "commercialTier" "CommercialTier" NOT NULL DEFAULT 'SELF_SERVICE';

-- AlterTable
ALTER TABLE "TenantSubscription" ADD COLUMN     "planVersion" INTEGER;
