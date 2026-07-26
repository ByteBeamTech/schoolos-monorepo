#!/usr/bin/env bash
# ============================================================================
# SchoolOS — Student Billing — Official Regression Suite
# ============================================================================
# Every route and DTO field verified directly against the committed backend
# source (controllers + DTOs), not assumed. Dry-run validated end-to-end
# against a local mock server, in both an intentionally-racy and a
# properly-locked configuration, before ever being pointed at a real API --
# see docs/STUDENT_BILLING_REGRESSION_GUIDE.md for the full methodology.
#
# Run:      bash qa/student-billing-regression-suite.sh 2>&1 | tee audit-output.txt
# Requires: curl, jq, bc
# Optional: DB_URL (a psql-compatible connection string) for direct-database
#           cross-checks in addition to the API-based verification that
#           always runs. Unset by default -- those specific checks report
#           SKIPPED, not FAIL, when it's absent.
#
# See docs/STUDENT_BILLING_REGRESSION_GUIDE.md for prerequisites, required
# environment variables, and how to interpret the output.
# ============================================================================

set -uo pipefail
API="${API_BASE:-https://api-cell.bytebeamtech.com/api/v1}"
TENANT="${TENANT_ID:-demo-school}"
LOGIN_EMAIL="${LOGIN_EMAIL:-admin@demo-school.com}"
LOGIN_PASSWORD="${LOGIN_PASSWORD:-Demo@123!}"
PERF_THRESHOLD_MS="${PERF_THRESHOLD_MS:-1000}"

# Required for any test that creates an invoice, payment, or discount --
# students and academic sessions are outside student-billing's own API
# surface, so this script cannot discover or create a valid one itself.
# Left unset, every test that would need one is marked NOT_APPLICABLE (not
# skipped, and never worked around by mutating a pre-existing real record).
STUDENT_ID="${STUDENT_ID:-}"
SESSION_ID="${SESSION_ID:-}"
ACADEMIC_YEAR="${ACADEMIC_YEAR:-2026-2027}"
DUE_DATE="${DUE_DATE:-2026-08-15}"

# Every piece of test data this run creates is named/referenced using this
# ID, so re-running the script never collides with a prior run's data and
# nothing this script creates is ever ambiguous with pre-existing demo
# records. $RANDOM alone is not cryptographically unique, but is more than
# sufficient to avoid same-second collisions for a manually or CI-invoked
# regression run.
RUN_ID="$(date +%s)-$RANDOM"
echo "Run ID for this execution: $RUN_ID (every created record is tagged with this)"

# ============================================================================
# Framework
# ============================================================================
TOTAL=0; PASS_COUNT=0; FAIL_COUNT=0; SKIP_COUNT=0; NA_COUNT=0
declare -a FAILED_TESTS=()
declare -A CATEGORY_TOTAL=(); declare -A CATEGORY_FAIL=()
CURRENT_CATEGORY="uncategorized"

category() {
  CURRENT_CATEGORY="$1"
  CATEGORY_TOTAL["$CURRENT_CATEGORY"]=0
  CATEGORY_FAIL["$CURRENT_CATEGORY"]=0
  echo -e "\n\n========== $1 =========="
}

# http_call METHOD URL [BODY] -- sets HTTP_STATUS, HTTP_BODY, HTTP_TIME_MS.
# Always runs in the calling shell (never inside a subshell/$(...)), so
# global counters below are never silently lost.
http_call() {
  local method="$1" url="$2" body="${3:-}"
  local raw start_ms end_ms
  local -a hdrs=(-H "x-tenant-id: $CALL_TENANT")
  # Authorization is only attached when a token is actually set. Sending
  # "Authorization: Bearer " with an empty value is a DIFFERENT test than
  # omitting the header -- a backend correctly distinguishing "no header"
  # from "empty credential" would behave differently for each, and only
  # omitting it tests what a "no auth" case actually means.
  if [ -n "${DEMOTOKEN:-}" ]; then
    hdrs+=(-H "Authorization: Bearer $DEMOTOKEN")
  fi
  start_ms=$(date +%s%3N)
  if [ -n "$body" ]; then
    raw=$(curl -s -w '\nHTTPSTATUS:%{http_code}' -X "$method" "$url" \
      "${hdrs[@]}" -H "Content-Type: application/json" -d "$body")
  else
    raw=$(curl -s -w '\nHTTPSTATUS:%{http_code}' -X "$method" "$url" "${hdrs[@]}")
  fi
  end_ms=$(date +%s%3N)
  HTTP_STATUS=$(echo "$raw" | grep 'HTTPSTATUS:' | sed 's/HTTPSTATUS://')
  HTTP_BODY=$(echo "$raw" | sed '$d')
  HTTP_TIME_MS=$((end_ms - start_ms))
}

# jq filter reused everywhere a response might be a bare array OR {data:[]}.
# NOT ".[]? // .data[]?" -- that pattern throws on an empty array (jq's `?`
# only guards the LAST operation in a chain, not the whole expression; this
# was found and fixed via the dry run against a mock server, see the guide).
ITEMS_FILTER='if type=="array" then .[] elif type=="object" and has("data") then .data[] else empty end'

assert_eq() {
  local desc="$1" expected="$2" actual="$3"
  TOTAL=$((TOTAL+1))
  CATEGORY_TOTAL["$CURRENT_CATEGORY"]=$((${CATEGORY_TOTAL["$CURRENT_CATEGORY"]}+1))
  if [ "$actual" = "$expected" ]; then
    PASS_COUNT=$((PASS_COUNT+1))
    echo "[PASS] $desc (expected=$expected actual=$actual)"
  else
    FAIL_COUNT=$((FAIL_COUNT+1))
    CATEGORY_FAIL["$CURRENT_CATEGORY"]=$((${CATEGORY_FAIL["$CURRENT_CATEGORY"]}+1))
    FAILED_TESTS+=("[$CURRENT_CATEGORY] $desc (expected=$expected actual=$actual)")
    echo "[FAIL] $desc (expected=$expected actual=$actual)"
  fi
}

