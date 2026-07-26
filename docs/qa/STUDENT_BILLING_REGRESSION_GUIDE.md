# Student Billing Regression Guide

`qa/student-billing-regression-suite.sh` is the official backend validation
suite for Student Billing, run against a live deployment before backend
freeze and on demand thereafter. This document is the guide for running it
and reading its output. The script itself is the source of truth for what
it actually tests — this document explains it, it doesn't duplicate it.

---

Version: 1.0
Module: Student Billing
Maintainer: ByteBeam Technologies
Last Updated: 2026-07-26
Compatible Backend: >= current backend freeze


## What this suite is, and isn't

It exercises the real, deployed HTTP API — every route and request-body
field was verified directly against the committed controller/DTO source
before being written into the suite, not assumed or guessed. It does not
read source code at runtime; it only makes HTTP calls.

It is not a unit test suite and does not replace one. It cannot see inside
the backend process, only what the API exposes and (optionally) what
Postgres holds afterward.

It was dry-run validated end-to-end against a local mock server — once with
a deliberately unlocked (racy) payment handler, once with the real settlement
lock reproduced — before ever being pointed at a live deployment. The
unlocked run correctly failed both concurrency assertions with the exact
signature of a lost update; the locked run passed both cleanly. That
before/after pair is what establishes the concurrency tests actually catch
a real race, rather than being decorative. Three bugs in the suite itself
were found and fixed during that process (see "Known limitations and
history" below) — this is the value of validating a test harness before
trusting its output, not just its syntax.

---

## Prerequisites

- `curl`, `jq`, `bc` on the machine running the suite.
- A reachable Student Billing API and valid demo-tenant credentials.
- Network access from wherever you run this to the API host. This suite
  cannot be run from an environment without that access (it makes real
  HTTP calls; there is no offline mode).

---

## Required and optional environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `API_BASE` | No | `https://api-cell.bytebeamtech.com/api/v1` | API base URL |
| `TENANT_ID` | No | `demo-school` | `x-tenant-id` header value |
| `LOGIN_EMAIL` | No | `admin@demo-school.com` | Login credential |
| `LOGIN_PASSWORD` | No | `Demo@123!` | Login credential |
| `STUDENT_ID` | **Yes, for most tests** | *(empty)* | A real student id in the target tenant. Every test that creates an invoice, payment, or discount needs this — students are outside Student Billing's own API surface, so this suite cannot discover or create one itself. |
| `SESSION_ID` | **Yes, for most tests** | *(empty)* | A real academic session id. Fee plan creation requires this; sessions are likewise outside this module's API surface. |
| `ACADEMIC_YEAR` | No | `2026-2027` | Used on created fee plans/invoices |
| `DUE_DATE` | No | `2026-08-15` | Used on generated invoices |
| `DB_URL` | No | *(unset)* | A `psql`-compatible connection string. When set, adds direct-database cross-checks alongside the API-based verification that always runs. When unset, those specific checks report `SKIPPED`, not `FAIL` — they are additive, never required. |
| `PERF_THRESHOLD_MS` | No | `1000` | Response time above this logs `[PERF WARN]`, not a failure |

**Without `STUDENT_ID` and `SESSION_ID` set, the suite still runs completely
and safely** — every test needing them reports `SKIPPED` with a clear reason,
and nothing attempts to work around the gap by discovering and mutating a
pre-existing real record. Read-only tests (list, pagination, filters,
overdue, analytics, security, edge cases) run regardless.

---

## How to run

```bash
cd schoolos-monorepo
STUDENT_ID="<a real student id>" \
SESSION_ID="<a real session id>" \
bash qa/student-billing-regression-suite.sh 2>&1 | tee audit-output.txt
```

With direct-database verification also enabled:

```bash
STUDENT_ID="<real id>" SESSION_ID="<real id>" \
DB_URL="postgresql://user:pass@host:5432/dbname" \
bash qa/student-billing-regression-suite.sh 2>&1 | tee audit-output.txt
```

Against a non-default environment:

```bash
API_BASE="https://staging.example.com/api/v1" TENANT_ID="staging-school" \
STUDENT_ID="..." SESSION_ID="..." \
bash qa/student-billing-regression-suite.sh
```

The suite exits `0` if every test that ran passed (`SKIPPED` and
`NOT_APPLICABLE` do not affect the exit code), and `1` if any test failed —
usable directly as a CI gate.

---

## Safety properties

- **Never mutates pre-existing data.** Every record this suite creates
  (fee plans, invoices, discounts, payments) is created by the suite itself
  in that run, tagged with a run-unique identifier printed at the start and
  end of the output (`Run ID: <timestamp>-<random>`). The suite never reads
  an existing invoice or discount and then mutates it — if the inputs
  needed to create fresh, isolated test data aren't supplied, the relevant
  tests are `SKIPPED`, not routed around by touching something real.
- **Safe to re-run repeatedly**, including back-to-back against the same
  environment. Every created record's name/reference includes that run's
  ID, so a second run's own duplicate-detection checks are never confused
  by a prior run's data, and nothing across runs collides.
- **Every state-changing call is independently re-verified.** The suite
  does not trust a mutation's own response as proof of the resulting state —
  after every payment, cancel, send, or approval, it separately re-`GET`s
  the affected record and asserts on that fresh read. The `record-offline`
  path additionally checks the payment is retrievable via the invoice's own
  payment list, not just present in its own creation response.
- **Concurrency is tested with real concurrent requests**, not simulated —
  the two payment-race tests fire genuinely parallel `curl` processes and
  `wait` on both, not two sequential calls made to look concurrent.

---

## Expected output

Each check prints one line as it runs:

```
[PASS]   <description> (expected=X actual=Y)
[FAIL]   <description> (expected=X actual=Y)
[SKIPPED] <description>
[NOT_APPLICABLE] <description>
```

A per-category rollup and a final totals block close the run:

```
====================================
1. FEE PLANS                                  PASS
2. INVOICES                                   PASS
3. PAYMENTS                                   FAIL (2/20 failed)
...
====================================
Total:          79
Passed:         58
Failed:         0
Skipped:        8
Not Applicable: 13
====================================
```

If any test failed, their descriptions are listed again immediately below
the totals, prefixed with their category, so a failure never has to be
hunted for in the full log.

---

## Interpreting the four statuses

- **PASS** — the assertion held. No action needed.
- **FAIL** — a real discrepancy between expected and actual behavior. This
  is the signal that should block backend freeze. Every `FAIL` line states
  exactly what was expected and what was observed; that's the starting
  point for triage, not the full investigation.
- **SKIPPED** — the test could run, but a precondition for *this specific
  invocation* is missing, and it's fixable by the operator without touching
  the suite: `STUDENT_ID`/`SESSION_ID` not supplied, `DB_URL` not set, a
  late fee id not available. Re-run with the missing input and it becomes a
  real `PASS`/`FAIL`. A `SKIPPED` result is not evidence of a passing or
  failing backend — it means that specific thing wasn't checked this time.
- **NOT_APPLICABLE** — the capability being described does not exist in the
  API at all, confirmed directly against the controller source (documented
  in the suite's own section 0 output at the top of every run): fee-plan
  PATCH/DELETE, discount PATCH/DELETE, late-fee apply/list/detail, refund
  endpoints, most of the originally-assumed analytics sub-routes. No
  environment variable or precondition can turn a `NOT_APPLICABLE` into a
  real test — that would require a backend change, which is outside this
  suite's scope to make or assume.

**A clean freeze-readiness read is: zero `FAIL`, with every `NOT_APPLICABLE`
understood and accepted (they are structural facts about the current API,
not defects this suite is flagging), and `SKIPPED` count matching what you
expect given which environment variables you supplied.**

---

## Known limitations and history

- **No branch-isolation or RBAC-denied-role coverage.** Both require a
  second set of credentials (a different-branch user; a non-finance role)
  that this suite does not have. They report `SKIPPED` with the specific
  environment variables that would enable them
  (`BRANCH_TEST_EMAIL`/`BRANCH_TEST_PASSWORD`,
  `RBAC_TEST_EMAIL`/`RBAC_TEST_PASSWORD`) as a documented extension point,
  not yet wired up.
- **Late fee `waive` cannot be tested end-to-end.** The route exists, but
  the only way to get a real late fee id is the cron-driven assessment job,
  which this suite has no way to trigger on demand (confirmed: no `apply`
  endpoint exists). `LATE_FEE_ID` as a future input would close this gap.
- **Refunds and standalone receipt retrieval are permanently
  `NOT_APPLICABLE`**, not a gap in this suite — no HTTP route exists for
  either in the backend today.
- **Three bugs in the suite itself were found and fixed** during dry-run
  validation before this version was trusted, worth recording as the reason
  the validation step existed at all:
  1. A jq pattern (`.[]? // .data[]?`, used to handle responses that could
     be either a bare array or `{data: [...]}`) threw an error on empty
     arrays — jq's `?` only guards the last operation in a chain, not the
     whole expression. This silently produced wrong counts (and, in one
     spot, silently disabled an entire assertion via an error-swallowing
     fallback) rather than the intended `0`. Replaced everywhere with an
     explicit `type`-based check.
  2. An earlier revision reused one section's fee-plan/invoice for a later
     section's payment tests. Once that invoice had already been cancelled
     by the earlier section, the later section's own "create a fresh
     invoice" call collided with the duplicate-invoice check and silently
     fell back to testing against the stale, cancelled one. Fixed by giving
     the payments section its own dedicated, run-tagged fee plan and
     invoice, entirely independent of any other section's data.
  3. The "no auth header" security test set the token variable to an empty
     string, which still produced an `Authorization: Bearer ` header with
     an empty value — not the same thing as omitting the header entirely,
     and not what the test claimed to check. Fixed so the header is fully
     omitted when no token is set.
- **Verified against a local repository clone, not necessarily your exact
  live deployment.** If a route or field documented here as real 404s or
  400s unexpectedly against your actual server, that divergence is itself a
  finding worth reporting — not evidence the suite is wrong.

---
## Backend Freeze Checklist

□ Regression Suite passes
□ Failed = 0
□ Expected Skipped reviewed
□ Not Applicable reviewed
□ Performance warnings reviewed
□ DB verification completed (optional)
□ QA Lead sign-off
□ Backend frozen
## Extending this suite

When the backend gains new capability this suite currently marks
`NOT_APPLICABLE` (a refund endpoint, late-fee `apply`, branch-scoped
analytics sub-routes), the corresponding `not_applicable "..."` line should
become a real test, not stay as dead documentation. When adding a new
section, follow the existing pattern: derive request bodies from the actual
DTO source, tag every created record with `$RUN_ID`, verify state via an
independent re-`GET` rather than trusting the mutation's own response, and
prefer `SKIPPED` (fixable) over silently working around a missing
precondition by touching data the suite didn't create itself.
