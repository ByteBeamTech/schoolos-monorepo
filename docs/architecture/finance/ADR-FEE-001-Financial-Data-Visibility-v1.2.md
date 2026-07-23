# ADR-FEE-001 — Financial Data Visibility

**Status:** Accepted (v1.2)
**Supersedes:** ADR-FEE-001 Draft (archived), v1.0, v1.1
**Accepted with:** persistent-state guardian ownership rule (§3.1) and INV-9 authorization-before-retrieval (§10), per review.
**v1.1 (editorial, non-normative):** added stable Decision IDs (Appendix A), Compliance Matrix scaffold (Appendix B), and ADR Traceability (Appendix C).
**v1.2 (editorial + 1 normative clarification):** added Non-Goals (§2.1), Conflict Resolution / fail-closed-on-missing-context rule (§4.1, AUTH-005), alphabetized glossary (§3), and this metadata block. AUTH-005 makes explicit a principle that was previously only implied; it does not relax any existing rule.

| | |
|---|---|
| **Authors** | SchoolOS Finance Architecture |
| **Reviewers** | Principal Software Architect, SchoolOS Finance Architecture — sign-off given |
| **Created** | 2026-07-19 |
| **Accepted** | 2026-07-19 |
| **Last Updated** | 2026-07-19 |
| **Version** | 1.2 |

**Depends on / cross-references:** Finance Architecture Principles (1-page), ADR-FEE-002 (Branch Isolation), ADR-FEE-004 (Ledger Architecture), ADR-FEE-006 (Financial Domain Events)
**Consumers of this contract:** FEE-0 Security Hardening (implementation), FEE-0 Definition of Done (verification), ADR-FEE-006 (notification eligibility derives from this document)

---

## 1. Purpose

This ADR defines the **normative authorization model** for all financial data in SchoolOS. It is the canonical, single-source-of-truth contract that FEE-0 Security Hardening implements, that FEE-0's cross-role/cross-branch verification tests assert against, and from which ADR-FEE-006 derives notification eligibility.

Normative keywords **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are used per RFC 2119. Any requirement expressed with these keywords is binding on implementation and on code review; a change to any such requirement requires a new revision of this ADR, not an implementation-time decision.

This document deliberately errs toward being specific rather than general. Where a real business decision exists (e.g. when a receivable is recognized, whether a student sees their own fees), this ADR **freezes the decision** rather than describing the option space — so that FEE-0 can be implemented mechanically, without an engineer supplying an unstated assumption. Supplying such an assumption at implementation time is precisely the class of gap this ADR exists to prevent.

---

## 2. Scope

This ADR governs authorization for **all** financial data surfaces:

- Finance HTTP APIs (list, detail, create, mutate, approve, refund, export)
- Finance UI (advisory only — see §12)
- Data exports (CSV/PDF/report downloads)
- Notifications (eligibility only; content/channel is ADR-FEE-006)
- Reports and analytics

In scope entities: Fee Plan, Fee Assignment, Invoice, Invoice Item, Payment, Receipt, Discount, Discount Approval, Scholarship (modeled as a Discount category), Late Fee, Refund, Write-Off, Adjustment, Ledger Entry, Student Financial Account, and any report or aggregate derived from these.

Out of scope: SaaS/platform billing (`saas-billing`, a separate tenant-vs-platform concern), and non-financial modules.

### 2.1 Non-Goals

This ADR does **not** define (each is owned elsewhere; see Appendix C):

- Financial posting rules or when postings occur — ADR-FEE-004 / ADR-FEE-005.
- Ledger schema or entry structure — ADR-FEE-004.
- Financial immutability / no-hard-delete mechanics — ADR-FEE-003.
- Notification content, templates, channels, or delivery — ADR-FEE-006 (this ADR governs only *eligibility*, via INV-4).
- UI layout, screens, or component behavior — UI is advisory only here (§12).
- Permission-management UI or how branch/role assignments are administered — the assignment *model* is ADR-FEE-002; its administration UI is a product concern, not this contract.
- Authentication (how a principal proves identity) — this ADR governs *authorization* given an authenticated principal, not the login/token-issuance flow.

