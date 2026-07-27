-- ADR-LIB-001 Phase 2: physical inventory core.
-- Book -> BookCopy (branch-scoped) -> BookIssue (copyId, not bookId).
-- See docs/architecture/library/LIBRARY_DOMAIN_ARCHITECTURE_FREEZE.md
-- SS3/SS7/SS12/SS17 and docs/architecture/library/IMPLEMENTATION_STATE.md
-- for the backfill rationale. This app is in development, so this
-- migration performs a full, non-reversible cutover in one pass
-- rather than a dual-write/expand-contract rollout.
--
-- OPERATIONAL NOTE: the explicit BEGIN/COMMIT around the BookIssueStatus
-- enum swap (step 1) is Prisma's own required pattern for changing an
-- enum's values, and it commits independently of the rest of this file.
-- If anything after that COMMIT fails (including the guard in step 6),
-- the enum change stays applied but the rest of this migration rolls
-- back -- the DB is left in a partially-migrated state. On a dev
-- database that is recoverable with `prisma migrate reset`; this is
-- accepted here specifically because the app is pre-production (see
-- IMPLEMENTATION_STATE.md) and is not a pattern to repeat once this
-- module carries real tenant data.

-- ============================================================
-- 1. BookIssueStatus: drop OVERDUE (computed-only per ADR SS7/SS8,
--    never persisted) and DAMAGED (moves to BookCopy.status), add
--    WRITTEN_OFF. Fix up existing rows before the type swap so the
--    USING cast below never hits a value the new enum doesn't have.
-- ============================================================
UPDATE "BookIssue" SET "status" = 'ISSUED' WHERE "status" = 'OVERDUE';
UPDATE "BookIssue" SET "status" = 'RETURNED' WHERE "status" = 'DAMAGED';

-- AlterEnum
BEGIN;
CREATE TYPE "BookIssueStatus_new" AS ENUM ('ISSUED', 'RETURNED', 'LOST', 'WRITTEN_OFF');
ALTER TABLE "BookIssue" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "BookIssue" ALTER COLUMN "status" TYPE "BookIssueStatus_new" USING ("status"::text::"BookIssueStatus_new");
ALTER TYPE "BookIssueStatus" RENAME TO "BookIssueStatus_old";
ALTER TYPE "BookIssueStatus_new" RENAME TO "BookIssueStatus";
DROP TYPE "BookIssueStatus_old";
ALTER TABLE "BookIssue" ALTER COLUMN "status" SET DEFAULT 'ISSUED';
COMMIT;

-- ============================================================
-- 2. New enums for Phase 2
-- ============================================================

-- CreateEnum
CREATE TYPE "BookCopyStatus" AS ENUM ('AVAILABLE', 'RESERVED_HOLD', 'ISSUED', 'LOST', 'DAMAGED', 'IN_REPAIR', 'DISPOSED');

-- CreateEnum
CREATE TYPE "BorrowerType" AS ENUM ('STUDENT', 'STAFF');

-- ============================================================
-- 3. BookCopy + BarcodeSequence tables
-- ============================================================

-- CreateTable
CREATE TABLE "BookCopy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "rfidTag" TEXT,
    "shelfId" TEXT,
    "status" "BookCopyStatus" NOT NULL DEFAULT 'AVAILABLE',
    "condition" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BookCopy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarcodeSequence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BarcodeSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookCopy_tenantId_barcode_key" ON "BookCopy"("tenantId", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "BookCopy_rfidTag_key" ON "BookCopy"("rfidTag");

-- CreateIndex
CREATE INDEX "BookCopy_tenantId_branchId_status_idx" ON "BookCopy"("tenantId", "branchId", "status");

-- CreateIndex
CREATE INDEX "BookCopy_bookId_idx" ON "BookCopy"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "BarcodeSequence_tenantId_branchId_year_key" ON "BarcodeSequence"("tenantId", "branchId", "year");

-- CreateIndex
CREATE INDEX "BarcodeSequence_tenantId_branchId_idx" ON "BarcodeSequence"("tenantId", "branchId");

