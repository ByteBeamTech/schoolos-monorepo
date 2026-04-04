/*
  Warnings:

  - Added the required column `updatedAt` to the `Admission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `StockItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Admission" ADD COLUMN     "aadhaarNumber" TEXT,
ADD COLUMN     "aadhaarUrl" TEXT,
ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "admissionFeePaid" BOOLEAN,
ADD COLUMN     "allergies" TEXT,
ADD COLUMN     "apaarId" TEXT,
ADD COLUMN     "applyingClassId" TEXT,
ADD COLUMN     "birthCertificateUrl" TEXT,
ADD COLUMN     "bloodGroup" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "disability" TEXT,
ADD COLUMN     "discountNotes" TEXT,
ADD COLUMN     "emergencyContactName" TEXT,
ADD COLUMN     "emergencyContactPhone" TEXT,
ADD COLUMN     "enrolledStudentId" TEXT,
ADD COLUMN     "fatherEmail" TEXT,
ADD COLUMN     "fatherIncome" DOUBLE PRECISION,
ADD COLUMN     "fatherName" TEXT,
ADD COLUMN     "fatherOccupation" TEXT,
ADD COLUMN     "fatherPhone" TEXT,
ADD COLUMN     "followUpDate" TIMESTAMP(3),
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "guardianName" TEXT,
ADD COLUMN     "guardianPhone" TEXT,
ADD COLUMN     "guardianRelation" TEXT,
ADD COLUMN     "lastPercentage" DOUBLE PRECISION,
ADD COLUMN     "marksheetUrl" TEXT,
ADD COLUMN     "medicalConditions" TEXT,
ADD COLUMN     "middleName" TEXT,
ADD COLUMN     "motherEmail" TEXT,
ADD COLUMN     "motherIncome" DOUBLE PRECISION,
ADD COLUMN     "motherName" TEXT,
ADD COLUMN     "motherOccupation" TEXT,
ADD COLUMN     "motherPhone" TEXT,
ADD COLUMN     "nationality" TEXT DEFAULT 'Indian',
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paymentReference" TEXT,
ADD COLUMN     "penNumber" TEXT,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "pickupLocation" TEXT,
ADD COLUMN     "pincode" TEXT,
ADD COLUMN     "previousClass" TEXT,
ADD COLUMN     "previousSchoolName" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "religion" TEXT,
ADD COLUMN     "scholarship" BOOLEAN,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "tcIssueDate" TIMESTAMP(3),
ADD COLUMN     "tcNumber" TEXT,
ADD COLUMN     "tcUrl" TEXT,
ADD COLUMN     "transportRequired" BOOLEAN,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "StockItem" ADD COLUMN     "category" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "admissionActivity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admissionActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admissionStepLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admissionStepLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "cost" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenanceLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "issue" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "cost" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenanceLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admissionActivity_tenantId_idx" ON "admissionActivity"("tenantId");

-- CreateIndex
CREATE INDEX "admissionActivity_admissionId_idx" ON "admissionActivity"("admissionId");

-- CreateIndex
CREATE INDEX "admissionStepLog_tenantId_idx" ON "admissionStepLog"("tenantId");

-- CreateIndex
CREATE INDEX "admissionStepLog_admissionId_idx" ON "admissionStepLog"("admissionId");

-- CreateIndex
CREATE INDEX "admissionStepLog_step_idx" ON "admissionStepLog"("step");

-- CreateIndex
CREATE INDEX "asset_tenantId_idx" ON "asset"("tenantId");

-- CreateIndex
CREATE INDEX "asset_category_idx" ON "asset"("category");

-- CreateIndex
CREATE INDEX "maintenanceLog_tenantId_idx" ON "maintenanceLog"("tenantId");

-- CreateIndex
CREATE INDEX "maintenanceLog_assetId_idx" ON "maintenanceLog"("assetId");

-- CreateIndex
CREATE INDEX "Admission_tenantId_idx" ON "Admission"("tenantId");

-- CreateIndex
CREATE INDEX "Admission_branchId_idx" ON "Admission"("branchId");

-- CreateIndex
CREATE INDEX "Admission_status_idx" ON "Admission"("status");

-- CreateIndex
CREATE INDEX "Admission_source_idx" ON "Admission"("source");

-- CreateIndex
CREATE INDEX "StockItem_tenantId_idx" ON "StockItem"("tenantId");

-- AddForeignKey
ALTER TABLE "admissionActivity" ADD CONSTRAINT "admissionActivity_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissionStepLog" ADD CONSTRAINT "admissionStepLog_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenanceLog" ADD CONSTRAINT "maintenanceLog_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