Stating these explicitly is deliberate: it prevents scope creep into this document and keeps it a stable authorization contract.

---

## 3. Definitions

Listed alphabetically.

- **Active Guardian Relationship** — see §3.1.
- **Branch** — a campus/unit within a tenant. Financial data is branch-owned; see §5.2 and ADR-FEE-002.
- **Ledger** — the append-only, immutable financial source of truth (ADR-FEE-004). Internal accounting artifact. Contains raw entries including reversals, adjustments, write-offs, and staff-side corrections.
- **Ownership** — a subject-specific relationship that grants access independent of role: a `PARENT` to their guardian-linked student, a `STUDENT` to their own records.
- **Role** — the authenticated user's `UserRole` (e.g. `SCHOOL_OWNER`, `PRINCIPAL`, `ACCOUNTANT`, `PARENT`, `STUDENT`).
- **Student Financial Account (SFA)** — the parent/student-safe *projection* over the Ledger (FEE-4). Presents balances, dues, and payment history without internal accounting noise. This is the only financial-history surface a parent or student may see (§8).
- **Tenant** — a school organization. The hard outer boundary; see §5.1.

### 3.1 Active Guardian Relationship (normative)

- A guardian relationship is **active** if it exists and is **not revoked/ended** (any non-revoked `guardianLink`).
- `isPrimary` on a guardian link is for **notification routing only**. It **MUST NOT** be used as an access-control condition. Where a student has multiple active guardians (e.g. mother and father), **each** active guardian **MUST** receive the same financial access to that student.
- Revoking/ending a guardian relationship **MUST** immediately revoke that guardian's access to the student's financial data. There **MUST NOT** be a cache or token window in which a revoked guardian retains access beyond the current in-flight request.
- **Guardian ownership MUST be evaluated against current persistent state for every authorized request** (**AUTH-003**). JWT claims **MAY** identify the principal but **MUST NOT** be treated as authoritative evidence of guardian ownership. An implementation **MUST NOT** embed guardian/student linkage in the token and rely on it for access decisions; the linkage **MUST** be resolved from persistent state at request time, so that a revocation takes effect on the next request regardless of outstanding token lifetime.

---

## 4. Authorization Principles (references the 1-page Finance Architecture Principles)

- **P1.** Visibility derives from ownership **and** role-scoped authorization, **bounded by** tenant and branch isolation. No single dimension (tenant, branch, role, or ownership) is sufficient on its own.
- **P2. Default deny.** Any (role × entity) or (role × entity × field) combination not **explicitly granted** by this ADR **MUST** be denied. See §11.
- **P3.** Server-side authorization is the sole authority (§12).
- **P4.** Notifications **MUST NOT** disclose information the recipient cannot subsequently view through an authorized surface (§10, and ADR-FEE-006).
- **P5.** Authorization is enforced uniformly across list, detail, search, export, and notification — one entity's access rules are the same regardless of the surface it is reached through (§9).

### 4.1 Conflict Resolution & Missing Context — **AUTH-005**

- **Most-restrictive-wins.** Where multiple authorization rules apply to the same access decision, the **most restrictive** applicable rule **MUST** prevail. A grant from one dimension **MUST NOT** override a denial from another. Concretely: if tenant **or** branch **or** role **or** ownership denies, the result is **DENY**, regardless of what the other dimensions permit. (Example: a principal whose role would allow reading an invoice, but who lacks ownership/branch authority for that specific invoice, is denied.)
- **Missing context fails closed.** Absent or null authorization context — missing `tenantId`, missing `branchId`, absent guardian linkage, unresolved role/branch assignment, or any input required to make an authorization decision — **MUST** be treated as a denial, never as an implicit allow or "skip the check." An implementation **MUST NOT** interpret a missing branch/tenant/ownership value as "unscoped" and return broader data; the correct handling of missing scope is denial, not widening.

This rule makes the authorization model deterministic: for any (principal, entity, field, surface) tuple, the outcome is either an explicit grant or — in every other case, including incomplete data — a denial.

