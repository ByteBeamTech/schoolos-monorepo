/*
  Warnings:

  - You are about to drop the column `addressLine` on the `Admission` table. All the data in the column will be lost.
  - You are about to drop the column `alternatePhone` on the `Admission` table. All the data in the column will be lost.
  - You are about to drop the column `applyingForClass` on the `Admission` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `Admission` table. All the data in the column will be lost.
  - You are about to drop the column `counsellorId` on the `Admission` table. All the data in the column will be lost.
  - You are about to drop the column `dateOfBirth` on the `Admission` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `Admission` table. All the data in the column will be lost.
  - You are about to drop the column `enrolledStudentId` on the `Admission` table. All the data in the column will be lost.
  - You are about to drop the column `followUpDate` on the `Admission` table. All the data in the column will be lost.
  - You are about to drop the column `gender` on the `Admission` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `Admission` table. All the data in the column will be lost.
  - You are about to drop the column `parentEmail` on the `Admission` table. All the data in the column will be lost.
  - You are about to drop the column `parentFirstName` on the `Admission` table. All the data in the column will be lost.
  - You are about to drop the column `parentLastName` on the `Admission` table. All the data in the column will be lost.
  - You are about to drop the column `parentPhone` on the `Admission` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `Admission` table. All the data in the column will be lost.
  - You are about to drop the column `pincode` on the `Admission` table. All the data in the column will be lost.
  - You are about to drop the column `previousSchool` on the `Admission` table. All the data in the column will be lost.
  - You are about to drop the column `rejectionReason` on the `Admission` table. All the data in the column will be lost.
  - You are about to drop the column `source` on the `Admission` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `Admission` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Admission` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `StockItem` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `StockItem` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `StockItem` table. All the data in the column will be lost.
  - You are about to drop the column `minQuantity` on the `StockItem` table. All the data in the column will be lost.
  - You are about to drop the column `unit` on the `StockItem` table. All the data in the column will be lost.
  - You are about to drop the column `unitCost` on the `StockItem` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `StockItem` table. All the data in the column will be lost.
  - You are about to drop the `AdmissionActivity` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Asset` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MaintenanceLog` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `branchId` to the `Admission` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AdmissionStatus" ADD VALUE 'DOCUMENT_UPLOAD';
ALTER TYPE "AdmissionStatus" ADD VALUE 'VERIFICATION';
ALTER TYPE "AdmissionStatus" ADD VALUE 'FEE_DEPOSIT';

-- DropForeignKey
ALTER TABLE "AdmissionActivity" DROP CONSTRAINT "AdmissionActivity_admissionId_fkey";

-- DropForeignKey
ALTER TABLE "MaintenanceLog" DROP CONSTRAINT "MaintenanceLog_assetId_fkey";

-- DropIndex
DROP INDEX "Admission_counsellorId_idx";

-- DropIndex
DROP INDEX "Admission_status_idx";

-- DropIndex
DROP INDEX "Admission_tenantId_idx";

-- DropIndex
DROP INDEX "StockItem_category_idx";

-- DropIndex
DROP INDEX "StockItem_tenantId_idx";

-- AlterTable
ALTER TABLE "Admission" DROP COLUMN "addressLine",
DROP COLUMN "alternatePhone",
DROP COLUMN "applyingForClass",
DROP COLUMN "city",
DROP COLUMN "counsellorId",
DROP COLUMN "dateOfBirth",
DROP COLUMN "email",
DROP COLUMN "enrolledStudentId",
DROP COLUMN "followUpDate",
DROP COLUMN "gender",
DROP COLUMN "notes",
DROP COLUMN "parentEmail",
DROP COLUMN "parentFirstName",
DROP COLUMN "parentLastName",
DROP COLUMN "parentPhone",
DROP COLUMN "phone",
DROP COLUMN "pincode",
DROP COLUMN "previousSchool",
DROP COLUMN "rejectionReason",
DROP COLUMN "source",
DROP COLUMN "state",
DROP COLUMN "updatedAt",
ADD COLUMN     "branchId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "StockItem" DROP COLUMN "category",
DROP COLUMN "createdAt",
DROP COLUMN "location",
DROP COLUMN "minQuantity",
DROP COLUMN "unit",
DROP COLUMN "unitCost",
DROP COLUMN "updatedAt";

-- DropTable
DROP TABLE "AdmissionActivity";

-- DropTable
DROP TABLE "Asset";

-- DropTable
DROP TABLE "MaintenanceLog";

-- DropEnum
DROP TYPE "AdmissionSource";
