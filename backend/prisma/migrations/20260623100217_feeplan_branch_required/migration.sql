/*
  Warnings:

  - Made the column `branchId` on table `FeePlan` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "FeePlan" DROP CONSTRAINT "FeePlan_branchId_fkey";

-- AlterTable
ALTER TABLE "FeePlan" ALTER COLUMN "branchId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "FeePlan" ADD CONSTRAINT "FeePlan_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
