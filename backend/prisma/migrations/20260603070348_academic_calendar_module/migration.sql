-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('NATIONAL_HOLIDAY', 'REGIONAL_HOLIDAY', 'SCHOOL_HOLIDAY', 'EXAM', 'PTM', 'RESULT_DAY', 'SPORTS_DAY', 'ANNUAL_FUNCTION', 'CULTURAL_EVENT', 'ACTIVITY', 'TRAINING', 'STAFF_MEETING', 'SPECIAL_CLASS', 'WORKING_DAY_OVERRIDE');

-- CreateEnum
CREATE TYPE "EventScope" AS ENUM ('ALL_SCHOOL', 'CLASS', 'SECTION', 'STREAM', 'HOUSE', 'STUDENTS', 'STAFF', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AudienceType" AS ENUM ('STUDENTS', 'STAFF', 'BOTH');

-- CreateTable
CREATE TABLE "AcademicCalendarEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "sessionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "CalendarEventType" NOT NULL,
    "scope" "EventScope" NOT NULL DEFAULT 'ALL_SCHOOL',
    "audience" "AudienceType" NOT NULL DEFAULT 'BOTH',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "isWorkingDay" BOOLEAN NOT NULL DEFAULT true,
    "blocksAttendance" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT DEFAULT '#2563eb',
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceRule" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicCalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicCalendarEventTarget" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "classId" TEXT,
    "sectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademicCalendarEventTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AcademicCalendarEvent_tenantId_idx" ON "AcademicCalendarEvent"("tenantId");

-- CreateIndex
CREATE INDEX "AcademicCalendarEvent_branchId_idx" ON "AcademicCalendarEvent"("branchId");

-- CreateIndex
CREATE INDEX "AcademicCalendarEvent_sessionId_idx" ON "AcademicCalendarEvent"("sessionId");

-- CreateIndex
CREATE INDEX "AcademicCalendarEvent_startDate_idx" ON "AcademicCalendarEvent"("startDate");

-- CreateIndex
CREATE INDEX "AcademicCalendarEvent_endDate_idx" ON "AcademicCalendarEvent"("endDate");

-- CreateIndex
CREATE INDEX "AcademicCalendarEvent_type_idx" ON "AcademicCalendarEvent"("type");

-- CreateIndex
CREATE INDEX "AcademicCalendarEvent_isPublished_idx" ON "AcademicCalendarEvent"("isPublished");

-- CreateIndex
CREATE INDEX "AcademicCalendarEventTarget_eventId_idx" ON "AcademicCalendarEventTarget"("eventId");

-- CreateIndex
CREATE INDEX "AcademicCalendarEventTarget_classId_idx" ON "AcademicCalendarEventTarget"("classId");

-- CreateIndex
CREATE INDEX "AcademicCalendarEventTarget_sectionId_idx" ON "AcademicCalendarEventTarget"("sectionId");

-- AddForeignKey
ALTER TABLE "AcademicCalendarEvent" ADD CONSTRAINT "AcademicCalendarEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicCalendarEvent" ADD CONSTRAINT "AcademicCalendarEvent_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicCalendarEvent" ADD CONSTRAINT "AcademicCalendarEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicCalendarEvent" ADD CONSTRAINT "AcademicCalendarEvent_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicCalendarEventTarget" ADD CONSTRAINT "AcademicCalendarEventTarget_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "AcademicCalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicCalendarEventTarget" ADD CONSTRAINT "AcademicCalendarEventTarget_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicCalendarEventTarget" ADD CONSTRAINT "AcademicCalendarEventTarget_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;
