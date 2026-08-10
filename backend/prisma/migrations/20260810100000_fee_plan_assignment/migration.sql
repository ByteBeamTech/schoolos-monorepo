/*
  Phase 3 (Fee Plan Assignment + Billing Period Calculation, frozen).

  FeeAssignment is retired, not repurposed -- a fundamentally different
  entity replaces it. Before this migration was written, all real
  consumers were found and confirmed migrated in the same commit:
  FeePlansService.assign() (retired -- student-level plan ownership
  contradicts the frozen V1 rule), FeePlansService.getStudentFeePlans()/
  getStudentFeeSummary() (refactored to resolve via class/section), and
  InvoiceService.bulkGenerate() (refactored to resolve students via
  FeePlanAssignment -> Student, not a per-student assignment row).

  No BillingPeriod or BillingPeriodSchedule table -- per the frozen
  decision, billing periods are a pure runtime calculation over
  AcademicSession + BillingRule, never persisted.

  FK ON DELETE behaviors matched to this schema's own established
  convention, confirmed directly against existing migrations rather than
  assumed: required FKs (classId, sessionId, feePlanId, tenantId,
  branchId) use RESTRICT, matching FeePlan_sessionId_fkey and
  Student_classId_fkey. The nullable sectionId FK uses SET NULL, matching
  Student_sectionId_fkey.
*/

-- DropForeignKey (old FeeAssignment's FKs, before dropping the table)
ALTER TABLE "FeeAssignment" DROP CONSTRAINT IF EXISTS "FeeAssignment_feePlanId_fkey";
ALTER TABLE "FeeAssignment" DROP CONSTRAINT IF EXISTS "FeeAssignment_studentId_fkey";
ALTER TABLE "FeeAssignment" DROP CONSTRAINT IF EXISTS "FeeAssignment_branchId_fkey";

-- DropTable
DROP TABLE "FeeAssignment";

-- CreateTable
CREATE TABLE "FeePlanAssignment" (
    "id"          TEXT NOT NULL,
    "tenantId"    TEXT NOT NULL,
    "branchId"    TEXT NOT NULL,
    "sessionId"   TEXT NOT NULL,
    "feePlanId"   TEXT NOT NULL,
    "classId"     TEXT NOT NULL,
    "sectionId"   TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "FeePlanAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeePlanAssignment_tenantId_branchId_sessionId_classId_idx" ON "FeePlanAssignment"("tenantId", "branchId", "sessionId", "classId");
CREATE INDEX "FeePlanAssignment_tenantId_feePlanId_idx" ON "FeePlanAssignment"("tenantId", "feePlanId");

-- CreateIndex: prevents duplicate assignments for the same
-- tenant/session/class/section scope. COALESCE-based, not a plain
-- @@unique -- the identical NULL-handling lesson already learned on
-- LateFeeRule's own scope constraint: a plain unique index on a
-- nullable sectionId would NOT catch two class-level assignments
-- (sectionId both NULL) for the same class+session, since Postgres
-- treats NULL as never equal to NULL. Coalescing to a sentinel value
-- that can never be a real cuid closes that gap.
CREATE UNIQUE INDEX "FeePlanAssignment_scope_unique"
  ON "FeePlanAssignment" ("tenantId", "sessionId", "classId", COALESCE("sectionId", '__CLASS_LEVEL__'));

-- AddForeignKey
ALTER TABLE "FeePlanAssignment" ADD CONSTRAINT "FeePlanAssignment_tenantId_fkey"  FOREIGN KEY ("tenantId")  REFERENCES "Tenant"("id")          ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeePlanAssignment" ADD CONSTRAINT "FeePlanAssignment_branchId_fkey"  FOREIGN KEY ("branchId")  REFERENCES "Branch"("id")          ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeePlanAssignment" ADD CONSTRAINT "FeePlanAssignment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeePlanAssignment" ADD CONSTRAINT "FeePlanAssignment_feePlanId_fkey" FOREIGN KEY ("feePlanId") REFERENCES "FeePlan"("id")          ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeePlanAssignment" ADD CONSTRAINT "FeePlanAssignment_classId_fkey"   FOREIGN KEY ("classId")   REFERENCES "Class"("id")           ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeePlanAssignment" ADD CONSTRAINT "FeePlanAssignment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id")         ON DELETE SET NULL ON UPDATE CASCADE;