assert_status() { assert_eq "$1 -- HTTP status" "$2" "$HTTP_STATUS"; }

assert_status_in() {
  local desc="$1" allowed="$2"
  TOTAL=$((TOTAL+1))
  CATEGORY_TOTAL["$CURRENT_CATEGORY"]=$((${CATEGORY_TOTAL["$CURRENT_CATEGORY"]}+1))
  if [[ " $allowed " == *" $HTTP_STATUS "* ]]; then
    PASS_COUNT=$((PASS_COUNT+1))
    echo "[PASS] $desc -- HTTP status (expected one of [$allowed] actual=$HTTP_STATUS)"
  else
    FAIL_COUNT=$((FAIL_COUNT+1))
    CATEGORY_FAIL["$CURRENT_CATEGORY"]=$((${CATEGORY_FAIL["$CURRENT_CATEGORY"]}+1))
    FAILED_TESTS+=("[$CURRENT_CATEGORY] $desc (expected one of [$allowed] actual=$HTTP_STATUS)")
    echo "[FAIL] $desc -- HTTP status (expected one of [$allowed] actual=$HTTP_STATUS)"
  fi
}

# SKIPPED: this test COULD run, but a precondition for THIS invocation is
# missing (e.g. STUDENT_ID not set, DB_URL not set). Fixable by the operator
# without any code change -- supply the missing input and it becomes real.
skip() { TOTAL=$((TOTAL+1)); SKIP_COUNT=$((SKIP_COUNT+1)); echo "[SKIPPED] $1"; }

# NOT_APPLICABLE: the capability being described does not exist in the API
# at all (confirmed against the controller source). No environment variable
# or precondition can ever make this testable -- it would require a backend
# change, which is out of this suite's scope to invent.
not_applicable() { TOTAL=$((TOTAL+1)); NA_COUNT=$((NA_COUNT+1)); echo "[NOT_APPLICABLE] $1"; }

log_perf() {
  local desc="$1" ms="$2"
  if [ "$ms" -gt "$PERF_THRESHOLD_MS" ]; then
    echo "[PERF WARN] $desc took ${ms}ms (> ${PERF_THRESHOLD_MS}ms threshold)"
  else
    echo "[PERF OK]   $desc took ${ms}ms"
  fi
}

show_body() { echo "$1" | jq . 2>/dev/null || echo "$1"; }

# Optional direct-DB check -- SKIPPED (not FAIL) if DB_URL is unset. This is
# additive to the API-based verification that always runs, never a
# replacement for it.
db_check() {
  local desc="$1" sql="$2" expected="$3"
  if [ -z "${DB_URL:-}" ]; then
    skip "$desc (DB_URL not set -- see the guide; API re-read above is the primary, always-on check)"
    return
  fi
  local actual
  actual=$(psql "$DB_URL" -t -A -c "$sql" 2>/dev/null | tr -d '[:space:]')
  assert_eq "$desc (direct DB)" "$expected" "$actual"
}

# Temp files used only by the concurrency tests. Cleaned at both start and
# end so a prior interrupted run never leaves stale state for this one.
CONC_TMP_FILES=(/tmp/schoolos_qa_conc_a1.json /tmp/schoolos_qa_conc_a2.json /tmp/schoolos_qa_conc_b1.json /tmp/schoolos_qa_conc_b2.json)
cleanup_conc_tmp() { rm -f "${CONC_TMP_FILES[@]}" 2>/dev/null || true; }
trap cleanup_conc_tmp EXIT
cleanup_conc_tmp

# ============================================================================
category "0. DISCREPANCIES FOUND vs. the original API map"
# ============================================================================
cat <<'EOF'
Six mismatches between the API map this suite was originally scoped from and
what the controllers actually expose, verified directly against source:

1. Invoice send/cancel take the id as a path segment: PATCH .../:id/send and
   .../:id/cancel, not the bare paths originally assumed.
2. Fee Plans: no PATCH, no DELETE route exists at all. Create/list/get/assign
   only.
3. Discounts: no PATCH, no DELETE. The only correction path is /:id/reject,
   which only works pre-approval.
4. Late Fees: only PATCH /:id/waive exists. apply/list/detail do not --
   confirmed by the controller's own header comment, which states this is
   deliberate (cron-only assessment, no on-demand HTTP path).
5. Analytics: exactly one bare route, GET /billing/analytics. No
   dashboard/collections/outstanding/defaulters sub-paths exist.
6. Refunds and Receipts have no HTTP route at all. RefundService.initiate()
   exists at the service layer but is not wired to any controller; receipts
   are only ever returned inline within a payment response.

All of this reflects the local repository clone, not necessarily your live
deployment directly -- if a route documented as real here 404s against your
actual server, that is itself a finding worth reporting, not evidence this
suite is wrong.
EOF

# ============================================================================
category "AUTH"
# ============================================================================
CALL_TENANT="$TENANT"
http_call POST "$API/auth/login" '{"email":"'"$LOGIN_EMAIL"'","password":"'"$LOGIN_PASSWORD"'"}'
log_perf "login" "$HTTP_TIME_MS"
assert_status "login succeeds" "200"
DEMOTOKEN=$(echo "$HTTP_BODY" | jq -r '.accessToken // empty')

