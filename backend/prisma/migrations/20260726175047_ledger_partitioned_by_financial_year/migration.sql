/*
  Ledger table creation, per §4.7-4.9 of FINANCE_ARCHITECTURE_FREEZE_v1.2.md
  (frozen decisions 27-29). This migration is HAND-WRITTEN, not
  `prisma migrate dev`-generated: Prisma's schema DSL has no syntax for
  `PARTITION BY`, so the base shape is declared normally in
  ledger.prisma and this file adds the partitioning DDL Prisma cannot
  express.

  HONESTY NOTE, read before applying to any real environment: this
  migration has been validated for schema-level correctness (Prisma
  `validate`/`generate` succeed against it, and the DDL below follows
  standard, well-documented Postgres partitioning rules) but has NOT
  been execution-tested against a live Postgres instance -- this sandbox
  has no live database, only Prisma's client-generation path. Run this
  against a real staging database and confirm it applies cleanly, and
  confirm a row insert/read round-trips correctly, before this goes
  anywhere near production. That verification step is a hard
  requirement, not a formality.

  PARTITIONING RULE (Postgres, not a SchoolOS-specific choice): a
  partitioned table's PRIMARY KEY / UNIQUE constraints MUST include every
  partition key column. financialYear is the partition key (§4.7), so
  the primary key here is the composite (id, financialYear), not id
  alone. id (a cuid) remains globally unique by construction regardless
  -- this composite is a Postgres structural requirement for
  partitioning, not a weakening of uniqueness in practice.

  DEFAULT PARTITION: included as a safety net. Without one, an insert for
  a financialYear outside the explicitly created partitions FAILS
  outright rather than silently going anywhere -- which is correct
  fail-closed behavior, but a DEFAULT partition means that failure
  becomes "lands somewhere queryable and flagged" instead of "the write
  is rejected in production." Rows that land in the default partition are
  a signal a new year-specific partition is overdue, not an expected
  steady state.

  OPERATIONAL REQUIREMENT, not automated by this migration: a new
  year-specific partition MUST be created ahead of each 1 April financial
  year rollover (matching the boundary already established for
  InvoiceSequence/ReceiptSequence, D-2). This migration creates partitions
  covering FY2024 through FY2029 as a reasonable initial window; extending
  that window in future years is an operational task, not something this
  migration automates. Building that automation is explicitly out of
  scope for this milestone -- flagged here so it isn't silently forgotten,
  not undertaken now.
*/

-- CreateEnum
CREATE TYPE "LedgerEventType" AS ENUM ('PAYMENT_COMPLETED', 'REFUND_COMPLETED');

-- CreateTable (partitioned base table)
CREATE TABLE "Ledger" (
    "id"            TEXT NOT NULL,
    "tenantId"      TEXT NOT NULL,
    "branchId"      TEXT NOT NULL,
    "studentId"     TEXT,
    "financialYear" INTEGER NOT NULL,
    "eventType"     "LedgerEventType" NOT NULL,
    "amount"        DECIMAL(12,2) NOT NULL,
    "occurredAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referenceType" TEXT NOT NULL,
    "referenceId"   TEXT NOT NULL,
    "metadata"      JSONB,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ledger_pkey" PRIMARY KEY ("id", "financialYear")
) PARTITION BY RANGE ("financialYear");

-- CreateIndex (declared on the parent; Postgres propagates these to every
-- partition automatically, including ones created after this migration)
CREATE INDEX "Ledger_tenantId_financialYear_idx" ON "Ledger"("tenantId", "financialYear");
CREATE INDEX "Ledger_tenantId_branchId_financialYear_idx" ON "Ledger"("tenantId", "branchId", "financialYear");
CREATE INDEX "Ledger_studentId_idx" ON "Ledger"("studentId");
CREATE INDEX "Ledger_referenceType_referenceId_idx" ON "Ledger"("referenceType", "referenceId");
CREATE INDEX "Ledger_eventType_idx" ON "Ledger"("eventType");

-- AddForeignKey (propagates to every partition automatically, same as indexes)
ALTER TABLE "Ledger" ADD CONSTRAINT "Ledger_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreatePartitions: FY2024 (2024-04-01..2025-03-31) through FY2029
-- (2029-04-01..2030-03-31), plus DEFAULT as the fail-safe for anything
-- outside this window (see header note above).
CREATE TABLE "Ledger_fy2024" PARTITION OF "Ledger" FOR VALUES FROM (2024) TO (2025);
CREATE TABLE "Ledger_fy2025" PARTITION OF "Ledger" FOR VALUES FROM (2025) TO (2026);
CREATE TABLE "Ledger_fy2026" PARTITION OF "Ledger" FOR VALUES FROM (2026) TO (2027);
CREATE TABLE "Ledger_fy2027" PARTITION OF "Ledger" FOR VALUES FROM (2027) TO (2028);
CREATE TABLE "Ledger_fy2028" PARTITION OF "Ledger" FOR VALUES FROM (2028) TO (2029);
CREATE TABLE "Ledger_fy2029" PARTITION OF "Ledger" FOR VALUES FROM (2029) TO (2030);
CREATE TABLE "Ledger_default" PARTITION OF "Ledger" DEFAULT;
