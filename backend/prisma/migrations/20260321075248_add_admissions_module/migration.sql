-- CreateEnum
CREATE TYPE "AdmissionSource" AS ENUM ('GOOGLE', 'REFERRAL', 'WALK_IN', 'SOCIAL_MEDIA', 'DIRECT', 'EVENT', 'OTHER');

-- CreateTable
CREATE TABLE "Admission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "applyingForClass" TEXT NOT NULL,
    "source" "AdmissionSource" NOT NULL DEFAULT 'DIRECT',
    "status" "AdmissionStatus" NOT NULL DEFAULT 'INQUIRY',
    "counsellorId" TEXT,
    "notes" TEXT,
    "followUpDate" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "enrolledStudentId" TEXT,
    "academicYear" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionActivity" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdmissionActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Admission_tenantId_idx" ON "Admission"("tenantId");

-- CreateIndex
CREATE INDEX "Admission_status_idx" ON "Admission"("status");

-- CreateIndex
CREATE INDEX "Admission_counsellorId_idx" ON "Admission"("counsellorId");

-- CreateIndex
CREATE INDEX "AdmissionActivity_admissionId_idx" ON "AdmissionActivity"("admissionId");

-- CreateIndex
CREATE INDEX "AdmissionActivity_tenantId_idx" ON "AdmissionActivity"("tenantId");

-- AddForeignKey
ALTER TABLE "AdmissionActivity" ADD CONSTRAINT "AdmissionActivity_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