if [ -z "$DEMOTOKEN" ]; then
  echo "!!! LOGIN FAILED -- cannot continue. Raw response:"
  show_body "$HTTP_BODY"
  exit 1
fi
echo "Token acquired: ${DEMOTOKEN:0:20}..."

# ============================================================================
category "1. FEE PLANS"
# ============================================================================
# This section's create/list/get/duplicate-check tests need no STUDENT_ID --
# fee plans are created and inspected independently of any student. Every
# plan this run creates is named with RUN_ID, so it is unambiguous which
# rows belong to this execution and re-running never collides with a
# previous run's.
UNIQUE_PLAN_NAME="QA-$RUN_ID Fee Plan"

if [ -n "$SESSION_ID" ]; then
  http_call POST "$API/billing/fee-plans" '{
    "name": "'"$UNIQUE_PLAN_NAME"'",
    "sessionId": "'"$SESSION_ID"'",
    "academicYear": "'"$ACADEMIC_YEAR"'",
    "feeItems": [
      { "name": "Tuition Fee", "amount": 20000 },
      { "name": "Transport Fee", "amount": 3000, "isOptional": true }
    ]
  }'
  log_perf "create fee plan" "$HTTP_TIME_MS"
  assert_status "create fee plan" "201"
  show_body "$HTTP_BODY"
  PLAN_ID=$(echo "$HTTP_BODY" | jq -r '.id // empty')

  http_call GET "$API/billing/fee-plans"
  COUNT_BEFORE=$(echo "$HTTP_BODY" | jq "[$ITEMS_FILTER | select(.name == \"$UNIQUE_PLAN_NAME\")] | length")

  http_call POST "$API/billing/fee-plans" '{
    "name": "'"$UNIQUE_PLAN_NAME"'",
    "sessionId": "'"$SESSION_ID"'",
    "academicYear": "'"$ACADEMIC_YEAR"'"
  }'
  DUP_STATUS="$HTTP_STATUS"
  show_body "$HTTP_BODY"

  http_call GET "$API/billing/fee-plans"
  COUNT_AFTER=$(echo "$HTTP_BODY" | jq "[$ITEMS_FILTER | select(.name == \"$UNIQUE_PLAN_NAME\")] | length")

  echo "Duplicate-name plan count for THIS RUN's unique name: before=$COUNT_BEFORE after=$COUNT_AFTER (create returned HTTP $DUP_STATUS)"
  if [ "$DUP_STATUS" = "201" ] && [ "$COUNT_AFTER" -gt "$COUNT_BEFORE" ]; then
    echo "[INFO] No duplicate-name prevention exists on fee-plans -- a second plan with an identical name was created without rejection. Not asserted PASS/FAIL: nothing in the verified API surface states this should be rejected. Flagging as a finding for your judgment."
  else
    assert_eq "duplicate-name plan count did not increase beyond the first create" "$COUNT_BEFORE" "$COUNT_AFTER"
  fi

  if [ -n "$PLAN_ID" ]; then
    http_call GET "$API/billing/fee-plans/$PLAN_ID"
    log_perf "get fee plan by id" "$HTTP_TIME_MS"
    assert_status "get fee plan by id" "200"
  fi
else
  skip "fee-plan create/list/get/duplicate-check -- SESSION_ID not set"
fi

not_applicable "fee-plan update (PATCH) -- no such route exists"
not_applicable "fee-plan delete (DELETE) -- no such route exists"

# ============================================================================
category "2. INVOICES"
# ============================================================================
if [ -n "${PLAN_ID:-}" ] && [ -n "$STUDENT_ID" ]; then
  http_call GET "$API/billing/invoices?studentId=$STUDENT_ID"
  INV_COUNT_BEFORE=$(echo "$HTTP_BODY" | jq "[$ITEMS_FILTER | select(.feePlanId == \"$PLAN_ID\")] | length")

  http_call POST "$API/billing/invoices/generate" '{
    "studentId": "'"$STUDENT_ID"'",
    "feePlanId": "'"$PLAN_ID"'",
    "dueDate": "'"$DUE_DATE"'",
    "notes": "QA run '"$RUN_ID"'"
  }'
  log_perf "generate invoice" "$HTTP_TIME_MS"
  assert_status "generate invoice" "201"
  show_body "$HTTP_BODY"
  SECTION2_INVOICE_ID=$(echo "$HTTP_BODY" | jq -r '.id // empty')

  http_call GET "$API/billing/invoices?studentId=$STUDENT_ID"
  INV_COUNT_AFTER=$(echo "$HTTP_BODY" | jq "[$ITEMS_FILTER | select(.feePlanId == \"$PLAN_ID\")] | length")
  assert_eq "invoice count increased by exactly 1 after generate" "$((INV_COUNT_BEFORE + 1))" "$INV_COUNT_AFTER"

  http_call POST "$API/billing/invoices/generate" '{
    "studentId": "'"$STUDENT_ID"'",
    "feePlanId": "'"$PLAN_ID"'",
    "dueDate": "'"$DUE_DATE"'"
  }'
  DUP_GEN_STATUS="$HTTP_STATUS"
  show_body "$HTTP_BODY"

  http_call GET "$API/billing/invoices?studentId=$STUDENT_ID"
  INV_COUNT_AFTER_DUP=$(echo "$HTTP_BODY" | jq "[$ITEMS_FILTER | select(.feePlanId == \"$PLAN_ID\")] | length")
  echo "Duplicate generate returned HTTP $DUP_GEN_STATUS. Count: $INV_COUNT_AFTER -> $INV_COUNT_AFTER_DUP"
  if [ "$DUP_GEN_STATUS" -ge 400 ] 2>/dev/null; then
    assert_eq "duplicate generate rejected -- count unchanged" "$INV_COUNT_AFTER" "$INV_COUNT_AFTER_DUP"
  else
    echo "[INFO] Duplicate generate returned $DUP_GEN_STATUS, count went $INV_COUNT_AFTER -> $INV_COUNT_AFTER_DUP. Flagging for judgment, not asserted."
  fi

  db_check "invoice row exists in Postgres" "SELECT count(*) FROM \"Invoice\" WHERE id = '$SECTION2_INVOICE_ID'" "1"
