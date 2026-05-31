-- AlterTable
ALTER TABLE "AcademicSession" ADD COLUMN     "admissionsOpen" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "rollNumbersGenerated" BOOLEAN NOT NULL DEFAULT false;
