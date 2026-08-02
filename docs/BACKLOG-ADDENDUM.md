# Backlog Addendum (post-handoff findings)

Items discovered during FEE-0 implementation that are OUT of FEE-0 scope,
recorded here so they aren't lost. Numbered in discovery order; none is
authorized to start by appearing here (same rule as the Roadmap document).

## BA-1 — Impersonation audit attribution (audit enhancement, pre-FEE-1 candidate)

`SuperadminService.impersonate()` mints a token AS the target tenant's
SCHOOL_ADMIN (`sub = adminUser.id`, `role = SCHOOL_ADMIN`,
`impersonated: true`, `impersonatedBy: <superAdminId>`), but
`JwtStrategy.validate()` drops the `impersonated`/`impersonatedBy` claims —
`AuthenticatedUser` has no impersonation fields. Every audit entry written
during an impersonation session therefore records `actorId = adminUser.id`,
as if the school's own admin acted; the only trace of the real actor is the
single `IMPERSONATION` audit row at token issuance. For financial mutations
governed by ADR-FEE-003 `IMM-022` (actor attribution), correlating
"what happened under impersonation" requires timestamp joins and is ambiguous
if the real admin is active in the same 30-minute window.

Proposed fix (when scheduled): carry both claims through
`JwtStrategy.validate()` into `AuthenticatedUser`, and have `AuditService`
persist `impersonatedBy` (e.g. into `AuditLog.metadata`) whenever present.
Decision (2026-07-22): explicitly deferred out of FEE-0 by the reviewing
engineer; do not implement during FEE-0.

## BA-2 — Students module PARENT endpoints lack ownership checks

`students.controller.ts` grants `PARENT` on `GET /students/:id` and
`GET /students/:id/guardians` with tenant+branch filtering only — any parent
can read any student in their branch. Outside FEE-0's finance scope; the
finance-side resolver (`StudentBillingAccessService`) is reusable here when
this is scheduled.

## BA-3 — `student-billing-audit.md` "never read anywhere" correction

`InvoiceStatus.EXPIRED`'s removal rationale claimed no reads anywhere; one
dead read existed in `saas-billing` (`SaasInvoice` shares the enum), removed
in commit `d55b6a6`. The enum-drop migration pre-check must cover BOTH
`"Invoice"` and `"SaasInvoice"`. Handoff docs (`IMPLEMENTATION_HANDOFF.md`
§2/§6.2/§10, `PROJECT_CONTEXT.md` §8) should be amended accordingly.

## BA-4 — No test suite exists for `saas-billing`

Pre-existing gap noticed while fixing BA-3. Not FEE-scope.

## BA-5 — Student search does not cover Father's Name, Parent Mobile, or Roll Number

Discovered during Student Billing frontend Sprint 1 (Collect Fee). The
Student Billing FDD (`docs/product/STUDENT_BILLING_FDD.md`, Section 10.2)
specifies a single search covering admission number, student name,
father's name, parent mobile, and roll number. Verified directly against
`students.service.ts`: the `search` query param on `GET /students` only
matches `firstName`/`lastName`/`admissionNumber` via `contains`. Father's
name and mobile require a join to `Guardian` the current query does not
perform; `rollNumber` is a real column on `Student` but isn't included in
the search filter either.

Not fixed as part of Sprint 1 or Sprint 2: fetching all students to filter
client-side would defeat server-side search at any real school's size, and
extending the query is a students-module change outside Student Billing's
own scope and freeze. `frontend/src/components/billing/StudentSearch.tsx`
implements search against the current, narrower contract and documents
this gap in its own header comment.

Decision (2026-08-01): explicitly deferred by the reviewing engineer.
Priority order for Student Billing frontend work is (1) complete Collect
Fee, (2) complete Receipt Detail, (3) complete remaining Student Billing
screens, (4) then revisit search. Proposed fix when scheduled: add a
`Guardian` join (`OR` clause matching `guardianLinks.some.guardian.{firstName,lastName,phone}`)
and a `rollNumber` `contains` clause to the existing `search` filter in
`students.service.ts` — additive to the existing query, no new endpoint
needed.