else
  skip "invoice generate/bulk-generate/count-verification -- STUDENT_ID and/or SESSION_ID not set"
fi

http_call GET "$API/billing/invoices"
log_perf "list invoices (default page)" "$HTTP_TIME_MS"
assert_status "list invoices" "200"

# --- Pagination: read-only, safe regardless of STUDENT_ID/SESSION_ID ---
http_call GET "$API/billing/invoices?page=1&limit=1"
assert_status "page=1&limit=1" "200"
P1_COUNT=$(echo "$HTTP_BODY" | jq '.data | length' 2>/dev/null || echo -1)
if [ "$P1_COUNT" -ge 0 ] 2>/dev/null; then
  assert_eq "limit=1 returns at most 1 row" "true" "$([ "$P1_COUNT" -le 1 ] && echo true || echo false)"
else
  skip "limit=1 row-count check -- response shape was not {data: [...]} as expected"
fi

http_call GET "$API/billing/invoices?page=2&limit=1"
assert_status "page=2&limit=1" "200"

http_call GET "$API/billing/invoices?page=999&limit=20"
assert_status "page=999 (far beyond data) returns 200, not an error" "200"
FAR_COUNT=$(echo "$HTTP_BODY" | jq '.data | length' 2>/dev/null || echo -1)
if [ "$FAR_COUNT" -ge 0 ] 2>/dev/null; then
  assert_eq "page=999 returns an empty data array" "0" "$FAR_COUNT"
else
  skip "page=999 empty-array check -- response shape was not {data: [...]} as expected"
fi

http_call GET "$API/billing/invoices?limit=100"
assert_status "limit=100" "200"

not_applicable "sort= query param -- not supported by findAll() (confirmed against the controller)"
not_applicable "search= query param -- not supported by findAll()"
not_applicable "date-range / feePlanId / session filters -- not query params on findAll()"
not_applicable "branch= filter -- branch scoping is derived server-side from the authenticated user by design, intentionally not client-controllable"

# --- Filters: status/studentId/academicYear are the real, supported ones ---
http_call GET "$API/billing/invoices?status=SENT"
assert_status "filter status=SENT" "200"
BAD_ROWS=$(echo "$HTTP_BODY" | jq "[$ITEMS_FILTER | select(.status != \"SENT\")] | length")
assert_eq "every row returned actually has status=SENT" "0" "$BAD_ROWS"

http_call GET "$API/billing/invoices?status=NOT_A_REAL_STATUS"
assert_status_in "filter with an invalid status value (expect empty-200 or 400, not 500)" "200 400"

http_call GET "$API/billing/invoices?academicYear=$ACADEMIC_YEAR"
assert_status "filter academicYear" "200"

if [ -n "$STUDENT_ID" ]; then
  http_call GET "$API/billing/invoices?studentId=$STUDENT_ID"
  assert_status "filter studentId" "200"
else
  skip "filter studentId -- STUDENT_ID not set"
fi

if [ -n "${SECTION2_INVOICE_ID:-}" ]; then
  http_call GET "$API/billing/invoices/$SECTION2_INVOICE_ID"
  log_perf "invoice detail" "$HTTP_TIME_MS"
  assert_status "invoice detail" "200"
  echo "  isOverdue: $(echo "$HTTP_BODY" | jq -r '.isOverdue')"

  http_call PATCH "$API/billing/invoices/$SECTION2_INVOICE_ID/send"
  assert_status_in "send invoice" "200 400 409"
  SEND_STATUS="$HTTP_STATUS"
  if [ "$SEND_STATUS" = "200" ]; then
    http_call GET "$API/billing/invoices/$SECTION2_INVOICE_ID"
    assert_eq "invoice status is SENT after send (independent re-read)" "SENT" "$(echo "$HTTP_BODY" | jq -r '.status')"
  fi

  http_call PATCH "$API/billing/invoices/$SECTION2_INVOICE_ID/cancel" '{"reason":"QA run '"$RUN_ID"' cancellation"}'
  assert_status_in "cancel invoice" "200 400"
  if [ "$HTTP_STATUS" = "200" ]; then
    http_call GET "$API/billing/invoices/$SECTION2_INVOICE_ID"
    assert_eq "invoice status is CANCELLED after cancel (independent re-read)" "CANCELLED" "$(echo "$HTTP_BODY" | jq -r '.status')"

    http_call PATCH "$API/billing/invoices/$SECTION2_INVOICE_ID/cancel" '{"reason":"second attempt"}'
    assert_status_in "cancel an already-cancelled invoice is rejected" "400 409"
  fi
else
  skip "invoice detail/send/cancel -- no invoice was created in this section (STUDENT_ID/SESSION_ID not set)"
fi

