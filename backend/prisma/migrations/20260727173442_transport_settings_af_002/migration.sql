-- CreateEnum
CREATE TYPE "CapacityEnforcementMode" AS ENUM ('STRICT', 'ALLOW_OVERBOOK_WITH_APPROVAL', 'SOFT_WARNING');

-- CreateEnum
CREATE TYPE "TransportAttendanceMode" AS ENUM ('MANUAL', 'APP_BASED');

-- CreateEnum
CREATE TYPE "TripGenerationMode" AS ENUM ('AUTOMATIC', 'MANUAL');

-- CreateTable
CREATE TABLE "TransportSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "capacityEnforcementMode" "CapacityEnforcementMode" NOT NULL DEFAULT 'STRICT',
    "capacityBufferSeats" INTEGER NOT NULL DEFAULT 0,
    "allowMultipleActiveAssignments" BOOLEAN NOT NULL DEFAULT false,
    "requireApprovalForMidSessionTransfer" BOOLEAN NOT NULL DEFAULT false,
    "tripGenerationMode" "TripGenerationMode" NOT NULL DEFAULT 'AUTOMATIC',
    "tripGenerationLeadDays" INTEGER NOT NULL DEFAULT 1,
    "attendanceMode" "TransportAttendanceMode" NOT NULL DEFAULT 'MANUAL',
    "complianceExpiryReminderDays" INTEGER NOT NULL DEFAULT 30,
    "licenseExpiryReminderDays" INTEGER NOT NULL DEFAULT 30,
    "feeReminderDaysBeforeDue" INTEGER NOT NULL DEFAULT 7,
    "routeSuspendRequiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "routeSuspendNotifyGuardians" BOOLEAN NOT NULL DEFAULT true,
    "feeRevisionRequiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "feeRevisionMinNoticeDays" INTEGER NOT NULL DEFAULT 7,
    "followAcademicCalendarHolidays" BOOLEAN NOT NULL DEFAULT true,
    "runTripsOnHalfDays" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransportSettings_branchId_key" ON "TransportSettings"("branchId");

-- CreateIndex
CREATE INDEX "TransportSettings_tenantId_idx" ON "TransportSettings"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TransportSettings_tenantId_branchId_key" ON "TransportSettings"("tenantId", "branchId");

-- AddForeignKey
ALTER TABLE "TransportSettings" ADD CONSTRAINT "TransportSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportSettings" ADD CONSTRAINT "TransportSettings_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