---

## 5. Authorization Model

Authorization **MUST** be evaluated in this order; a failure at any layer denies access regardless of later layers:

1. **Tenant** (§5.1)
2. **Branch** (§5.2)
3. **Role** (§6)
4. **Ownership** (§6, for `PARENT`/`STUDENT`)

### 5.1 Tenant isolation — **AUTH-001**

- Every financial query **MUST** be scoped by the authenticated user's `tenantId`.
- `tenantId` **MUST** be derived from the authenticated principal (JWT), **MUST NOT** be accepted from client input (body, query, header, or path) for the purpose of scoping.
- No financial record of one tenant is ever visible to any principal of another tenant, regardless of role. Cross-tenant exposure is a **P0** violation.

### 5.2 Branch isolation — **AUTH-002**

- Every financial query **MUST** be scoped by the set of branches the principal is authorized for (§6), **except** for tenant-wide roles explicitly granted all-branch access.
- The authorized branch set **MUST** be derived server-side from the principal's assignments (`branchId`/`branchIds` on the authenticated user), **MUST NOT** be accepted from client input for the purpose of scoping. A `branchId` supplied as a query/filter parameter **MUST** be intersected with the principal's authorized set, never used to widen it.
- Cross-branch exposure is a **P0** violation. (See ADR-FEE-002 for the full branch-assignment model, including additive assignment — §6.)

---

## 6. Role Rules (normative)

Branch scope below refers to the authorized branch set from §5.2.

