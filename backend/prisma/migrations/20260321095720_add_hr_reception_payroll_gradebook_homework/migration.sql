-- CreateEnum
CREATE TYPE "PromotionStatus" AS ENUM ('PENDING', 'PROMOTED', 'DETAINED', 'MIGRATED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('PROMOTED', 'DETAINED', 'MIGRATED');

-- CreateEnum
CREATE TYPE "MigrationStatus" AS ENUM ('PENDING', 'APPROVED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IDCardType" AS ENUM ('STUDENT', 'STAFF');

-- CreateEnum
CREATE TYPE "IDCardStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'LOST', 'REPLACED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'SUBMITTED', 'LATE', 'GRADED', 'MISSING');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'VICE_PRINCIPAL';
ALTER TYPE "UserRole" ADD VALUE 'HR_MANAGER';
ALTER TYPE "UserRole" ADD VALUE 'RECEPTIONIST';
ALTER TYPE "UserRole" ADD VALUE 'TRANSPORT_MANAGER';

-- CreateTable
CREATE TABLE "StudentPromotion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fromSessionId" TEXT NOT NULL,
    "toSessionId" TEXT NOT NULL,
    "fromSectionId" TEXT NOT NULL,
    "toSectionId" TEXT,
    "status" "PromotionStatus" NOT NULL DEFAULT 'PENDING',
    "promotionType" "PromotionType" NOT NULL,
    "averageMarks" DOUBLE PRECISION,
    "passingMarks" DOUBLE PRECISION,
    "remarks" TEXT,
    "processedBy" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentPromotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fromClassId" TEXT NOT NULL,
    "toClassId" TEXT NOT NULL,
    "passingMarks" DOUBLE PRECISION NOT NULL DEFAULT 33,
    "requireAllPass" BOOLEAN NOT NULL DEFAULT false,
    "autoPromote" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentMigration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "targetSchoolName" TEXT NOT NULL,
    "targetSchoolCode" TEXT,
    "migrationDate" TIMESTAMP(3) NOT NULL,
    "transferCertUrl" TEXT,
    "reason" TEXT,
    "status" "MigrationStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentMigration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IDCard" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" "IDCardType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "qrCode" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "templateId" TEXT,
    "photoUrl" TEXT,
    "status" "IDCardStatus" NOT NULL DEFAULT 'ACTIVE',
    "printedAt" TIMESTAMP(3),
    "printedBy" TEXT,
    "replacedCardId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IDCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IDCardTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "IDCardType" NOT NULL,
    "frontDesign" JSONB NOT NULL,
    "backDesign" JSONB,
    "width" INTEGER NOT NULL DEFAULT 86,
    "height" INTEGER NOT NULL DEFAULT 54,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IDCardTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alumni" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "graduationYear" INTEGER NOT NULL,
    "lastClass" TEXT NOT NULL,
    "lastSection" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "gender" "Gender",
    "photoUrl" TEXT,
    "currentOccupation" TEXT,
    "currentCompany" TEXT,
    "currentCity" TEXT,
    "linkedInUrl" TEXT,
    "achievements" JSONB,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alumni_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "permissionId" TEXT NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "grantedBy" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeBoundary" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "minMark" DECIMAL(5,2) NOT NULL,
    "maxMark" DECIMAL(5,2) NOT NULL,
    "remark" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GradeBoundary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Homework" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" DATE NOT NULL,
    "maxMarks" INTEGER,
    "attachments" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Homework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkSubmission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "homeworkId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "marksGiven" INTEGER,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeworkSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalWorkflowConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workflowType" TEXT NOT NULL,
    "levels" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalWorkflowConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JoiningRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "candidateName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "department" TEXT,
    "proposedSalary" DECIMAL(12,2),
    "resumeUrl" TEXT,
    "documents" JSONB,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "currentLevel" INTEGER NOT NULL DEFAULT 1,
    "maxLevel" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JoiningRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JoiningApproval" (
    "id" TEXT NOT NULL,
    "joiningRequestId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "approverRole" TEXT NOT NULL,
    "approverId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "comments" TEXT,
    "actionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JoiningApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffLeave" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "leaveType" TEXT NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "totalDays" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffLeave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveBalance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "leaveType" TEXT NOT NULL,
    "totalDays" INTEGER NOT NULL DEFAULT 0,
    "usedDays" INTEGER NOT NULL DEFAULT 0,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollStructure" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "basicSalary" DECIMAL(12,2) NOT NULL,
    "hra" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "da" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherAllowances" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pfEmployee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pfEmployer" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "esi" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tds" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "effectiveFrom" DATE NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "structureId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "workingDays" INTEGER NOT NULL DEFAULT 26,
    "presentDays" INTEGER NOT NULL DEFAULT 26,
    "basicPaid" DECIMAL(12,2) NOT NULL,
    "hraPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "daPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherAllowances" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grossSalary" DECIMAL(12,2) NOT NULL,
    "pfDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "esiDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tdsDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherDeductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netSalary" DECIMAL(12,2) NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "paidAt" TIMESTAMP(3),
    "payslipUrl" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Complaint" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "complainantName" TEXT NOT NULL,
    "complainantPhone" TEXT,
    "complainantEmail" TEXT,
    "complainantType" TEXT NOT NULL,
    "relatedStudentId" TEXT,
    "relatedStaffId" TEXT,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "assignedTo" TEXT,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplaintActivity" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplaintActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visitor" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "passNumber" TEXT NOT NULL,
    "visitorName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "idType" TEXT,
    "idNumber" TEXT,
    "photoUrl" TEXT,
    "company" TEXT,
    "purpose" TEXT NOT NULL,
    "personToMeet" TEXT NOT NULL,
    "personToMeetId" TEXT,
    "department" TEXT,
    "expectedDuration" INTEGER,
    "vehicleNumber" TEXT,
    "remarks" TEXT,
    "checkIn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOut" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'CHECKED_IN',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Visitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAttendance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "checkIn" TIMESTAMP(3),
    "checkOut" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentPromotion_tenantId_idx" ON "StudentPromotion"("tenantId");

-- CreateIndex
CREATE INDEX "StudentPromotion_studentId_idx" ON "StudentPromotion"("studentId");

-- CreateIndex
CREATE INDEX "StudentPromotion_fromSessionId_idx" ON "StudentPromotion"("fromSessionId");

-- CreateIndex
CREATE INDEX "PromotionRule_tenantId_idx" ON "PromotionRule"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionRule_tenantId_sessionId_fromClassId_key" ON "PromotionRule"("tenantId", "sessionId", "fromClassId");

-- CreateIndex
CREATE INDEX "StudentMigration_tenantId_idx" ON "StudentMigration"("tenantId");

-- CreateIndex
CREATE INDEX "StudentMigration_studentId_idx" ON "StudentMigration"("studentId");

-- CreateIndex
CREATE INDEX "IDCard_tenantId_idx" ON "IDCard"("tenantId");

-- CreateIndex
CREATE INDEX "IDCard_entityType_entityId_idx" ON "IDCard"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "IDCard_qrCode_idx" ON "IDCard"("qrCode");

-- CreateIndex
CREATE UNIQUE INDEX "IDCard_tenantId_cardNumber_key" ON "IDCard"("tenantId", "cardNumber");

-- CreateIndex
CREATE INDEX "IDCardTemplate_tenantId_idx" ON "IDCardTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "Alumni_tenantId_idx" ON "Alumni"("tenantId");

-- CreateIndex
CREATE INDEX "Alumni_graduationYear_idx" ON "Alumni"("graduationYear");

-- CreateIndex
CREATE INDEX "Alumni_email_idx" ON "Alumni"("email");

-- CreateIndex
CREATE INDEX "Permission_module_idx" ON "Permission"("module");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_module_action_key" ON "Permission"("module", "action");

-- CreateIndex
CREATE INDEX "RolePermission_tenantId_idx" ON "RolePermission"("tenantId");

-- CreateIndex
CREATE INDEX "RolePermission_role_idx" ON "RolePermission"("role");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_tenantId_role_permissionId_key" ON "RolePermission"("tenantId", "role", "permissionId");

-- CreateIndex
CREATE INDEX "UserPermission_tenantId_idx" ON "UserPermission"("tenantId");

-- CreateIndex
CREATE INDEX "UserPermission_userId_idx" ON "UserPermission"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermission_tenantId_userId_permissionId_key" ON "UserPermission"("tenantId", "userId", "permissionId");

-- CreateIndex
CREATE INDEX "GradeBoundary_tenantId_sessionId_idx" ON "GradeBoundary"("tenantId", "sessionId");

-- CreateIndex
CREATE INDEX "Homework_tenantId_idx" ON "Homework"("tenantId");

-- CreateIndex
CREATE INDEX "Homework_classId_idx" ON "Homework"("classId");

-- CreateIndex
CREATE INDEX "Homework_dueDate_idx" ON "Homework"("dueDate");

-- CreateIndex
CREATE INDEX "HomeworkSubmission_tenantId_idx" ON "HomeworkSubmission"("tenantId");

-- CreateIndex
CREATE INDEX "HomeworkSubmission_studentId_idx" ON "HomeworkSubmission"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "HomeworkSubmission_homeworkId_studentId_key" ON "HomeworkSubmission"("homeworkId", "studentId");

-- CreateIndex
CREATE INDEX "ApprovalWorkflowConfig_tenantId_idx" ON "ApprovalWorkflowConfig"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalWorkflowConfig_tenantId_workflowType_key" ON "ApprovalWorkflowConfig"("tenantId", "workflowType");

-- CreateIndex
CREATE INDEX "JoiningRequest_tenantId_idx" ON "JoiningRequest"("tenantId");

-- CreateIndex
CREATE INDEX "JoiningRequest_status_idx" ON "JoiningRequest"("status");

-- CreateIndex
CREATE INDEX "JoiningApproval_joiningRequestId_idx" ON "JoiningApproval"("joiningRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "JoiningApproval_joiningRequestId_level_key" ON "JoiningApproval"("joiningRequestId", "level");

-- CreateIndex
CREATE INDEX "StaffLeave_tenantId_idx" ON "StaffLeave"("tenantId");

-- CreateIndex
CREATE INDEX "StaffLeave_staffId_idx" ON "StaffLeave"("staffId");

-- CreateIndex
CREATE INDEX "LeaveBalance_tenantId_idx" ON "LeaveBalance"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveBalance_tenantId_staffId_leaveType_year_key" ON "LeaveBalance"("tenantId", "staffId", "leaveType", "year");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollStructure_staffId_key" ON "PayrollStructure"("staffId");

-- CreateIndex
CREATE INDEX "PayrollStructure_tenantId_idx" ON "PayrollStructure"("tenantId");

-- CreateIndex
CREATE INDEX "PayrollEntry_tenantId_idx" ON "PayrollEntry"("tenantId");

-- CreateIndex
CREATE INDEX "PayrollEntry_staffId_idx" ON "PayrollEntry"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollEntry_tenantId_staffId_month_year_key" ON "PayrollEntry"("tenantId", "staffId", "month", "year");

-- CreateIndex
CREATE INDEX "Complaint_tenantId_idx" ON "Complaint"("tenantId");

-- CreateIndex
CREATE INDEX "Complaint_status_idx" ON "Complaint"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Complaint_tenantId_ticketNumber_key" ON "Complaint"("tenantId", "ticketNumber");

-- CreateIndex
CREATE INDEX "ComplaintActivity_complaintId_idx" ON "ComplaintActivity"("complaintId");

-- CreateIndex
CREATE INDEX "Visitor_tenantId_idx" ON "Visitor"("tenantId");

-- CreateIndex
CREATE INDEX "Visitor_status_idx" ON "Visitor"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Visitor_tenantId_passNumber_key" ON "Visitor"("tenantId", "passNumber");

-- CreateIndex
CREATE INDEX "StaffAttendance_tenantId_idx" ON "StaffAttendance"("tenantId");

-- CreateIndex
CREATE INDEX "StaffAttendance_staffId_idx" ON "StaffAttendance"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAttendance_tenantId_staffId_date_key" ON "StaffAttendance"("tenantId", "staffId", "date");

-- AddForeignKey
ALTER TABLE "PromotionRule" ADD CONSTRAINT "PromotionRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IDCard" ADD CONSTRAINT "IDCard_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IDCardTemplate" ADD CONSTRAINT "IDCardTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alumni" ADD CONSTRAINT "Alumni_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalWorkflowConfig" ADD CONSTRAINT "ApprovalWorkflowConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoiningRequest" ADD CONSTRAINT "JoiningRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoiningApproval" ADD CONSTRAINT "JoiningApproval_joiningRequestId_fkey" FOREIGN KEY ("joiningRequestId") REFERENCES "JoiningRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "PayrollStructure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintActivity" ADD CONSTRAINT "ComplaintActivity_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visitor" ADD CONSTRAINT "Visitor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
