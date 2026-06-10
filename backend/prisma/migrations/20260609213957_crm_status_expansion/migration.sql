/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `Guardian` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ApplicationStatus" ADD VALUE 'DRAFT';
ALTER TYPE "ApplicationStatus" ADD VALUE 'SUBMITTED';
ALTER TYPE "ApplicationStatus" ADD VALUE 'IN_REVIEW';
ALTER TYPE "ApplicationStatus" ADD VALUE 'ENROLLED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeadStatus" ADD VALUE 'FOLLOW_UP';
ALTER TYPE "LeadStatus" ADD VALUE 'VISIT_SCHEDULED';
ALTER TYPE "LeadStatus" ADD VALUE 'INTERESTED';
ALTER TYPE "LeadStatus" ADD VALUE 'APPLICATION_STARTED';
ALTER TYPE "LeadStatus" ADD VALUE 'APPLICATION_SUBMITTED';
ALTER TYPE "LeadStatus" ADD VALUE 'APPROVED';
ALTER TYPE "LeadStatus" ADD VALUE 'ENROLLED';

-- AlterTable
ALTER TABLE "AdmissionApplication" ADD COLUMN     "sessionId" TEXT;

-- AlterTable
ALTER TABLE "Guardian" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "sessionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Guardian_userId_key" ON "Guardian"("userId");

-- AddForeignKey
ALTER TABLE "AdmissionApplication" ADD CONSTRAINT "AdmissionApplication_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AcademicSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AcademicSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