- **`SCHOOL_OWNER`** (**AUTH-010**) — **MUST** have access to all branches within the tenant.
- **`PRINCIPAL` / `VICE_PRINCIPAL`** (**AUTH-011**) — **MUST** be limited to their assigned branch(es).
- **Finance roles (`ACCOUNTANT`, and any dedicated finance-manager/cashier role)** (**AUTH-012**) — **MUST** be limited to their **explicitly assigned** branch set. Branch assignment for finance staff is **additive and per-user, not implied by role**: a finance user assigned three branches may see exactly those three; the role alone grants no branch. (This is the ADR-FEE-002 additive-assignment rule; restated here because §5.2 enforcement depends on it.)
- **`TEACHER` / `CLASS_TEACHER`** (**AUTH-013**) — **MUST NOT** have finance access by default. Any finance visibility for a teacher (e.g. a class-teacher viewing their class's fee status) **MUST** be an explicit, separately-granted capability, and until such a capability is defined by a future ADR, teachers are default-denied (§11).
- **`PARENT`** (**AUTH-014**) — **MUST** be limited to students with whom they have an Active Guardian Relationship (§3.1). A parent **MUST NOT** access any record of any student they are not actively guardian-linked to — including siblings not linked to them.
- **`STUDENT`** (**AUTH-004**) — **MUST NOT** access financial data by default. Student self-visibility of financial records is a **school-configurable policy that defaults to disabled**; where not explicitly enabled by the tenant, a student is default-denied. (Rationale: minor financial visibility is sensitive and school-policy-dependent; default-deny is the safe default. A student **MUST NOT** be silently bundled with `PARENT` access.)
- **`SUPER_ADMIN` / platform roles** (**AUTH-015**) — platform-side; out of scope for tenant financial-data visibility (see §2). Platform access to tenant financial data, if any, is governed separately and is not granted by this ADR.

---

## 7. Field Classification (normative) — **AUTH-020**

Access to an entity (§6) does **not** imply access to all of its fields. Fields are classified; the classification below is binding. Any field not listed **MUST** default to **staff-only** (§11).

| Field class | Examples | `PARENT` / `STUDENT`* | Branch-authorized staff |
|---|---|---|---|
| **Financial amounts** | invoice total/subtotal/due, payment amount, refund amount | **MAY** see | **MAY** see |
| **Due dates / schedule** | invoice `dueDate`, installment dates | **MAY** see | **MAY** see |
| **Student-facing reasons** | late-fee parent-facing reason, discount *amount* | **MAY** see | **MAY** see |
| **Statuses** | invoice/payment/refund status | **MAY** see | **MAY** see |
| **Internal approval notes** | `DiscountApproval.approvalNote`, `approverNote` | **MUST NOT** see | **MAY** see |
| **Approver / actor identity** | discount `approvedBy`, refund `initiatedBy`, late-fee `waivedBy` | **MUST NOT** see | **MAY** see |
| **Engine / computation metadata** | late-fee `computationHash`, `engineVersion`, `calculationType`, `meta` | **MUST NOT** see | **MAY** see |
| **Audit metadata** | `AuditLog` rows, before/after payloads, actor role | **MUST NOT** see | Authorized staff only** |

\* Where student self-visibility is enabled (§6); otherwise student sees nothing.
\*\* Audit-log visibility is itself role-gated among staff; not all staff may read audit metadata. A future ADR MAY refine which staff roles read audit logs; until then, default-deny for any role not explicitly granted.

**Concrete frozen consequences** (derived from the table; stated explicitly to remove ambiguity for FEE-0):

- A parent **MAY** see a discount's *amount*, but **MUST NOT** see its approval note or the identity of the approver.
- A parent **MAY** see a late fee's *amount and parent-facing reason*, but **MUST NOT** see its `computationHash`/`engineVersion`/internal `meta`.
- A parent **MAY** see a refund's *amount and status*, but **MUST NOT** see which staff member (`initiatedBy`) issued it.
- A parent **MUST NOT** see any field of any student they are not actively guardian-linked to (this is an entity-level deny per §6, restated to prevent field-level leakage via includes/joins).

---

## 8. Student Financial Account vs Raw Ledger (normative) — **AUTH-021**

- Parents and students (where enabled) **MUST** see financial history **only** through the Student Financial Account projection (§3, FEE-4).
- Parents and students **MUST NOT** access raw Ledger entries under any circumstance, through any surface (API, export, search, notification deep-link).
- The SFA projection **MUST** be designed to be parent-safe by construction: it **MUST NOT** surface reversal noise, staff-side adjustments, internal correction entries, or any field classified staff-only in §7. Parent-safety is a property of the projection's design, not a filter bolted on at the endpoint.
- Raw Ledger access is **staff-only**, branch-scoped (§5.2), and further role-gated per §7's audit/engine-metadata rules.

---

## 9. Search / List / Detail / Export (normative) — **AUTH-030**

- **Detail ⊆ List.** If a principal cannot see an entity in an authorized list query, they **MUST NOT** be able to fetch it by ID. (Directly closes the audit's "any authenticated user can `GET /billing/invoices/:id`" P0.)
- **Search = Detail.** Search/lookup authorization **MUST** be identical to detail authorization; search **MUST NOT** reveal the existence, identifiers, or any field of entities the principal cannot access in detail.
- **Export ⊆ UI.** Exports **MUST** apply the exact same tenant/branch/role/ownership and field-classification filters as the corresponding list/detail endpoints. An export **MUST NOT** expose any row or field not reachable through an authorized non-export surface.
- **List scoping is mandatory.** List endpoints **MUST NOT** return tenant-wide or branch-wide data to a principal whose authorized scope is narrower; the scope filter is applied server-side (§5), never delegated to a client-supplied parameter.

---

## 10. Authorization Invariants (normative; become FEE-0 verification criteria)

The following invariants are binding and **MUST** each be covered by an explicit test in FEE-0's Definition of Done (cross-role and cross-branch verification). They are written as assertions precisely so they can be lifted directly into the test plan:

- **INV-1.** Every detail endpoint's authorization **MUST** be a subset of its list endpoint's authorization. (Detail ⊆ List.)
- **INV-2.** Export **MUST NOT** expose any data unavailable through the UI/API for that principal. (Export ⊆ UI.)
- **INV-3.** Search authorization **MUST** equal detail authorization. (Search = Detail.)
- **INV-4.** Notifications **MUST NOT** reveal information the recipient cannot subsequently view through an authorized surface. (Ties ADR-FEE-006 to this document.)
- **INV-5.** Authorization **MUST** be enforced server-side; UI restrictions are advisory only and **MUST NOT** be the sole enforcement point.
- **INV-6.** Cross-tenant isolation **MUST** hold for every financial entity and every surface. (P0.)
- **INV-7.** Cross-branch isolation **MUST** hold for every financial entity and every surface, including when a `branchId` is supplied as a client filter. (P0.)
- **INV-8.** Ownership enforcement **MUST** hold: a `PARENT`/`STUDENT` reaches only their own/guardian-linked records, at both entity and field level.
- **INV-9.** Authorization **MUST** constrain data retrieval itself. Implementations **MUST NOT** retrieve a broader result set and subsequently filter unauthorized records in application code, unless no narrower retrieval is technically possible (in which case the broader retrieval **MUST** be justified in review and the in-code filter **MUST** be treated as security-critical). The default and expected shape is authorization pushed into the query predicate (tenant + branch + ownership in the `WHERE`), not post-hoc filtering of an over-broad result. (This is both a security and a performance requirement, and directly prevents the "query broad, forget to filter" class of cross-branch leak.)

---

## 11. Default-Deny Rule (normative) — **AUTH-040**

- Any (role × entity), (role × entity × field), or (role × surface) combination **not explicitly granted** by this ADR **MUST** be denied.
- New entities, fields, roles, or surfaces added in the future are **denied to all non-staff principals until this ADR is revised** to grant them explicitly. Adding a field to a financial model **MUST NOT** implicitly expose it to parents/students; new fields default to the staff-only class (§7) until classified.
- "Not yet decided" resolves to "denied," never to "allowed pending clarification."

---

## 12. Security Considerations

- Authorization **MUST** be enforced server-side, at the service/data-access layer, not merely at the controller or in the UI. UI-level hiding is advisory (INV-5).
- A missing authorization decorator/guard **MUST** fail closed (**AUTH-041**). (Directly addresses the audit finding that the current `RolesGuard` permits any authenticated user through when no `@Roles()` decorator is present — under this ADR, absence of an explicit grant is a denial, so finance endpoints **MUST NOT** rely on decorator-absence defaulting to allow.)
- Financial mutation endpoints (create/approve/refund/mutate) are subject to the same tenant/branch/role model; this ADR's read-focused rules do not relax write authorization, which is at least as strict.

---

## 13. Implementation Guidance (non-normative)

This section is advisory; it does not add or relax requirements.

- FEE-0 implements this ADR first, before any Ledger/Posting-Engine work (which is ADR-004/005 and FEE-3).
- FEE-0's most urgent, live-exploitable items map directly to §9 and §6: add explicit role + ownership + branch enforcement to the finance `GET` endpoints the audit found unguarded (invoices list/detail, payment history, discounts list/detail, fee-plan-by-student), and fix the client-supplied `branchId` in the defaulters endpoint to intersect-not-widen (§5.2).
- Because §12 requires fail-closed behavior, teams **should** consider a finance-specific guard/interceptor that denies by default unless an explicit finance-authorization policy is attached, rather than relying on the generic role guard's allow-on-absence behavior.
- The §10 invariants are written to be lifted verbatim into the FEE-0 test matrix; each INV-n should have at least one passing cross-role and (where applicable) cross-branch test before FEE-0 is considered done.

---

## Deferred Decisions

The following are **not** gaps in this ADR — this ADR is complete. They are decisions that intentionally live under another ADR's authoritative ownership, listed here for cross-reference and to keep the ADRs in sync:

1. **Invoice posting recognition point.** This ADR's default position (aligned with the design discussion) is that a **receivable is recognized when an Invoice transitions to `SENT`**, not at DRAFT/generation — DRAFT remains editable and produces no ledger footprint, avoiding reversal noise. This is stated here for visibility because it affects when a parent can *see* an invoice (a parent **SHOULD NOT** see a DRAFT invoice, since it is not yet a recognized receivable). The authoritative home for the recognition decision is **ADR-FEE-004 (Ledger Architecture)**; this ADR must stay consistent with whatever ADR-004 freezes. Flagged to keep the two in sync.
2. **Student self-visibility policy shape.** §6 freezes the *default* (disabled). The exact per-school configuration mechanism is deferred to whichever ADR owns tenant financial configuration; §6's default-deny holds until then.
3. **Teacher finance capability.** §6 default-denies teachers. If a class-teacher fee-status view is ever wanted, it needs an explicit grant in a future revision.
4. **Which staff roles may read audit metadata** (§7, footnote **) — deferred; default-deny until explicitly granted.

---

## Appendix A — Decision ID Index

Stable identifiers for every normative rule, so implementation tickets and code review can reference them directly (e.g. "Implements AUTH-003") rather than by section number. IDs are stable across future revisions; a rule's ID does not change even if its section is renumbered.

| ID | Rule | Section |
|---|---|---|
| AUTH-001 | Tenant isolation (server-derived, never client-supplied) | §5.1 |
| AUTH-002 | Branch isolation (intersect-not-widen) | §5.2 |
| AUTH-003 | Guardian ownership evaluated against persistent state, not JWT | §3.1 |
| AUTH-004 | Student default-deny (self-visibility off unless enabled) | §6 |
| AUTH-005 | Conflict resolution (most-restrictive-wins) + missing context fails closed | §4.1 |
| AUTH-010 | School Owner → all branches | §6 |
| AUTH-011 | Principal / Vice-Principal → assigned branch(es) | §6 |
| AUTH-012 | Finance roles → explicitly-assigned, additive branch set | §6 |
| AUTH-013 | Teacher → no finance access by default | §6 |
| AUTH-014 | Parent → active guardian-linked students only | §6 |
| AUTH-015 | Super-admin / platform → out of scope here | §6 |
| AUTH-020 | Field classification (parent-visible vs staff-only) | §7 |
| AUTH-021 | SFA projection only for parent/student; raw Ledger staff-only | §8 |
| AUTH-030 | Search/List/Detail/Export authorization equivalences | §9 |
| AUTH-040 | Default-deny for any ungranted combination | §11 |
| AUTH-041 | Missing guard fails closed | §12 |
| INV-1 … INV-9 | Authorization invariants (FEE-0 verification criteria) | §10 |

## Appendix B — Compliance Matrix (to be completed during FEE-0)

Populated as FEE-0 implements and tests each rule. Left blank here deliberately — this is the living traceability record from contract → code → test, filled in during implementation, reviewed at FEE-0 Definition-of-Done.

| Requirement | Implemented In | Test |
|---|---|---|
| AUTH-001 | *(FEE-0)* | *(FEE-0)* |
| AUTH-002 | *(FEE-0)* | *(FEE-0)* |
| AUTH-003 | *(FEE-0)* | *(FEE-0)* |
| AUTH-004 | *(FEE-0)* | *(FEE-0)* |
| AUTH-010 … AUTH-015 | *(FEE-0)* | *(FEE-0)* |
| AUTH-020 | *(FEE-0)* | *(FEE-0)* |
| AUTH-021 | *(FEE-4 — SFA projection)* | *(FEE-4)* |
| AUTH-030 | *(FEE-0)* | *(FEE-0)* |
| AUTH-040 | *(FEE-0)* | *(FEE-0)* |
| AUTH-041 | *(FEE-0)* | *(FEE-0)* |
| INV-1 … INV-9 | *(FEE-0)* | *(FEE-0 cross-role / cross-branch suite)* |

## Appendix C — ADR Traceability

Where decisions referenced by this ADR are authoritatively owned:

| ADR | Owns (relative to this ADR) |
|---|---|
| ADR-FEE-002 | Branch assignment model (the additive, per-user assignment that AUTH-002/AUTH-012 depend on) |
| ADR-FEE-003 | Financial immutability (no hard delete; underpins why history is append-only and thus how it's exposed) |
| ADR-FEE-004 | Ledger architecture + invoice recognition point (Deferred Decision 1) |
| ADR-FEE-005 | Financial Posting Engine (the single writer whose outputs this ADR governs read-access to) |
| ADR-FEE-006 | Notification eligibility — derives from this ADR (INV-4) rather than maintaining its own matrix |