# ============================================================================
category "3. PAYMENTS"
# ============================================================================
# Deliberately creates its OWN dedicated fee plan + invoice, entirely
# independent of section 2's (which may already be CANCELLED by this point).
# Reusing section 2's plan/invoice here was an earlier bug in this suite --
# the duplicate-invoice check would reject a second generate() for the same
# student+plan, silently leaving payment tests pointed at a stale, cancelled
# invoice for reasons that had nothing to do with real payment behavior.
# Caught during dry-run validation against a mock server; fixed by never
# sharing mutable state across sections.
if [ -n "$STUDENT_ID" ] && [ -n "$SESSION_ID" ]; then
  http_call POST "$API/billing/fee-plans" '{
    "name": "QA-'"$RUN_ID"' Payment Test Plan",
    "sessionId": "'"$SESSION_ID"'",
    "academicYear": "'"$ACADEMIC_YEAR"'",
    "feeItems": [ { "name": "QA Tuition", "amount": 24000 } ]
  }'
  if [ "$HTTP_STATUS" = "201" ]; then
    PAYMENT_PLAN_ID=$(echo "$HTTP_BODY" | jq -r '.id')
    http_call POST "$API/billing/invoices/generate" '{
      "studentId": "'"$STUDENT_ID"'",
      "feePlanId": "'"$PAYMENT_PLAN_ID"'",
      "dueDate": "'"$DUE_DATE"'",
      "notes": "QA run '"$RUN_ID"' -- dedicated payment-test invoice"
    }'
    if [ "$HTTP_STATUS" = "201" ]; then
      INVOICE_ID=$(echo "$HTTP_BODY" | jq -r '.id')
      echo "Dedicated invoice for payment tests: $INVOICE_ID (plan: $PAYMENT_PLAN_ID)"
    fi
  fi
fi

