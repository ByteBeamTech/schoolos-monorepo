/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,academicYearId,classId,subjectId]` on the table `SubjectMapping` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `academicYearId` to the `SubjectMapping` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "SubjectMapping" DROP CONSTRAINT "SubjectMapping_classId_fkey";

-- DropForeignKey
ALTER TABLE "SubjectMapping" DROP CONSTRAINT "SubjectMapping_subjectId_fkey";

-- DropIndex
DROP INDEX "SubjectMapping_classId_idx";

-- DropIndex
DROP INDEX "SubjectMapping_subjectId_idx";

-- DropIndex
DROP INDEX "SubjectMapping_tenantId_classId_subjectId_key";

-- DropIndex
DROP INDEX "SubjectMapping_tenantId_idx";

-- AlterTable
ALTER TABLE "SubjectMapping" ADD COLUMN     "academicYearId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "SubjectMapping_academicYearId_idx" ON "SubjectMapping"("academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectMapping_tenantId_academicYearId_classId_subjectId_key" ON "SubjectMapping"("tenantId", "academicYearId", "classId", "subjectId");

-- AddForeignKey
ALTER TABLE "SubjectMapping" ADD CONSTRAINT "SubjectMapping_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectMapping" ADD CONSTRAINT "SubjectMapping_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectMapping" ADD CONSTRAINT "SubjectMapping_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
