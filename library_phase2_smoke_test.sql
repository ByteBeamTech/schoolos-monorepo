-- ============================================================
-- Library Phase 2 (ADR-LIB-001) smoke test
-- ============================================================
-- Non-destructive: everything runs inside one transaction that is
-- explicitly ROLLBACK'd at the end, whether it passes or fails.
-- Nothing it does is left behind in your database.
--
-- Run it with:
--   psql "$DATABASE_URL" -f library_phase2_smoke_test.sql
--
-- Or, from the `backend` package, reusing your existing env:
--   npx dotenv -e .env -- psql "$DATABASE_URL" -f library_phase2_smoke_test.sql
--
-- What this DOES cover:
--   1. Schema shape -- the new tables/columns exist, the old ones
--      (Book.totalCopies etc., BookIssue.bookId/studentId) are gone.
--   2. The partial unique index actually rejects a second OPEN
--      BookIssue for the same BookCopy -- this is the structural,
--      DB-level fix for audit finding C1, proven directly rather than
--      taken on faith.
--   3. That the same index does NOT block a copy being issued again
--      after a previous issue on it was returned (i.e. it constrains
--      concurrency, not history).
--
-- What this does NOT cover (needs the running API, not raw SQL):
--   - The BookCopyService.transitionCopyStatus() legal-transition
--     table (e.g. rejecting AVAILABLE -> DISPOSED) is enforced in
--     application code, not a DB constraint -- exercise it by calling
--     the actual endpoints, not this script.
--   - The advisory-lock path in LibraryService.issueBook()/
--     returnBook() (true concurrent-request behavior) -- see the
--     "REAL CONCURRENCY TEST" section at the bottom of this file for
--     how to exercise that against your running server.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Schema shape
-- ------------------------------------------------------------
DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'BookCopy'
  ), 'FAIL: "BookCopy" table is missing';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'BarcodeSequence'
  ), 'FAIL: "BarcodeSequence" table is missing';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'BookIssue' AND column_name = 'copyId'
  ), 'FAIL: "BookIssue"."copyId" is missing';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'BookIssue' AND column_name = 'borrowerType'
  ), 'FAIL: "BookIssue"."borrowerType" is missing';

  ASSERT NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'BookIssue' AND column_name = 'bookId'
  ), 'FAIL: "BookIssue"."bookId" should have been dropped in Phase 2';

  ASSERT NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'BookIssue' AND column_name = 'studentId'
  ), 'FAIL: "BookIssue"."studentId" should have been dropped in Phase 2';

  ASSERT NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Book' AND column_name = 'totalCopies'
  ), 'FAIL: "Book"."totalCopies" should have been dropped in Phase 2';

  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'BookIssue_copyId_open_issue_key'
  ), 'FAIL: the partial unique index is missing -- C1 is NOT fixed at the DB level';

  RAISE NOTICE 'PASS: schema shape looks correct';
END $$;

-- ------------------------------------------------------------
-- 2. Fixture -- reuse an existing tenant/branch, create one
--    throwaway Book + BookCopy. borrowerId/issuedBy are plain
--    strings with no FK (ADR SS2 -- polymorphic, no FK), so no real
--    Student/Staff/User row is needed for this test.
-- ------------------------------------------------------------
DO $$
DECLARE
  v_tenant_id  TEXT;
  v_branch_id  TEXT;
  v_book_id    TEXT;
  v_copy_id    TEXT;
  v_issue1_id  TEXT;
  v_issue2_id  TEXT;
  v_dupe_failed BOOLEAN := false;