if [ -n "${INVOICE_ID:-}" ]; then
  http_call GET "$API/billing/invoices/$INVOICE_ID"
  DUE_BEFORE=$(echo "$HTTP_BODY" | jq -r '.dueAmount')
  PAID_BEFORE=$(echo "$HTTP_BODY" | jq -r '.paidAmount')
  echo "Invoice before payments: dueAmount=$DUE_BEFORE paidAmount=$PAID_BEFORE"

  PARTIAL_1=$(echo "$DUE_BEFORE / 4" | bc); [ "$PARTIAL_1" = "0" ] && PARTIAL_1=1
  http_call POST "$API/billing/payments/record-offline" '{
    "invoiceId": "'"$INVOICE_ID"'", "amount": '"$PARTIAL_1"',
    "paymentMethod": "CASH", "referenceNumber": "QA-'"$RUN_ID"'-REF1"
  }'
  log_perf "record-offline (partial 1)" "$HTTP_TIME_MS"
  assert_status "record-offline partial 1" "201"
  PAYMENT_ID_1=$(echo "$HTTP_BODY" | jq -r '.payment.id // empty')
  RECEIPT_ID_1=$(echo "$HTTP_BODY" | jq -r '.receipt.id // empty')

  echo "--- Independent state verification after partial payment 1 (not trusting the mutation response alone) ---"
  http_call GET "$API/billing/invoices/$INVOICE_ID"
  assert_status "re-read invoice after payment" "200"
  NEW_PAID=$(echo "$HTTP_BODY" | jq -r '.paidAmount')
  NEW_DUE=$(echo "$HTTP_BODY" | jq -r '.dueAmount')
  assert_eq "invoice.paidAmount increased by the payment amount" "$(echo "$PAID_BEFORE + $PARTIAL_1" | bc)" "$NEW_PAID"
  assert_eq "invoice.dueAmount decreased by the payment amount" "$(echo "$DUE_BEFORE - $PARTIAL_1" | bc)" "$NEW_DUE"
  echo "  invoice.status: $(echo "$HTTP_BODY" | jq -r '.status') (expect PARTIALLY_PAID unless this happened to fully settle it)"

  http_call GET "$API/billing/payments/invoice/$INVOICE_ID"
  assert_status "re-read payment list for invoice" "200"
  PAYMENT_EXISTS=$(echo "$HTTP_BODY" | jq "[$ITEMS_FILTER | select(.id == \"$PAYMENT_ID_1\")] | length")
  assert_eq "payment row is retrievable via the invoice's payment list" "1" "$PAYMENT_EXISTS"

  db_check "payment row exists in Postgres" "SELECT count(*) FROM \"Payment\" WHERE id = '$PAYMENT_ID_1'" "1"
  db_check "receipt row exists in Postgres" "SELECT count(*) FROM \"Receipt\" WHERE id = '$RECEIPT_ID_1'" "1"
  db_check "invoice paidAmount matches directly in Postgres" "SELECT \"paidAmount\"::text FROM \"Invoice\" WHERE id = '$INVOICE_ID'" "$NEW_PAID"

  DUE_BEFORE="$NEW_DUE"; PAID_BEFORE="$NEW_PAID"
  PARTIAL_2=$(echo "$DUE_BEFORE / 3" | bc); [ "$PARTIAL_2" = "0" ] && PARTIAL_2=1
  http_call POST "$API/billing/payments/record-offline" '{
    "invoiceId": "'"$INVOICE_ID"'", "amount": '"$PARTIAL_2"',
    "paymentMethod": "CHEQUE", "referenceNumber": "QA-'"$RUN_ID"'-REF2"
  }'
  assert_status "record-offline partial 2" "201"

  # --- Idempotency: identical reference, sent sequentially twice ---
  IDEMPOTENT_REF="QA-$RUN_ID-IDEMPOTENT"
  http_call POST "$API/billing/payments/record-offline" '{
    "invoiceId": "'"$INVOICE_ID"'", "amount": 1,
    "paymentMethod": "CASH", "referenceNumber": "'"$IDEMPOTENT_REF"'"
  }'
  FIRST_PAYMENT_ID=$(echo "$HTTP_BODY" | jq -r '.payment.id // empty')

  http_call POST "$API/billing/payments/record-offline" '{
    "invoiceId": "'"$INVOICE_ID"'", "amount": 1,
    "paymentMethod": "CASH", "referenceNumber": "'"$IDEMPOTENT_REF"'"
  }'
  SECOND_PAYMENT_ID=$(echo "$HTTP_BODY" | jq -r '.payment.id // empty')
  assert_eq "sequential retry with an identical reference returns the SAME payment id" "$FIRST_PAYMENT_ID" "$SECOND_PAYMENT_ID"

  http_call GET "$API/billing/payments/invoice/$INVOICE_ID"
  DUP_REF_COUNT=$(echo "$HTTP_BODY" | jq "[$ITEMS_FILTER | select(.gatewayPaymentId == \"$IDEMPOTENT_REF\")] | length")
  assert_eq "exactly ONE payment row exists for that reference, not two" "1" "$DUP_REF_COUNT"

  # --- Concurrency A: identical concurrent requests, same reference ---
  echo "--- Concurrency test A: identical concurrent requests, same reference (a real race, not a sequential retry) ---"
  CONC_REF="QA-$RUN_ID-CONCURRENT"
  cleanup_conc_tmp
  curl -s -X POST "$API/billing/payments/record-offline" \
    -H "Authorization: Bearer $DEMOTOKEN" -H "x-tenant-id: $CALL_TENANT" -H "Content-Type: application/json" \
    -d '{"invoiceId":"'"$INVOICE_ID"'","amount":1,"paymentMethod":"CASH","referenceNumber":"'"$CONC_REF"'"}' \
    > "${CONC_TMP_FILES[0]}" 2>&1 &
  PID_A1=$!
  curl -s -X POST "$API/billing/payments/record-offline" \
    -H "Authorization: Bearer $DEMOTOKEN" -H "x-tenant-id: $CALL_TENANT" -H "Content-Type: application/json" \
    -d '{"invoiceId":"'"$INVOICE_ID"'","amount":1,"paymentMethod":"CASH","referenceNumber":"'"$CONC_REF"'"}' \
    > "${CONC_TMP_FILES[1]}" 2>&1 &
  PID_A2=$!
  wait "$PID_A1" "$PID_A2" 2>/dev/null

  http_call GET "$API/billing/payments/invoice/$INVOICE_ID"
  CONC_A_COUNT=$(echo "$HTTP_BODY" | jq "[$ITEMS_FILTER | select(.gatewayPaymentId == \"$CONC_REF\")] | length")
  assert_eq "concurrent identical requests produce exactly ONE payment (no double-charge under a real race)" "1" "$CONC_A_COUNT"
  if [ "$CONC_A_COUNT" != "1" ]; then
    echo "  response 1:"; show_body "$(cat "${CONC_TMP_FILES[0]}" 2>/dev/null)"
    echo "  response 2:"; show_body "$(cat "${CONC_TMP_FILES[1]}" 2>/dev/null)"
  fi

  # --- Concurrency B: two DIFFERENT payments, same invoice, fired together ---
  echo "--- Concurrency test B: two DIFFERENT payments on the same invoice, fired together (proves the settlement lock, not just idempotency) ---"
  http_call GET "$API/billing/invoices/$INVOICE_ID"
  DUE_PRE_CONC=$(echo "$HTTP_BODY" | jq -r '.dueAmount')
  PAID_PRE_CONC=$(echo "$HTTP_BODY" | jq -r '.paidAmount')
  AMT_B1=$(echo "$DUE_PRE_CONC / 6" | bc); [ "$AMT_B1" = "0" ] && AMT_B1=1
  AMT_B2=$(echo "$DUE_PRE_CONC / 7" | bc); [ "$AMT_B2" = "0" ] && AMT_B2=1

  cleanup_conc_tmp
  curl -s -X POST "$API/billing/payments/record-offline" \
    -H "Authorization: Bearer $DEMOTOKEN" -H "x-tenant-id: $CALL_TENANT" -H "Content-Type: application/json" \
    -d '{"invoiceId":"'"$INVOICE_ID"'","amount":'"$AMT_B1"',"paymentMethod":"CASH","referenceNumber":"QA-'"$RUN_ID"'-CONCB1"}' \
    > "${CONC_TMP_FILES[2]}" 2>&1 &
  PID_B1=$!
  curl -s -X POST "$API/billing/payments/record-offline" \
    -H "Authorization: Bearer $DEMOTOKEN" -H "x-tenant-id: $CALL_TENANT" -H "Content-Type: application/json" \
    -d '{"invoiceId":"'"$INVOICE_ID"'","amount":'"$AMT_B2"',"paymentMethod":"CASH","referenceNumber":"QA-'"$RUN_ID"'-CONCB2"}' \
    > "${CONC_TMP_FILES[3]}" 2>&1 &
  PID_B2=$!
  wait "$PID_B1" "$PID_B2" 2>/dev/null

  http_call GET "$API/billing/invoices/$INVOICE_ID"
  PAID_POST_CONC=$(echo "$HTTP_BODY" | jq -r '.paidAmount')
  EXPECTED_PAID=$(echo "$PAID_PRE_CONC + $AMT_B1 + $AMT_B2" | bc)
  assert_eq "BOTH concurrent payments applied -- sum is exact, no lost update from the race" "$EXPECTED_PAID" "$PAID_POST_CONC"
  if [ "$PAID_POST_CONC" != "$EXPECTED_PAID" ]; then
    echo "  This indicates the per-invoice settlement lock is not serializing correctly. response 1:"
    show_body "$(cat "${CONC_TMP_FILES[2]}" 2>/dev/null)"; echo "  response 2:"; show_body "$(cat "${CONC_TMP_FILES[3]}" 2>/dev/null)"
  fi
  cleanup_conc_tmp

  # --- Overpayment + rollback check ---
  http_call POST "$API/billing/payments/record-offline" '{"invoiceId": "'"$INVOICE_ID"'", "amount": 999999, "paymentMethod": "CASH"}'
  assert_status_in "overpayment rejected" "400 422"

  http_call GET "$API/billing/payments/invoice/$INVOICE_ID"
  ROLLBACK_COUNT=$(echo "$HTTP_BODY" | jq "[$ITEMS_FILTER | select(.amount == 999999)] | length")
  assert_eq "rejected overpayment created NO payment row (rollback correctness)" "0" "$ROLLBACK_COUNT"

  # --- Null / omitted optional fields ---
  http_call POST "$API/billing/payments/record-offline" '{
    "invoiceId": "'"$INVOICE_ID"'", "amount": 1, "paymentMethod": "CASH", "referenceNumber": null
  }'
  echo "  referenceNumber explicitly null -> HTTP $HTTP_STATUS (class-validator's @IsOptional does NOT skip an explicit null by default; 400 means it's enforced, 201 means it's tolerated -- either is a defined, informative behavior, neither is inherently wrong)"
  assert_status_in "referenceNumber explicitly null does not crash the server" "201 400"

  http_call POST "$API/billing/payments/record-offline" '{
    "invoiceId": "'"$INVOICE_ID"'", "amount": 1, "paymentMethod": "CASH"
  }'
  assert_status "referenceNumber OMITTED entirely succeeds (the documented @IsOptional path)" "201"

  http_call POST "$API/billing/payments/record-offline" '{"invoiceId": "'"$INVOICE_ID"'", "amount": 0, "paymentMethod": "CASH"}'
  assert_status_in "zero amount rejected" "400"

  http_call POST "$API/billing/payments/record-offline" '{"invoiceId": "'"$INVOICE_ID"'", "amount": -500, "paymentMethod": "CASH"}'
  assert_status_in "negative amount rejected" "400"

  http_call POST "$API/billing/payments/initiate" '{"invoiceId": "'"$INVOICE_ID"'", "gateway": "RAZORPAY", "amount": 100}'
  assert_status_in "razorpay initiate" "200 201"
  ORDER_ID=$(echo "$HTTP_BODY" | jq -r '.gatewayOrderId // .orderId // empty')

  http_call POST "$API/billing/payments/verify-razorpay" '{
    "razorpayOrderId": "'"${ORDER_ID:-order_fake}"'", "razorpayPaymentId": "pay_fake_qa",
    "razorpaySignature": "0000000000000000000000000000000000000000000000000000000000000000"
  }'
  assert_status_in "bad Razorpay signature MUST be rejected -- 200/201 here would be Critical" "400 401 403"
