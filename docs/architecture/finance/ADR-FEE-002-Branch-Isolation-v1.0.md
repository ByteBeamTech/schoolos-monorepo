# ADR-FEE-002 — Branch Isolation

**Status:** Accepted (v1.0)
**Depends on:** ADR-FEE-001 (Financial Data Visibility) — this ADR is the authoritative home for AUTH-002 and AUTH-012, which ADR-001 references but does not define.
**Cross-references:** Finance Architecture Principles, ADR-FEE-005 (Posting Engine — background job scoping), ADR-FEE-006 (Domain Events)

| | |
|---|---|
| **Authors** | SchoolOS Finance Architecture |
| **Reviewers** | Principal Software Architect, SchoolOS Finance Architecture — sign-off given |
| **Created** | 2026-07-19 |
| **Accepted** | 2026-07-19 |
| **Version** | 1.0 |

---

## 1. Purpose

This ADR defines the normative model for branch-scoped access to financial data — who is scoped to which branches, how the effective branch context is resolved per request, and how tenant-wide roles interact with branch-scoped data (aggregation, not bypass).

Normative keywords **MUST**, **MUST NOT**, **SHOULD**, **MAY** per RFC 2119, consistent with ADR-FEE-001.

### 1.1 Non-Goals

This ADR does **not** define: role-to-branch *business* policy (who *should* be assigned where — an operational/admin decision, not architecture); the branch-assignment administration UI; tenant isolation (ADR-FEE-001 §5.1, AUTH-001); field-level visibility (ADR-FEE-001 §7); background-job *business logic* (only its branch-scoping shape, §7 below — the logic itself belongs to whichever service owns the job).

---

## 2. Existing Reference Implementation (Normative Baseline)

Unlike ADR-FEE-001, this ADR is not designed from scratch — a correct reference implementation already exists in the codebase. The current implementation was reviewed and is consistent with the model this ADR defines. This ADR's role is to **canonize that model as the mandatory contract**, close the one policy gap found (§3), and specify what's still missing (cross-branch aggregation, job scoping). Where implementation and this ADR agree today, this ADR — not the code — is the authority going forward; a future implementation change that drifts from this ADR is the implementation's error to fix, not grounds to reinterpret the ADR.

- **Assignment model**: a `UserBranch` join row per (user, branch), with `isActive` and `isDefault`. This is the additive, per-user assignment ADR-FEE-001 §6/AUTH-012 requires — branch access is granted by row, never implied by role. AUTH-051's default-branch fallback (below) depends on exactly one `isDefault: true` row existing among a user's active assignments at any time; this is a data-integrity requirement the implementation **MUST** enforce (a database constraint is the natural mechanism), not a policy this ADR itself defines.
- **Per-request resolution, not token-cached**: the authenticated user's branch set (`branchIds`) and default branch (`branchId`) are resolved from the database **on every request** (only `isActive: true` mappings), not embedded in and trusted from the JWT. This already satisfies the same "persistent state, not token claims" principle ADR-FEE-001 AUTH-003 mandates for guardian ownership — restated here as **AUTH-050**: **branch authorization MUST be resolved from current persistent `UserBranch` state on every request; a JWT MAY carry a `tenantId`/`sub` for identification but MUST NOT be the source of truth for which branches a principal may access.**
- **Active-branch switching**: an `x-branch-id` request header, when present, **MUST** be validated against the resolved `branchIds` set (403 if not a member) before being accepted as the request's effective branch (**AUTH-051**, formalizing the existing `BranchContextMiddleware` behavior). A header value **MUST NOT** be able to widen access beyond the resolved set — it selects among authorized branches, it does not grant new ones. This is the concrete mechanism that satisfies ADR-FEE-001 AUTH-002 ("intersect, never widen"). When the header is **absent**, the request's effective branch **MUST** fall back to the principal's default branch (the `UserBranch` row marked `isDefault`, or — for tenant-wide roles under AUTH-052/AUTH-058 — the tenant-wide scope itself).

## 3. `SCHOOL_ADMIN` Branch Scope

`SCHOOL_OWNER` is always tenant-wide, per AUTH-052 (§4) — unconditional, not subject to administrative restriction.