-- AddForeignKey
ALTER TABLE "BookCopy" ADD CONSTRAINT "BookCopy_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookCopy" ADD CONSTRAINT "BookCopy_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookCopy" ADD CONSTRAINT "BookCopy_shelfId_fkey" FOREIGN KEY ("shelfId") REFERENCES "Shelf"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarcodeSequence" ADD CONSTRAINT "BarcodeSequence_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- 4. Backfill: one BookCopy per unit of Book.totalCopies.
--    Branch attribution defaults to the tenant's primary branch (or
--    its earliest-created branch) since the pre-Phase-2 Book model
--    had no branch concept -- this cannot be inferred from data that
--    was never captured. Review/redistribute per-branch manually if a
--    legacy catalog actually spanned multiple branches.
--    Books belonging to a tenant with zero Branch rows get zero
--    copies (defensive skip, not a NULL branchId) -- caught by the
--    guard in step 6 below.
-- ============================================================
INSERT INTO "BookCopy" ("id", "tenantId", "branchId", "bookId", "barcode", "status", "createdAt", "updatedAt")
SELECT
  substr(md5(random()::text || clock_timestamp()::text || b.id || gs.n::text), 1, 24),
  b."tenantId",
  COALESCE(
    (SELECT br.id FROM "Branch" br WHERE br."tenantId" = b."tenantId" AND br."isPrimary" = true ORDER BY br."createdAt" ASC LIMIT 1),
    (SELECT br.id FROM "Branch" br WHERE br."tenantId" = b."tenantId" ORDER BY br."createdAt" ASC LIMIT 1)
  ),
  b.id,
  'LEGACY-' || b.id || '-' || gs.n,
  CASE WHEN gs.n <= GREATEST(b."totalCopies" - b."availableCopies", 0) THEN 'ISSUED' ELSE 'AVAILABLE' END::"BookCopyStatus",
  now(),
  now()
FROM "Book" b
CROSS JOIN LATERAL generate_series(1, GREATEST(b."totalCopies", 1)) AS gs(n)
WHERE EXISTS (SELECT 1 FROM "Branch" br WHERE br."tenantId" = b."tenantId");

-- ============================================================
-- 5. Backfill Author / Publisher / BookCategory from Book's legacy
--    free-text columns (deferred from Phase 1 to here, per
--    IMPLEMENTATION_STATE.md), before those columns are dropped.
--    One row per distinct free-text value -- no name-splitting
--    attempted for multi-author strings, conservative by design.
-- ============================================================
INSERT INTO "Author" ("id", "tenantId", "name", "createdAt", "updatedAt")
SELECT DISTINCT
  substr(md5(random()::text || clock_timestamp()::text || b."tenantId" || b."author"), 1, 24),
  b."tenantId", btrim(b."author"), now(), now()
FROM "Book" b
WHERE b."author" IS NOT NULL AND btrim(b."author") <> '';

INSERT INTO "BookAuthor" ("bookId", "authorId")
SELECT b.id, a.id
FROM "Book" b
JOIN "Author" a ON a."tenantId" = b."tenantId" AND a."name" = btrim(b."author")
WHERE b."author" IS NOT NULL AND btrim(b."author") <> '';

INSERT INTO "Publisher" ("id", "tenantId", "name", "createdAt", "updatedAt")
SELECT DISTINCT
  substr(md5(random()::text || clock_timestamp()::text || b."tenantId" || b."publisher"), 1, 24),
  b."tenantId", btrim(b."publisher"), now(), now()
FROM "Book" b
WHERE b."publisher" IS NOT NULL AND btrim(b."publisher") <> '';

UPDATE "Book" b SET "publisherId" = p.id
FROM "Publisher" p
WHERE p."tenantId" = b."tenantId" AND p."name" = btrim(b."publisher")
  AND b."publisher" IS NOT NULL AND btrim(b."publisher") <> '';

INSERT INTO "BookCategory" ("id", "tenantId", "name", "createdAt", "updatedAt")
SELECT DISTINCT
  substr(md5(random()::text || clock_timestamp()::text || b."tenantId" || b."subject"), 1, 24),
  b."tenantId", btrim(b."subject"), now(), now()