else
  skip "payments section (offline, idempotency, concurrency, razorpay, edge cases) -- STUDENT_ID and/or SESSION_ID not set, no dedicated test invoice could be created"
fi

# ============================================================================
category "4. RECEIPTS"
# ============================================================================
not_applicable "GET /billing/receipts/:id or equivalent -- no such route exists; receipt state is verified inline in section 3 (payment response .receipt.id, plus the optional DB check)"

# ============================================================================
category "5. DISCOUNTS"
# ============================================================================
if [ -n "$STUDENT_ID" ]; then
  http_call POST "$API/billing/discounts" '{
    "studentId": "'"$STUDENT_ID"'", "category": "MERIT", "type": "PERCENTAGE",
    "value": 10, "validFrom": "2026-04-01", "reason": "QA run '"$RUN_ID"'"
  }'
  assert_status "create discount" "201"
  DISCOUNT_ID=$(echo "$HTTP_BODY" | jq -r '.id // empty')

  if [ -n "$DISCOUNT_ID" ]; then
    http_call GET "$API/billing/discounts/pending-approvals"
    assert_status "pending-approvals" "200"
    PENDING_HAS_IT=$(echo "$HTTP_BODY" | jq "[$ITEMS_FILTER | select(.id == \"$DISCOUNT_ID\")] | length")
    assert_eq "newly-created discount appears in pending-approvals" "1" "$PENDING_HAS_IT"

    http_call POST "$API/billing/discounts/$DISCOUNT_ID/approve" '{"approvalNote":"QA run '"$RUN_ID"'"}'
    assert_status "approve discount" "200"

    http_call GET "$API/billing/discounts/$DISCOUNT_ID"
    assert_eq "discount status is APPROVED after approve (independent re-read)" "APPROVED" "$(echo "$HTTP_BODY" | jq -r '.approvalStatus // .status')"

    http_call POST "$API/billing/discounts/$DISCOUNT_ID/reject" '{"rejectionReason":"testing an invalid transition"}'
    assert_status_in "reject an already-approved discount is rejected, not silently processed" "400 409"

    if [ -n "${PLAN_ID:-}" ]; then
      http_call POST "$API/billing/invoices/generate" '{
        "studentId": "'"$STUDENT_ID"'", "feePlanId": "'"$PLAN_ID"'", "dueDate": "'"$DUE_DATE"'"
      }'
      if [ "$HTTP_STATUS" = "201" ]; then
        RECALC_DISCOUNT=$(echo "$HTTP_BODY" | jq -r '.discountAmount // 0')
        echo "  New invoice discountAmount after approval: $RECALC_DISCOUNT (expect > 0 if the approved discount is correctly applied to a new invoice)"
      fi
    else
      skip "invoice-recalculation-after-discount -- no fee plan available from section 1"
    fi
  fi
