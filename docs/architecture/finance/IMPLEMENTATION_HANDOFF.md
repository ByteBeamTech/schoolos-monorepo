# IMPLEMENTATION_HANDOFF.md

*Generated from direct repository inspection (schema, service code, controllers, git history) and the 3 accepted/in-progress finance ADRs, all re-read from disk on the date this package was generated. No content is reconstructed from conversation memory.*

---

## 1. Current Project Status

SchoolOS's student-billing (finance) module has completed its **architecture-definition phase** and has **not yet begun implementation** against that architecture. Three ADRs govern the finance module; two are `Accepted`, one is `Freeze Candidate` pending final sign-off. No code changes implementing any ADR's rules have been made yet, with one exception (§2).

## 2. Completed Work

| Item | State (verified against repo) |
|---|---|
| Comprehensive production-readiness audit of `student-billing` module | Complete. Findings verified directly against schema/service/controller code, not assumed. |
| ADR-FEE-001 (Financial Data Visibility) | **Accepted (v1.2)** |
| ADR-FEE-002 (Branch Isolation) | **Accepted (v1.0)** |
| ADR-FEE-003 (Financial Immutability) | **Freeze Candidate**, pending final review sign-off → v1.0 |
| Target Financial Architecture (Roadmap document) | Complete as a directional/non-normative reference |
| `InvoiceStatus.EXPIRED` removal | Verified as dead code (repo-wide search: never set, never read, anywhere in `student-billing`), removed from `backend/prisma/schema/enums.prisma`. Committed (`019345d`). **A Prisma migration is required and has NOT been run** — pre-check required (see §7). |

No other code changes have been made against the finance module. Every bug the audit identified (§4 below) is still present in the current codebase — this was re-verified directly, not assumed, immediately before this handoff package was generated.

## 3. Architecture Status

Governing documents, in dependency order:

1. **ADR-FEE-001 — Financial Data Visibility** (Accepted v1.2): the authorization model — tenant/branch/role/ownership, field classification, Student Financial Account vs. raw Ledger, default-deny, conflict resolution.
2. **ADR-FEE-002 — Branch Isolation** (Accepted v1.0): the branch-scoping model — `UserBranch` as the canonical mechanism (already exists in code and is correct), `SCHOOL_OWNER`/`SCHOOL_ADMIN` tenant-wide rules, client-parameter handling, background-job scoping.
3. **ADR-FEE-003 — Financial Immutability** (Freeze Candidate): state machines, corrections vs. reversals, no-hard-delete, period freeze, concurrency, idempotency, retention, audit requirements.
4. **Target Financial Architecture (Roadmap)**: non-normative, directional. Defines where the module is headed (Financial Engine, Payment Platform, Ledger v2/Journal, Phases 1–5) without authorizing any of it to start. Architectural Invariants in this document sit *above* the roadmap and are the highest-priority rules in the whole package.

None of the three ADRs' rules are implemented in code yet. They describe the **target state**; the current codebase has known, documented gaps against all three (see `IMPLEMENTATION_BACKLOG.md` Epic FEE-0/FEE-1).

## 4. Accepted ADRs (Summary)

See `ADR_INDEX.md` for the full table. In brief:
- **ADR-FEE-001**: default-deny authorization; parents/students see only their own guardian-linked records via a Student Financial Account projection, never raw Ledger; staff see within their branch; 9 testable invariants (INV-1…9).
- **ADR-FEE-002**: `UserBranch` (already correct in code) is canonical; `SCHOOL_OWNER` always tenant-wide, `SCHOOL_ADMIN` tenant-wide by default but administratively restrictable; client-supplied branch params intersect, never widen; background jobs must be tenant-scoped, not run as unscoped global sweeps. 4 more invariants (INV-10…13).
- **ADR-FEE-003** (pending final acceptance): financial facts are immutable once occurred; corrections only pre-fact, reversals only post-fact; no hard delete, no soft-delete flags — real terminal states instead; period freeze (closed sessions/FY accept only reversals); optimistic concurrency required (mechanism-agnostic); idempotency required on every retryable mutation; retention duration is an open legal/compliance question this ADR cannot supply. 6 more invariants (INV-14…19).

## 5. Roadmap Status

Two roadmaps exist and are cross-referenced against each other:
- **`FEE-0` … `FEE-8`** — the near-term, code-grounded implementation sequence for the *current* fee module. **This label was never previously written to a standalone document** — it existed only in prior discussion. It has been reconstructed for this handoff, by cross-referencing all three ADRs' Compliance Matrix appendices and the Roadmap document's own `FEE-`-prefixed citations, into `IMPLEMENTATION_BACKLOG.md`. That document is now the authoritative source for what each `FEE-N` contains.
- **Phase 1 … Phase 5** — the longer-horizon Target Architecture evolution phases (Roadmap document). Each phase has explicit, testable exit criteria. Phase 1 overlaps `FEE-0`→`FEE-4`.

Status of every ADR slot (finalized, sourced from the Roadmap document's own status table, re-verified against each ADR file's own header):

| ADR | Status |
|---|---|
| ADR-FEE-001 | Accepted (v1.2) |
| ADR-FEE-002 | Accepted (v1.0) |
| ADR-FEE-003 | Freeze Candidate (pending final review → v1.0) |
| ADR-FIN-001 … ADR-FIN-006 | Reserved (Not Started) — not scheduled, not authorized to begin |

## 6. Outstanding Work