FROM "Book" b
WHERE b."subject" IS NOT NULL AND btrim(b."subject") <> '';

UPDATE "Book" b SET "categoryId" = c.id
FROM "BookCategory" c
WHERE c."tenantId" = b."tenantId" AND c."parentId" IS NULL AND c."name" = btrim(b."subject")
  AND b."subject" IS NOT NULL AND btrim(b."subject") <> '';

-- ============================================================
-- 6. BookIssue: add Phase 2 columns, backfill, then tighten.
-- ============================================================

-- AlterTable
ALTER TABLE "BookIssue"
  ADD COLUMN "copyId" TEXT,
  ADD COLUMN "branchId" TEXT,
  ADD COLUMN "borrowerType" "BorrowerType" NOT NULL DEFAULT 'STUDENT',
  ADD COLUMN "borrowerId" TEXT,
  ADD COLUMN "borrowerNameSnapshot" TEXT,
  ADD COLUMN "borrowerBranchIdSnapshot" TEXT,
  ADD COLUMN "borrowerDisplayIdSnapshot" TEXT,
  ADD COLUMN "renewalCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "returnedBy" TEXT;

-- Borrower snapshot backfill. All pre-Phase-2 issues were student-only
-- (the old schema had no staff borrowing at all), so borrowerType's
-- default of 'STUDENT' is correct for every existing row without
-- further action.
UPDATE "BookIssue" bi SET
  "borrowerId" = bi."studentId",
  "borrowerNameSnapshot" = btrim(COALESCE(s."firstName", '') || ' ' || COALESCE(s."lastName", '')),
  "borrowerBranchIdSnapshot" = s."branchId",
  "borrowerDisplayIdSnapshot" = s."admissionNumber"
FROM "Student" s
WHERE s.id = bi."studentId";

-- Any legacy studentId that no longer resolves to a Student row (the
-- old schema had no real FK on studentId, so this is possible) gets a
-- placeholder snapshot instead of a NULL, since these columns are
-- NOT NULL going forward -- surfaced explicitly rather than silently
-- dropped.
UPDATE "BookIssue" SET
  "borrowerId" = COALESCE(NULLIF("borrowerId", ''), "studentId"),
  "borrowerNameSnapshot" = 'Unknown (legacy record)'
WHERE "borrowerId" IS NULL OR btrim(COALESCE("borrowerNameSnapshot", '')) = '';

-- Copy assignment, step 1: every currently-OPEN issue (status =
-- 'ISSUED') gets a unique copy of the same book. This guarantees the
-- partial-unique invariant (step 8 below) holds from the instant it
-- is created.
WITH ranked_issues AS (
  SELECT bi.id AS issue_id, bi."bookId",
         row_number() OVER (PARTITION BY bi."bookId" ORDER BY bi."issuedAt" ASC) AS rn
  FROM "BookIssue" bi
  WHERE bi."status" = 'ISSUED'
),
ranked_copies AS (
  SELECT bc.id AS copy_id, bc."bookId", bc."branchId",
         row_number() OVER (PARTITION BY bc."bookId" ORDER BY bc.id ASC) AS rn
  FROM "BookCopy" bc
  WHERE bc."status" = 'ISSUED'
)
UPDATE "BookIssue" bi
SET "copyId" = rc.copy_id, "branchId" = rc."branchId"
FROM ranked_issues ri
JOIN ranked_copies rc ON rc."bookId" = ri."bookId" AND rc.rn = ri.rn
WHERE bi.id = ri.issue_id;