BEGIN
  SELECT id INTO v_tenant_id FROM "Tenant" LIMIT 1;
  SELECT id INTO v_branch_id FROM "Branch" WHERE "tenantId" = v_tenant_id LIMIT 1;

  IF v_tenant_id IS NULL OR v_branch_id IS NULL THEN
    RAISE EXCEPTION 'FAIL: no existing Tenant/Branch row found to attach the smoke-test fixture to';
  END IF;

  v_book_id := 'smoketest_book_' || substr(md5(random()::text), 1, 12);
  INSERT INTO "Book" ("id", "tenantId", "title", "createdAt", "updatedAt")
  VALUES (v_book_id, v_tenant_id, 'SMOKE TEST BOOK -- safe to ignore', now(), now());

  v_copy_id := 'smoketest_copy_' || substr(md5(random()::text), 1, 12);
  INSERT INTO "BookCopy" ("id", "tenantId", "branchId", "bookId", "barcode", "status", "createdAt", "updatedAt")
  VALUES (v_copy_id, v_tenant_id, v_branch_id, v_book_id, 'SMOKETEST-' || v_copy_id, 'AVAILABLE', now(), now());

  RAISE NOTICE 'PASS: fixture created (tenant=%, branch=%, book=%, copy=%)', v_tenant_id, v_branch_id, v_book_id, v_copy_id;

  -- --------------------------------------------------------
  -- 3. First issue succeeds
  -- --------------------------------------------------------
  v_issue1_id := 'smoketest_issue_' || substr(md5(random()::text), 1, 12);
  INSERT INTO "BookIssue" (
    "id", "tenantId", "branchId", "copyId",
    "borrowerType", "borrowerId", "borrowerNameSnapshot",
    "dueDate", "issuedBy", "status"
  ) VALUES (
    v_issue1_id, v_tenant_id, v_branch_id, v_copy_id,
    'STUDENT', 'smoketest-borrower', 'Smoke Test Borrower',
    now() + interval '14 days', 'smoketest-actor', 'ISSUED'
  );
  RAISE NOTICE 'PASS: first ISSUED row for this copy inserted successfully';

  -- --------------------------------------------------------
  -- 4. THE ACTUAL PROOF: a second OPEN issue for the SAME copy
  --    must be rejected by BookIssue_copyId_open_issue_key.
  -- --------------------------------------------------------
  BEGIN
    v_issue2_id := 'smoketest_issue_dupe_' || substr(md5(random()::text), 1, 12);
    INSERT INTO "BookIssue" (
      "id", "tenantId", "branchId", "copyId",
      "borrowerType", "borrowerId", "borrowerNameSnapshot",
      "dueDate", "issuedBy", "status"
    ) VALUES (
      v_issue2_id, v_tenant_id, v_branch_id, v_copy_id,
      'STUDENT', 'smoketest-borrower-2', 'Second Smoke Test Borrower',
      now() + interval '14 days', 'smoketest-actor', 'ISSUED'
    );
  EXCEPTION WHEN unique_violation THEN
    v_dupe_failed := true;
    RAISE NOTICE 'PASS: second concurrent ISSUED row for the same copy was correctly REJECTED (%)', SQLERRM;
  END;

  IF NOT v_dupe_failed THEN
    RAISE EXCEPTION 'FAIL: a second ISSUED BookIssue for the same copy was allowed -- C1 is NOT fixed';
  END IF;

  -- --------------------------------------------------------
  -- 5. After returning the first issue, a NEW issue on the same
  --    copy must be allowed -- the index constrains concurrency,
  --    not history.
  -- --------------------------------------------------------
  UPDATE "BookIssue" SET "status" = 'RETURNED', "returnedAt" = now()
  WHERE "id" = v_issue1_id;

  INSERT INTO "BookIssue" (
    "id", "tenantId", "branchId", "copyId",
    "borrowerType", "borrowerId", "borrowerNameSnapshot",
    "dueDate", "issuedBy", "status"
  ) VALUES (
    'smoketest_issue_reissue_' || substr(md5(random()::text), 1, 12),
    v_tenant_id, v_branch_id, v_copy_id,
    'STUDENT', 'smoketest-borrower-3', 'Third Smoke Test Borrower',
    now() + interval '14 days', 'smoketest-actor', 'ISSUED'
  );
  RAISE NOTICE 'PASS: re-issuing the same copy after a return succeeded (index does not block history)';

  RAISE NOTICE '=== ALL SMOKE TESTS PASSED ===';
END $$;

-- Nothing above is kept, regardless of pass/fail.
ROLLBACK;

-- ============================================================
-- REAL CONCURRENCY TEST (optional, exercises the advisory lock too,
-- not just the index) -- run against your running dev server, not
-- via psql. Needs a valid bearer token and a book with exactly one
-- AVAILABLE copy at your branch.
--
--   TOKEN="<your dev JWT>"
--   BOOK_ID="<a bookId with exactly 1 AVAILABLE copy>"
--
--   # Fire two issue requests for the SAME book at the same instant.
--   # Expect: one 201/200 success, one 400 ("no longer available" or
--   # "just issued by someone else") -- never two successes.
--   curl -s -X POST http://localhost:3000/library/issue \
--     -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
--     -H "x-branch-id: <your branchId>" \
--     -d "{\"bookId\":\"$BOOK_ID\",\"borrowerType\":\"STUDENT\",\"borrowerId\":\"<a real studentId>\"}" \
--     & \
--   curl -s -X POST http://localhost:3000/library/issue \
--     -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
--     -H "x-branch-id: <your branchId>" \
--     -d "{\"bookId\":\"$BOOK_ID\",\"borrowerType\":\"STUDENT\",\"borrowerId\":\"<a different real studentId>\"}" \
--     & \
--   wait
-- ============================================================
