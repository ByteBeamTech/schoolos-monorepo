ALTER TABLE "FeePlanAssignment"
  ADD COLUMN "effectiveFrom" TIMESTAMP(3),
  ADD COLUMN "effectiveUntil" TIMESTAMP(3);

ALTER TABLE "FeeItem"
  ADD COLUMN IF NOT EXISTS "effectiveFrom" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "effectiveUntil" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "FeeItem_effective_window_idx"
  ON "FeeItem" ("feePlanId", "effectiveFrom", "effectiveUntil");

DROP INDEX IF EXISTS "FeePlanAssignment_scope_unique";

CREATE UNIQUE INDEX "FeePlanAssignment_active_scope_unique"
  ON "FeePlanAssignment" ("tenantId", "branchId", "sessionId", "classId", COALESCE("sectionId", '__CLASS_LEVEL__'))
  WHERE "effectiveUntil" IS NULL;