else
  skip "discounts section -- STUDENT_ID not set"
fi
not_applicable "discount update/delete/'remove' -- no such route exists; the only correction path is /reject, which only works pre-approval"

# ============================================================================
category "6. LATE FEES"
# ============================================================================
not_applicable "apply late fee on demand -- no route exists (cron-only assessment, confirmed by the controller's own header comment)"
not_applicable "list late fees -- no route exists"
not_applicable "late fee detail -- no route exists"
skip "waive an existing late fee -- the route exists (PATCH :id/waive) but needs a real, already-assessed late fee id this suite cannot create on demand; supply LATE_FEE_ID to enable this test in a future revision"

# ============================================================================
category "7. OVERDUE"
# ============================================================================
http_call GET "$API/billing/invoices/overdue"
log_perf "overdue list" "$HTTP_TIME_MS"
assert_status "overdue list" "200"
NOT_OVERDUE=$(echo "$HTTP_BODY" | jq "[$ITEMS_FILTER | select(.isOverdue != true)] | length")
assert_eq "every row returned by /overdue actually has isOverdue: true" "0" "$NOT_OVERDUE"

http_call GET "$API/billing/invoices/defaulters"
assert_status "defaulters list" "200"

http_call GET "$API/billing/invoices/stats"
assert_status "stats" "200"
show_body "$HTTP_BODY"

# ============================================================================
category "8. REFUNDS"
# ============================================================================
not_applicable "any refund endpoint -- RefundService.initiate() exists at the service layer but is not wired to any HTTP controller"

# ============================================================================
category "9. ANALYTICS"
# ============================================================================
http_call GET "$API/billing/analytics"
log_perf "analytics overview" "$HTTP_TIME_MS"
assert_status "analytics overview" "200"
not_applicable "dashboard/collections/outstanding/defaulters sub-routes -- none exist; only the bare route above is real"

# ============================================================================
category "10. SECURITY"
# ============================================================================
if [ -n "${SECTION2_INVOICE_ID:-}" ] || [ -n "${INVOICE_ID:-}" ]; then
  SECURITY_TEST_INVOICE="${SECTION2_INVOICE_ID:-$INVOICE_ID}"
  CALL_TENANT="some-other-tenant-that-should-not-exist"
  http_call GET "$API/billing/invoices/$SECURITY_TEST_INVOICE"
  assert_status "cross-tenant read of a real invoice id under a foreign tenant header" "404"
  CALL_TENANT="$TENANT"
else
  skip "cross-tenant read test -- no invoice id available from earlier sections"
fi

OLD_TOKEN="$DEMOTOKEN"; DEMOTOKEN=""
http_call GET "$API/billing/invoices"
assert_status "no Authorization header at all" "401"
DEMOTOKEN="$OLD_TOKEN"

DEMOTOKEN="garbage.not.a.real.token"
http_call GET "$API/billing/invoices"
assert_status_in "garbage/malformed token" "401"
DEMOTOKEN="$OLD_TOKEN"

skip "branch isolation (a different-branch user) -- needs a second set of credentials this suite does not have; set BRANCH_TEST_EMAIL/BRANCH_TEST_PASSWORD to enable"
skip "RBAC-denied-role calls (a non-finance role) -- needs a second set of credentials this suite does not have; set RBAC_TEST_EMAIL/RBAC_TEST_PASSWORD to enable"

# ============================================================================
category "11. EDGE CASES"
# ============================================================================
http_call GET "$API/billing/invoices/not-a-real-id-at-all"
assert_status_in "malformed invoice id" "400 404"

http_call GET "$API/billing/invoices/clxnonexistent00000000000000"
assert_status "well-formed but nonexistent invoice id" "404"

if [ -n "${INVOICE_ID:-}" ]; then
  http_call GET "$API/billing/invoices/$INVOICE_ID"
  ST=$(echo "$HTTP_BODY" | jq -r '.status')
  if [ "$ST" = "PAID" ] || [ "$ST" = "CANCELLED" ]; then
    http_call POST "$API/billing/payments/record-offline" '{"invoiceId": "'"$INVOICE_ID"'", "amount": 1, "paymentMethod": "CASH"}'
    assert_status_in "payment against an already-settled invoice is rejected" "400"
  else
    skip "payment-against-settled-invoice -- this run's payment-test invoice is not yet settled"
  fi
else
  skip "payment-against-settled-invoice -- no payment-test invoice available"
fi

# ============================================================================
category "FINAL SUMMARY"
# ============================================================================
echo ""
echo "===================================="
for cat in "${!CATEGORY_TOTAL[@]}"; do
  if [ "${CATEGORY_FAIL[$cat]:-0}" = "0" ]; then
    printf "%-45s PASS\n" "$cat"
  else
    printf "%-45s FAIL (%d/%d failed)\n" "$cat" "${CATEGORY_FAIL[$cat]}" "${CATEGORY_TOTAL[$cat]}"
  fi
done
echo "===================================="
echo "Total:          $TOTAL"
echo "Passed:         $PASS_COUNT"
echo "Failed:         $FAIL_COUNT"
echo "Skipped:        $SKIP_COUNT"
echo "Not Applicable: $NA_COUNT"
echo "===================================="
if [ "$FAIL_COUNT" -gt 0 ]; then
  echo ""
  echo "Failed tests:"
  for t in "${FAILED_TESTS[@]}"; do
    echo "  - $t"
  done
fi
echo ""
echo "Run ID: $RUN_ID -- every record this run created is tagged with this string, for cleanup or audit."
echo "=== DONE. Paste this full output back for analysis. ==="

[ "$FAIL_COUNT" -eq 0 ]
