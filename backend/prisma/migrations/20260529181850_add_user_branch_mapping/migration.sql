/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,branchId,sessionId,name]` on the table `Class` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,classId,name]` on the table `Section` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `branchId` to the `Class` table without a default value. This is not possible if the table is not empty.
  - Added the required column `branchId` to the `Section` table without a default value. This is not possible if the table is not empty.
  - Added the required column `classId` to the `Student` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "GuardianRelation" ADD VALUE 'GRANDFATHER';
ALTER TYPE "GuardianRelation" ADD VALUE 'GRANDMOTHER';
ALTER TYPE "GuardianRelation" ADD VALUE 'UNCLE';
ALTER TYPE "GuardianRelation" ADD VALUE 'AUNT';
ALTER TYPE "GuardianRelation" ADD VALUE 'SIBLING';
ALTER TYPE "GuardianRelation" ADD VALUE 'LEGAL_GUARDIAN';

-- DropIndex
DROP INDEX "Class_tenantId_sessionId_name_key";

-- DropIndex
DROP INDEX "Section_classId_name_key";

-- DropIndex
DROP INDEX "Student_tenantId_aadharHash_key";

-- DropIndex
DROP INDEX "Student_tenantId_apaarId_key";

-- DropIndex
DROP INDEX "Student_tenantId_branchId_idx";

-- DropIndex
DROP INDEX "Student_tenantId_idx";

-- DropIndex
DROP INDEX "Student_tenantId_sectionId_idx";

-- AlterTable
ALTER TABLE "AdmissionApplication" ADD COLUMN     "sectionId" TEXT,
ADD COLUMN     "stepStatus" "AdmissionStepStatus" NOT NULL DEFAULT 'UNDER_REVIEW';

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "isPrimary" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "branchId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Section" ADD COLUMN     "branchId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "boardRegistrationNumber" TEXT,
ADD COLUMN     "classId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "UserBranch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBranch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserBranch_tenantId_idx" ON "UserBranch"("tenantId");

-- CreateIndex
CREATE INDEX "UserBranch_userId_idx" ON "UserBranch"("userId");

-- CreateIndex
CREATE INDEX "UserBranch_branchId_idx" ON "UserBranch"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBranch_userId_branchId_key" ON "UserBranch"("userId", "branchId");

-- CreateIndex
CREATE INDEX "Class_tenantId_branchId_sessionId_idx" ON "Class"("tenantId", "branchId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Class_tenantId_branchId_sessionId_name_key" ON "Class"("tenantId", "branchId", "sessionId", "name");

-- CreateIndex
CREATE INDEX "Section_tenantId_branchId_classId_idx" ON "Section"("tenantId", "branchId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "Section_tenantId_classId_name_key" ON "Section"("tenantId", "classId", "name");

-- CreateIndex
CREATE INDEX "Student_tenantId_branchId_classId_sectionId_idx" ON "Student"("tenantId", "branchId", "classId", "sectionId");

-- CreateIndex
CREATE INDEX "Student_tenantId_aadharHash_idx" ON "Student"("tenantId", "aadharHash");

-- CreateIndex
CREATE INDEX "Student_tenantId_apaarId_idx" ON "Student"("tenantId", "apaarId");

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBranch" ADD CONSTRAINT "UserBranch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBranch" ADD CONSTRAINT "UserBranch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBranch" ADD CONSTRAINT "UserBranch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