1. **ADR-FEE-003 final review** — the last open item (`EXPIRED` semantics) is resolved; remaining Deferred Decisions (legal retention duration, period-freeze mechanism, discount-reversal accounting effect) are non-blocking by their own framing. Promotion to `Accepted v1.0` needs an explicit sign-off pass, same rigor as ADR-001/002.
2. **`EXPIRED` removal migration** — patch generated, **not run**. Before running: confirm zero existing `Invoice` rows have `status = 'EXPIRED'` in production (`SELECT COUNT(*) FROM "Invoice" WHERE status = 'EXPIRED';`). If any exist, they need an explicit target-status decision before the enum value can be dropped.
3. **`FEE-0` (Security Hardening)** — not started. This is the literal next implementation step. See `IMPLEMENTATION_BACKLOG.md`.
4. Every other `FEE-N` and every `ADR-FIN-N` — not started, in dependency order per `IMPLEMENTATION_BACKLOG.md`.

## 7. Immediate Next Implementation Steps

In order:

1. Get ADR-FEE-003 to `Accepted v1.0` (review pass; no code work).
2. Run the `EXPIRED`-removal migration pre-check (§6.2) and, if clear, apply the migration.
3. Begin `FEE-0` (Security Hardening) per `IMPLEMENTATION_BACKLOG.md` — this is P0, live-exploitable, and independent of everything else. Do not start `FEE-1` or later before `FEE-0`'s acceptance criteria pass.
4. Do not start any `ADR-FIN-0xx` work. Those are reserved slots for the Target Architecture, unrelated to and not blocking `FEE-0`.

## 8. Coding Conventions (verified from repo, not invented)

- **Monorepo**: pnpm workspaces. `backend/` (NestJS 10, Prisma 5.11, TypeScript 5.3.3), `frontend/` (tenant-facing, Next.js 14.2/React 18.3), `superadmin/` (platform staff, Next.js 14.2/React 18.3), `mobile/`, `packages/`.
- **Prisma schema is split by domain** under `backend/prisma/schema/<domain>/*.prisma` (e.g. `student-billing/`, `core/`), with a shared `enums.prisma`.
- **Money fields**: `Decimal` with `@db.Decimal(12, 2)` — never float. This convention is already correctly followed everywhere in `student-billing` and must continue.
- **Every model carries `tenantId`; branch-scoped models also carry `branchId`**, each with at least a standalone and a composite `(tenantId, branchId)` index. Continue this pattern for any new model.
- **State machines are plain Prisma enums** (`InvoiceStatus`, `PaymentStatus`, `RefundStatus`, `LateFeeStatus`, `ApprovalStatus`) — no separate state-machine library in use.
- **Audit logging** goes through a shared `AuditService` (`this.audit.logCreate/logUpdate(...)`), with `action` values validated against the `AuditAction` enum — a value not in that enum throws `PrismaClientValidationError`, silently swallowed by `AuditService.log()`'s own try/catch (this exact bug class has been found and fixed multiple times in this codebase — see `RefundService`'s `REFUND_INITIATED` bug, `IMPLEMENTATION_BACKLOG.md` FEE-1).

## 9. Important Architectural Rules

The 5 **Architectural Invariants** from the Roadmap document, verbatim in effect (full text: `ARCHITECTURE_STATE.md` / the Roadmap document itself):

1. Only the Financial Engine creates financial documents and accounting entries; other modules only request charges.
2. Modules never own invoice/payment/accounting logic.
3. A projection (Student Due, Student Financial Account) is never the source of truth.
4. Payment technology never owns accounting.
5. Posted/occurred financial documents are immutable; corrections happen only through new opposing records.

Plus every `MUST`/`MUST NOT` rule in ADR-FEE-001/002/003 (`AUTH-001`…`058`, `IMM-001`…`023`, `INV-1`…`19`) is binding on any new implementation work, not advisory.

## 10. Things That Must Never Be Changed Accidentally

- **`AUTH-0xx` / `IMM-0xx` / `INV-N` decision IDs are append-only and never renumbered.** A new rule gets the next unused ID in its series; an existing ID's meaning never changes without a formal ADR revision.
- **The `UserBranch` model and its resolution mechanism (`JwtStrategy`, `BranchContextMiddleware`)** — already correct per ADR-FEE-002's audit; do not "refactor" this without a specific, verified reason. Per-request DB resolution (not JWT-cached) is a hard requirement (`AUTH-050`), not a style choice.
- **`Receipt.paymentId @unique` must be preserved** even when fixing the `Receipt.invoiceId @unique` bug (`FEE-1`) — one receipt per payment is the correct invariant; one receipt per invoice is the bug.
- **No hard-delete endpoint and no `deletedAt` field may ever be added to a financial model** (`IMM-009`/`IMM-010`) — this is a currently-clean baseline the codebase has never violated; keep it that way.
- **`InvoiceStatus.EXPIRED` must not be reintroduced.** Verified dead code, removed for cause (see §2). If a future need for an "expired invoice" concept arises, it needs a fresh ADR-level decision, not a silent re-add of the old enum value.
- **Do not implement double-entry/Journal/Gateway-Clearing (Phase 4 / `ADR-FIN-005`) before Ledger v1 (`FEE-3`) exists and before `FEE-0`/`FEE-1`/`FEE-2` are done.** The Roadmap explicitly sequences this; skipping ahead contradicts the Roadmap's own stated dependency order.
- **Do not start any `ADR-FIN-0xx` work without first checking `ADR_INDEX.md` and the Roadmap's dependency graph** — several have hard prerequisites (e.g. `ADR-FIN-005` needs `ADR-FIN-004`'s confirmation events to exist first).
