/*
  M9 (redesigned roadmap): FeeHead catalog.

  Three parts, in order: (1) create the AccountingNature enum and FeeHead
  table, (2) add InvoiceItem.feeHeadId (nullable, per the frozen spec --
  "Existing items are back-linked where the mapping is unambiguous; the
  free-text field is retained until M23"), (3) seed one default head per
  (tenant, branch) for each distinct chargeCategory value actually in use
  today (confirmed by direct search of the service code before writing
  this migration: only 'ACADEMIC' and 'TRANSPORT' are ever written),
  then back-link every existing InvoiceItem row whose chargeCategory
  matches one of those two.

  Execution-tested against real Postgres before trusting it, same
  discipline as every other migration in this stretch -- see the
  accompanying commit message for what was verified and how.
*/

-- CreateEnum
CREATE TYPE "AccountingNature" AS ENUM ('REVENUE', 'LIABILITY');

-- CreateTable
CREATE TABLE "FeeHead" (
    "id"               TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tenantId"         TEXT NOT NULL,
    "branchId"         TEXT NOT NULL,
    "name"             TEXT NOT NULL,
    "code"             TEXT NOT NULL,
    "accountingNature" "AccountingNature" NOT NULL,
    "isActive"         BOOLEAN NOT NULL DEFAULT true,
    "displayOrder"     INTEGER NOT NULL DEFAULT 0,
    "parentId"         TEXT,

    CONSTRAINT "FeeHead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeeHead_branchId_code_key" ON "FeeHead"("branchId", "code");
CREATE INDEX "FeeHead_tenantId_idx" ON "FeeHead"("tenantId");
CREATE INDEX "FeeHead_branchId_idx" ON "FeeHead"("branchId");
CREATE INDEX "FeeHead_parentId_idx" ON "FeeHead"("parentId");

-- AddForeignKey
ALTER TABLE "FeeHead" ADD CONSTRAINT "FeeHead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeeHead" ADD CONSTRAINT "FeeHead_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeeHead" ADD CONSTRAINT "FeeHead_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "FeeHead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: InvoiceItem gains feeHeadId, nullable
ALTER TABLE "InvoiceItem" ADD COLUMN "feeHeadId" TEXT;
CREATE INDEX "InvoiceItem_feeHeadId_idx" ON "InvoiceItem"("feeHeadId");
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_feeHeadId_fkey" FOREIGN KEY ("feeHeadId") REFERENCES "FeeHead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed: one Academic Fees head per (tenant, branch) that has ever issued
-- an invoice. ON CONFLICT guards re-running this migration idempotently
-- against the same (branchId, code) unique constraint above. Explicit
-- ::"AccountingNature" cast required: a plain text literal flowing
-- through SELECT (not a literal VALUES list) does not auto-cast to the
-- enum column type -- found by actually running this, not assumed.
INSERT INTO "FeeHead" ("tenantId", "branchId", "name", "code", "accountingNature", "displayOrder")
SELECT DISTINCT "tenantId", "branchId", 'Academic Fees', 'ACADEMIC', 'REVENUE'::"AccountingNature", 0
FROM "Invoice"
ON CONFLICT ("branchId", "code") DO NOTHING;

-- Seed: one Transport Fees head per (tenant, branch), same reasoning.
INSERT INTO "FeeHead" ("tenantId", "branchId", "name", "code", "accountingNature", "displayOrder")
SELECT DISTINCT "tenantId", "branchId", 'Transport Fees', 'TRANSPORT', 'REVENUE'::"AccountingNature", 1
FROM "Invoice"
ON CONFLICT ("branchId", "code") DO NOTHING;

-- Back-link: every existing InvoiceItem whose chargeCategory matches one
-- of the two seeded codes, scoped to the seeded head belonging to the
-- SAME branch as the item's own invoice (a head is branch-scoped, so this
-- must join through Invoice to get the right branch, not assume a global
-- single head per code). Postgres does not allow the JOIN...ON clause of
-- an UPDATE...FROM to reference the update target table itself (found by
-- actually running this) -- restructured to a comma-joined FROM list with
-- every join condition in WHERE instead, the standard correct pattern for
-- a multi-table UPDATE in Postgres.
UPDATE "InvoiceItem" ii
SET "feeHeadId" = fh."id"
FROM "Invoice" inv, "FeeHead" fh
WHERE ii."invoiceId" = inv."id"
  AND fh."tenantId" = inv."tenantId"
  AND fh."branchId" = inv."branchId"
  AND fh."code" = ii."chargeCategory"
  AND ii."chargeCategory" IN ('ACADEMIC', 'TRANSPORT')
  AND ii."feeHeadId" IS NULL;