`SCHOOL_ADMIN` is **tenant-wide by default** (**AUTH-058**). The owner **MAY** administratively restrict a `SCHOOL_ADMIN` to one or more branches, using the existing `UserBranch` infrastructure (§2) as the mechanism — the same mechanism, and the same additive per-user model, already used for `PRINCIPAL`/finance roles (AUTH-012, AUTH-053).

- **Unrestricted** `SCHOOL_ADMIN` (no active `UserBranch` restriction exists): the effective branch scope **MUST** be all branches in the tenant. Such a `SCHOOL_ADMIN` **MUST** be able to use the branch selector (AUTH-051's `x-branch-id` mechanism) to choose a current working branch from the full tenant branch set.
- **Restricted** `SCHOOL_ADMIN` (one or more active `UserBranch` rows): the effective branch scope **MUST** be exactly those assigned, active branches — no more. A restricted `SCHOOL_ADMIN` **MUST** follow exactly the same branch authorization rules as every other branch-scoped operational role (AUTH-053): resolved from persistent state per request (AUTH-050), fails closed if the assignment set is ever empty, and sees/switches only among assigned branches.
- **Branch switching never widens authorization.** For both unrestricted and restricted `SCHOOL_ADMIN`, selecting an active branch via AUTH-051's header mechanism only changes the *current working context* within the caller's already-resolved effective branch scope — it **MUST NOT** be a separate grant of access. The branch selector itself is a UI concern (which branch is currently displayed); the authorization that makes a branch selectable or not is server-side, per AUTH-050/AUTH-051 — a client-side selector **MUST NOT** be treated as an enforcement mechanism. The selector represents the current operational context only; a future implementation **MUST NOT** treat it as a frontend-only authorization mechanism.
- ADR-FEE-001 §6/AUTH-010 named only `SCHOOL_OWNER` as all-branch and did not address `SCHOOL_ADMIN`; ADR-FEE-001 **SHOULD** receive a short errata note: *"ADR-FEE-002 AUTH-058 defines `SCHOOL_ADMIN` branch scope."* Nothing more.

## 4. Tenant-Wide Roles vs. Branch-Scoped Roles

| Role | Branch scope | Mechanism |
|---|---|---|
| `SUPER_ADMIN` | Out of scope (platform) | N/A — ADR-FEE-001 AUTH-015 |
| `SCHOOL_OWNER` | **AUTH-052**: all branches in tenant, always | The effective branch scope for this role is all active branches within the tenant, unconditionally — the only role class not subject to administrative restriction. All roles reaching a financial endpoint without this unconditional grant **MUST** have a resolved, non-empty authorized branch set — see AUTH-053/AUTH-058. |
| `SCHOOL_ADMIN` | **AUTH-058**: all branches in tenant **by default**; administratively restrictable to a specific set (§3) | Unrestricted: same effective scope and branch-selector behavior as `SCHOOL_OWNER`. Restricted (active `UserBranch` rows exist): follows AUTH-053 exactly, like `PRINCIPAL`/finance roles. |
| `PRINCIPAL` / `VICE_PRINCIPAL`, finance roles (`ACCOUNTANT`, cashier/finance-manager equivalents) | **AUTH-053**: exactly their `UserBranch`-assigned, active branches — one or more, additive | Resolved per §2; **MUST** fail closed (no default-allow) if the user has zero active branch mappings and is not a tenant-wide role — mirrors the existing `UnauthorizedException('No branch assigned to user.')` behavior, which this ADR ratifies as the correct behavior, not an incidental one. |
| `TEACHER` / `CLASS_TEACHER`, `PARENT`, `STUDENT` | N/A for branch dimension | Branch isolation is moot for roles that have no finance access at all (`TEACHER`, ADR-FEE-001 AUTH-013) or whose access is ownership-scoped rather than branch-scoped (`PARENT`/`STUDENT`, AUTH-003/AUTH-014). Branch **MUST NOT** be used as an *additional* restriction on top of ownership for these roles — ownership alone is the correct and sufficient scope. |

## 5. Client-Supplied Branch Parameters (closes the audit's P0 finding)

- **AUTH-054**: Any branch identifier accepted from client input (query parameter, request body, path parameter) for filtering or scoping a financial query **MUST** be intersected with the principal's resolved authorized branch set (§2, §4) before being applied. It **MUST NOT** be used to widen the query beyond that set, and it **MUST NOT** be trusted as the sole scoping mechanism.
- If a client-supplied branch value is **not** in the principal's authorized set: the request **MUST** be denied (403) for branch-scoped roles: it **MUST NOT** silently fall back to "all branches" or to the user's default branch, since either behavior can leak more than the caller asked for or mask the authorization failure.
- For tenant-wide roles (§4), an explicit client-supplied branch value **MAY** be honored as a filter (narrowing a tenant-wide query to one branch) since it cannot widen access that role doesn't already have.
- This directly resolves the audit's finding that a defaulters-report endpoint accepted a client-supplied `branchId` with no server-side cross-check — under this ADR, that pattern is a defined violation of AUTH-054, not merely a bug to patch ad hoc.

## 6. Cross-Branch Aggregation (Reports, Analytics, Exports)

- **AUTH-055**: A tenant-wide role (§4) **MAY** receive a genuinely aggregated, all-branch view (e.g. a tenant-wide collection-rate dashboard). A branch-scoped role **MUST** receive only their authorized branch(es)' data, even in an aggregate/summary view — an "aggregate" is not an exemption from AUTH-002/AUTH-053.
- Where a report presents a per-branch breakdown to a tenant-wide viewer, each branch's figures **MUST** still be individually attributable and correct (no silent merging that would make branch-level drill-down impossible) — this is a forward-looking requirement for FEE-8 (enterprise reports/analytics), since the current `AnalyticsService` has no branch breakdown at all today (tenant-wide only) and will need one to satisfy this.
- Exports inherit list/detail authorization per ADR-FEE-001 AUTH-030 (Export ⊆ UI); the same branch-intersection rule (§5) applies to export filters as to list filters.

## 7. Background Jobs (Branch-Scoping Shape)

Financial background jobs (late-fee application, reminders, any future scheduled posting) present a distinct risk: they run without a per-request principal, so §2's per-request resolution doesn't apply directly. This ADR requires:

- **AUTH-056**: A financial background job **MUST** iterate its work scoped by `tenantId`, and, where the job's unit of work is branch-attributable, **MUST** either scope by `(tenantId, branchId)` per batch or otherwise ensure every unit of work carries and is written with its correct `tenantId`/`branchId` — a job **MUST NOT** run an unscoped, platform-wide query and rely on per-row `tenantId` values alone to make the operation "safe," if that shape also creates the fairness/starvation problem the audit identified (a global cap silently favoring whichever rows a default, unordered query happens to return first).
- **AUTH-057**: Job batching **SHOULD** be tenant-batched at minimum (per-tenant checkpointed work units via a queue, not a single unbounded in-process loop across all tenants) so that one tenant's volume cannot starve another's. Further decomposition (per-branch, per-invoice sub-jobs) **MAY** be added later if real load requires it; it is explicitly **not** required upfront (premature decomposition is out of scope — see the design discussion this ADR formalizes).
- This directly targets the audit's finding that the late-fee cron runs an unscoped, platform-wide query capped at a fixed row count with no ordering guarantee — under AUTH-056/057, that shape is a defined violation, to be fixed when that job is wired up (FEE-2/FEE-7).

## 8. Authorization Invariants (extends ADR-FEE-001 §10)

These extend, and **MUST** be verified alongside, ADR-FEE-001's INV-1…INV-9:

- **INV-10.** A client-supplied branch parameter **MUST NOT** ever result in data outside the principal's resolved authorized branch set, for any role. (Formalizes AUTH-054 as a testable assertion.)
- **INV-11.** A principal with zero active branch mappings, who is not a tenant-wide role, **MUST** be denied — not silently granted an empty or tenant-wide result. (Formalizes the fail-closed clause of AUTH-053.)
- **INV-12.** Every financial background job's write **MUST** carry a correct, non-null `tenantId` and (where applicable) `branchId` traceable to a real record, and job scheduling **MUST NOT** systematically exclude any tenant's data by construction (starvation check, AUTH-056/057).
- **INV-13.** Changes to `UserBranch` assignments **MUST** take effect for all subsequent authorized requests without requiring JWT regeneration — i.e. revoking or granting a branch assignment is reflected on the very next request, not only after the principal's token is reissued. (Makes AUTH-050 directly testable: grant/revoke a `UserBranch` row mid-session and confirm the next request reflects it.)

## 9. Conflict Resolution

Per ADR-FEE-001 AUTH-005 (most-restrictive-wins, missing-context-denies), which this ADR does not restate but explicitly inherits: where this ADR's branch rules and ADR-FEE-001's role/ownership rules could be read as disagreeing, the **more restrictive** reading governs, and any missing branch-resolution context (§2) is a denial, not a fallback to tenant-wide.

---

## Deferred Decisions

1. **Per-branch analytics breakdown** (§6) — the *requirement* is frozen here (AUTH-055: an aggregate view MUST NOT exceed the principal's authorized branch set); the *implementation* is FEE-8 (Enterprise Reports/Analytics), not this ADR. Specifically left open for that future ADR: for a multi-branch-restricted role (e.g. a `SCHOOL_ADMIN` restricted to Lucknow and Kanpur), whether an unscoped endpoint like `GET /analytics` defaults to the *current* branch context (AUTH-051's default/selected branch) or an *aggregate* across the full authorized set — both are AUTH-055-compliant (neither exceeds the authorized set), so this is a product/UX decision for the reporting ADR to make, not an authorization gap in this one.
2. **Job decomposition beyond tenant-batching** (§7, AUTH-057) — deferred until real load data justifies it.

## Appendix A — Decision ID Index (continues ADR-FEE-001's AUTH-0xx series)

Decision identifiers are append-only and are never renumbered — a new decision gets the next unused ID (as AUTH-058 did here), regardless of which section it belongs to.

| ID | Rule | Section |
|---|---|---|
| AUTH-050 | Branch authorization resolved from persistent state per request, not JWT | §2 |
| AUTH-051 | `x-branch-id` header validated against resolved set; selects, never widens | §2 |
| AUTH-052 | `SCHOOL_OWNER` is tenant-wide, always (unconditional) | §3, §4 |
| AUTH-053 | Branch-scoped roles limited to active `UserBranch` assignments; fail closed if none | §4 |
| AUTH-054 | Client-supplied branch params intersect, never widen; deny (not fallback) if out of set | §5 |
| AUTH-055 | Aggregation does not exempt branch-scoped roles; per-branch attributability required | §6 |
| AUTH-056 | Background jobs scoped by tenant (+ branch where attributable); no unscoped global sweep | §7 |
| AUTH-057 | Tenant-batched job scheduling minimum; further decomposition deferred | §7 |
| AUTH-058 | `SCHOOL_ADMIN` is tenant-wide by default; administratively restrictable via `UserBranch`, then follows AUTH-053 | §3, §4 |
| INV-10 … INV-13 | Testable extensions of ADR-FEE-001 §10 | §8 |

## Appendix B — Compliance Matrix (to be completed during FEE-0)

| Requirement | Implemented In | Test |
|---|---|---|
| AUTH-050, AUTH-051 | *(already implemented — `JwtStrategy`, `BranchContextMiddleware`; FEE-0 to add regression tests)* | *(FEE-0)* |
| AUTH-052 | *(already implemented for `SCHOOL_OWNER`; FEE-0 to add regression test)* | *(FEE-0)* |
| AUTH-058 | *(FEE-0 — verify both unrestricted and restricted `SCHOOL_ADMIN` paths, including the branch selector for unrestricted)* | *(FEE-0)* |
| AUTH-053, AUTH-054 | *(FEE-0 — the controllers the audit flagged: Invoice, Payment, Discount, FeePlans)* | *(FEE-0)* |
| AUTH-055 | *(FEE-8)* | *(FEE-8)* |
| AUTH-056, AUTH-057 | *(FEE-2/FEE-7 — late-fee cron and future jobs)* | *(FEE-2/FEE-7)* |

## Appendix C — ADR Traceability

| ADR | Relationship |
|---|---|
| ADR-FEE-001 | Owns role/ownership/field authorization; this ADR owns the branch dimension it references (AUTH-002, AUTH-012) |
| ADR-FEE-005 | Posting Engine — any posting action inherits this ADR's branch-scoping for the write path, not just reads |
| ADR-FEE-006 | Job-triggered domain events (e.g. late-fee applied) inherit AUTH-056/057's scoping guarantees |