-- Copy assignment, step 2: every remaining (non-open) historical
-- issue is attached to *some* copy of the correct book, cycling
-- through that book's copies. Safe for history -- many closed issues
-- legitimately share one copy's lifetime -- because the partial
-- unique index only constrains status = 'ISSUED' rows, which step 1
-- already assigned uniquely.
WITH numbered_issues AS (
  SELECT bi.id AS issue_id, bi."bookId",
         row_number() OVER (PARTITION BY bi."bookId" ORDER BY bi."issuedAt" ASC) - 1 AS idx
  FROM "BookIssue" bi
  WHERE bi."copyId" IS NULL
),
numbered_copies AS (
  SELECT bc.id AS copy_id, bc."bookId", bc."branchId",
         row_number() OVER (PARTITION BY bc."bookId" ORDER BY bc.id ASC) - 1 AS idx,
         count(*) OVER (PARTITION BY bc."bookId") AS cnt
  FROM "BookCopy" bc
)
UPDATE "BookIssue" bi
SET "copyId" = nc.copy_id, "branchId" = nc."branchId"
FROM numbered_issues ni
JOIN numbered_copies nc ON nc."bookId" = ni."bookId" AND nc.cnt > 0 AND nc.idx = (ni.idx % nc.cnt)
WHERE bi.id = ni.issue_id;

-- Fail loudly rather than silently ship a corrupt row: this can only
-- happen for a Book whose tenant had zero Branch rows (step 4's
-- defensive skip), which is a pre-existing data problem this
-- migration should not paper over.
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT count(*) INTO orphan_count FROM "BookIssue" WHERE "copyId" IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Library Phase 2 backfill: % BookIssue row(s) could not be matched to a BookCopy (likely a tenant with zero Branch rows). Resolve manually, then re-run this migration.', orphan_count;
  END IF;
END $$;

-- Tighten now that every row is populated.
ALTER TABLE "BookIssue"
  ALTER COLUMN "copyId" SET NOT NULL,
  ALTER COLUMN "branchId" SET NOT NULL,
  ALTER COLUMN "borrowerId" SET NOT NULL,
  ALTER COLUMN "borrowerNameSnapshot" SET NOT NULL,
  ALTER COLUMN "borrowerType" DROP DEFAULT;

-- DropIndex (superseded by the composite index created in step 7)
DROP INDEX "BookIssue_status_idx";

-- AlterTable (drop legacy columns -- auto-drops their FK/index)
ALTER TABLE "BookIssue" DROP COLUMN "bookId";
ALTER TABLE "BookIssue" DROP COLUMN "studentId";

-- AddForeignKey
ALTER TABLE "BookIssue" ADD CONSTRAINT "BookIssue_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "BookCopy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- 7. New BookIssue indexes (ADR SS17)
-- ============================================================

-- CreateIndex
CREATE INDEX "BookIssue_tenantId_branchId_status_dueDate_idx" ON "BookIssue"("tenantId", "branchId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "BookIssue_copyId_idx" ON "BookIssue"("copyId");

-- CreateIndex
CREATE INDEX "BookIssue_borrowerType_borrowerId_idx" ON "BookIssue"("borrowerType", "borrowerId");

-- ============================================================
-- 8. Partial unique index -- the structural fix for the double-issue
--    race (audit finding C1): at most one OPEN issue per BookCopy,
--    enforced by Postgres itself. Cannot be expressed in
--    schema.prisma (no partial-index attribute) -- see the NOTE on
--    the BookCopy model in library.prisma. Do not drop this via a
--    future `prisma migrate dev`/`db push` without re-adding it by
--    hand in the same migration.
--    If this CREATE fails, it means the legacy dev data already had
--    more open BookIssue rows for some book than
--    (totalCopies - availableCopies) implied -- i.e. the exact kind of
--    counter drift the audit's C1/C2 findings predicted. On a dev
--    database, the practical fix is `prisma migrate reset` and
--    re-seeding rather than hand-reconciling pre-Phase-2 test data.
-- ============================================================
CREATE UNIQUE INDEX "BookIssue_copyId_open_issue_key" ON "BookIssue"("copyId") WHERE "status" = 'ISSUED';

-- ============================================================
-- 9. Drop Book's legacy columns now that BookCopy / Author /
--    Publisher / BookCategory fully replace what they held.
-- ============================================================
ALTER TABLE "Book" DROP COLUMN "author";
ALTER TABLE "Book" DROP COLUMN "publisher";
ALTER TABLE "Book" DROP COLUMN "subject";
ALTER TABLE "Book" DROP COLUMN "totalCopies";
ALTER TABLE "Book" DROP COLUMN "availableCopies";
ALTER TABLE "Book" DROP COLUMN "location";
