/*
  Warnings:

  - A unique constraint covering the columns `[admissionNumber]` on the table `Student` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[aadharHash]` on the table `Student` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('SIBLING', 'COUSIN', 'RELATIVE', 'OTHER');

-- CreateEnum
CREATE TYPE "AdmissionMode" AS ENUM ('CRM', 'DIRECT');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'REVIEWED', 'APPROVED', 'REJECTED', 'CONVERTED');

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "aadharHash" TEXT,
ADD COLUMN     "aadharLast4" TEXT,
ADD COLUMN     "additionalDetails" JSONB,
ADD COLUMN     "admissionDate" TIMESTAMP(3),
ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "familyId" TEXT,
ADD COLUMN     "heightCm" DOUBLE PRECISION,
ADD COLUMN     "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastHealthCheck" TIMESTAMP(3),
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "previousClass" TEXT,
ADD COLUMN     "previousSchool" TEXT,
ADD COLUMN     "weightKg" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "familyName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentRelationship" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "studentId" TEXT NOT NULL,
    "relatedToId" TEXT NOT NULL,
    "type" "RelationType" NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedById" TEXT,
    "metadata" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionApplication" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "photoUrl" TEXT,
    "dob" TIMESTAMP(3) NOT NULL,
    "gender" TEXT NOT NULL,
    "aadharHash" TEXT,
    "aadharLast4" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "crmNo" TEXT NOT NULL,
    "admissionMode" "AdmissionMode" NOT NULL,
    "familyId" TEXT,
    "linkedRelativeId" TEXT,
    "relationType" "RelationType",
    "duplicateOfId" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "formDetails" JSONB,
    "notes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmissionApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Family_tenantId_idx" ON "Family"("tenantId");

-- CreateIndex
CREATE INDEX "Family_tenantId_branchId_idx" ON "Family"("tenantId", "branchId");

-- CreateIndex
CREATE INDEX "StudentRelationship_tenantId_idx" ON "StudentRelationship"("tenantId");

-- CreateIndex
CREATE INDEX "StudentRelationship_tenantId_branchId_studentId_idx" ON "StudentRelationship"("tenantId", "branchId", "studentId");

-- CreateIndex
CREATE INDEX "StudentRelationship_tenantId_branchId_relatedToId_idx" ON "StudentRelationship"("tenantId", "branchId", "relatedToId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentRelationship_studentId_relatedToId_key" ON "StudentRelationship"("studentId", "relatedToId");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionApplication_crmNo_key" ON "AdmissionApplication"("crmNo");

-- CreateIndex
CREATE INDEX "AdmissionApplication_tenantId_branchId_idx" ON "AdmissionApplication"("tenantId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_admissionNumber_key" ON "Student"("admissionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Student_aadharHash_key" ON "Student"("aadharHash");

-- CreateIndex
CREATE INDEX "Student_tenantId_branchId_idx" ON "Student"("tenantId", "branchId");

-- AddForeignKey
ALTER TABLE "StudentRelationship" ADD CONSTRAINT "StudentRelationship_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentRelationship" ADD CONSTRAINT "StudentRelationship_relatedToId_fkey" FOREIGN KEY ("relatedToId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionApplication" ADD CONSTRAINT "AdmissionApplication_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;
