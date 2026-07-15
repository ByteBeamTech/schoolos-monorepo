/*
  Warnings:

  - You are about to drop the column `tier` on the `PricingPlan` table. All the data in the column will be lost.
  - You are about to drop the column `featureTier` on the `Tenant` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[code]` on the table `PricingPlan` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `code` to the `PricingPlan` table without a default value. This is not possible if the table is not empty.
  - Made the column `features` on table `PricingPlan` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "PlanCategory" AS ENUM ('SCHOOL', 'CHAIN', 'GOVERNMENT', 'NGO', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AddonCategory" AS ENUM ('SETUP', 'MIGRATION', 'TRAINING', 'SUPPORT', 'STORAGE', 'SMS', 'WHATSAPP', 'BRANCH', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AddonStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SubscriptionEventType" AS ENUM ('CREATED', 'TRIAL_STARTED', 'TRIAL_EXTENDED', 'ACTIVATED', 'PLAN_CHANGED', 'PRICE_OVERRIDDEN', 'PAYMENT_FAILED', 'PAYMENT_RECEIVED', 'RENEWED', 'SUSPENDED', 'RESUMED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BillingType" AS ENUM ('ONE_TIME', 'RECURRING');

-- DropIndex
DROP INDEX "PricingPlan_tier_currency_region_model_key";

-- DropIndex
DROP INDEX "TenantSubscription_tenantId_key";

-- AlterTable
ALTER TABLE "PricingPlan" DROP COLUMN "tier",
ADD COLUMN     "branchLimit" INTEGER,
ADD COLUMN     "category" "PlanCategory" NOT NULL DEFAULT 'SCHOOL',
ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "displayOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "effectiveTo" TIMESTAMP(3),
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "recommended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "staffLimit" INTEGER,
ADD COLUMN     "storageLimitGb" INTEGER,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "features" SET NOT NULL,
ALTER COLUMN "features" SET DEFAULT '{}';

-- AlterTable
ALTER TABLE "Tenant" DROP COLUMN "featureTier",
ADD COLUMN     "defaultPlanCode" TEXT DEFAULT 'ESSENTIAL';

-- AlterTable
ALTER TABLE "TenantSubscription" ADD COLUMN     "autoRenew" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "billingEmail" TEXT,
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "discountAmount" DECIMAL(12,2),
ADD COLUMN     "discountPercent" DECIMAL(5,2),
ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "isCurrent" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "planSnapshot" JSONB,
ADD COLUMN     "priceOverrideReason" TEXT,
ADD COLUMN     "renewalDate" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "statusChangedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "updatedBy" TEXT;

-- DropEnum
DROP TYPE "SubscriptionTier";

-- CreateTable
CREATE TABLE "SubscriptionEvent" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "SubscriptionEventType" NOT NULL,
    "oldStatus" "SubscriptionStatus",
    "newStatus" "SubscriptionStatus",
    "oldPlanId" TEXT,
    "newPlanId" TEXT,
    "actorId" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingAddon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "AddonCategory" NOT NULL,
    "billingType" "BillingType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PricingAddon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantAddon" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "addonId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "status" "AddonStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "TenantAddon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubscriptionEvent_subscriptionId_idx" ON "SubscriptionEvent"("subscriptionId");

-- CreateIndex
CREATE INDEX "SubscriptionEvent_tenantId_idx" ON "SubscriptionEvent"("tenantId");

-- CreateIndex
CREATE INDEX "SubscriptionEvent_type_idx" ON "SubscriptionEvent"("type");

-- CreateIndex
CREATE INDEX "SubscriptionEvent_createdAt_idx" ON "SubscriptionEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PricingAddon_code_key" ON "PricingAddon"("code");

-- CreateIndex
CREATE INDEX "PricingAddon_category_idx" ON "PricingAddon"("category");

-- CreateIndex
CREATE INDEX "PricingAddon_billingType_idx" ON "PricingAddon"("billingType");

-- CreateIndex
CREATE INDEX "PricingAddon_isActive_idx" ON "PricingAddon"("isActive");

-- CreateIndex
CREATE INDEX "TenantAddon_tenantId_idx" ON "TenantAddon"("tenantId");

-- CreateIndex
CREATE INDEX "TenantAddon_subscriptionId_idx" ON "TenantAddon"("subscriptionId");

-- CreateIndex
CREATE INDEX "TenantAddon_addonId_idx" ON "TenantAddon"("addonId");

-- CreateIndex
CREATE INDEX "TenantAddon_status_idx" ON "TenantAddon"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PricingPlan_code_key" ON "PricingPlan"("code");

-- CreateIndex
CREATE INDEX "TenantSubscription_tenantId_idx" ON "TenantSubscription"("tenantId");

-- CreateIndex
CREATE INDEX "TenantSubscription_planId_idx" ON "TenantSubscription"("planId");

-- CreateIndex
CREATE INDEX "TenantSubscription_renewalDate_idx" ON "TenantSubscription"("renewalDate");

-- CreateIndex
CREATE INDEX "TenantSubscription_trialEndsAt_idx" ON "TenantSubscription"("trialEndsAt");

-- AddForeignKey
ALTER TABLE "SubscriptionEvent" ADD CONSTRAINT "SubscriptionEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "TenantSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionEvent" ADD CONSTRAINT "SubscriptionEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAddon" ADD CONSTRAINT "TenantAddon_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAddon" ADD CONSTRAINT "TenantAddon_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "TenantSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAddon" ADD CONSTRAINT "TenantAddon_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "PricingAddon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
