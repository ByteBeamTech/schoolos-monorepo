/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,isCurrent]` on the table `TenantSubscription` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `tier` to the `PricingPlan` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('STARTER', 'PRO', 'ENTERPRISE');

-- AlterTable
ALTER TABLE "PricingPlan" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "tier" "SubscriptionTier" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "TenantSubscription_tenantId_isCurrent_key" ON "TenantSubscription"("tenantId", "isCurrent");
