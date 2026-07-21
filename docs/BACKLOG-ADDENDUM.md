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
