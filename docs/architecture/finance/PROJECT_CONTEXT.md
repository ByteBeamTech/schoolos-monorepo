# PROJECT_CONTEXT.md

*Permanent context document for a new AI session working on SchoolOS's finance module. Written to be sufficient without reading any prior conversation. Facts below were verified directly against the repository (schema, package.json, git history) — not recalled from memory.*

---

## 1. Project Vision

SchoolOS is a multi-tenant, multi-branch SaaS ERP for K-12 schools. The finance/billing module currently handles student fee collection; the confirmed architectural direction (not yet a committed feature-set — see §7) is that it should not need a rewrite if the product later needs to bill for admissions, transport, hostel, library fines, events, or (further out, unconfirmed) retail/canteen/bookstore sales. The long-term shape: every billable event across the ERP eventually routes through one Financial Engine, rather than each module inventing its own invoicing/payment logic.

Read `SchoolOS-Target-Financial-Architecture-ROADMAP.md` for the full destination-state document. Read `IMPLEMENTATION_BACKLOG.md` for what to actually work on now — the two are deliberately different documents with different authority levels (see §7).

## 2. Technology Stack (verified from `package.json` files)

- **Monorepo**: pnpm workspaces (`pnpm-workspace.yaml`).
- **Backend**: NestJS `^10.3.0`, Prisma `^5.11.0` (`@prisma/client` matching), TypeScript `5.3.3`.
- **Frontend** (tenant-facing, `frontend/`): Next.js `^14.2.0` (App Router), React `^18.3.1`.
- **Superadmin** (platform staff, `superadmin/`): Next.js `^14.2.0`, React `^18.3.1` — a separate app from `frontend/`, separate auth strategy (`jwt-superadmin.strategy.ts` vs. the tenant-facing `jwt.strategy.ts`).
- **Mobile**: exists (`mobile/`) — not touched by the finance-architecture work this package covers.
- **Database**: PostgreSQL via Prisma. Schema is split by domain under `backend/prisma/schema/<domain>/*.prisma`, with a shared `enums.prisma`.

## 3. Repository Structure (relevant parts)

```
schoolos-monorepo/
├── backend/
│   ├── prisma/
│   │   ├── schema/
│   │   │   ├── enums.prisma              ← shared enums (InvoiceStatus, PaymentStatus, etc.)
│   │   │   ├── core/                     ← User, Tenant, Branch, AuditLog, etc.
│   │   │   └── student-billing/          ← FeePlan, Invoice, Payment, Discount, LateFee, Refund, Receipt, sequences
│   │   └── migrations/
│   └── src/
│       ├── core/                         ← auth (JwtStrategy, JwtSuperadminStrategy, guards), compliance (AuditService)
│       └── modules/
│           └── student-billing/          ← the finance module. Sub-folders: fee-plans, invoice, payment, discounts,
│                                            late-fee, receipt, refund, reconciliation, ledger, analytics
├── frontend/                             ← tenant-facing app (staff, parents, students)
│   └── src/app/dashboard/(finance)/      ← billing UI pages
├── superadmin/                           ← platform-staff app, separate auth
├── mobile/
└── packages/                             ← shared packages
```

Inside `student-billing/`, the pattern is `<domain>/{services,controllers,dto}/`. Only 4 of the module's ~10 services currently have a controller: `FeePlansController`, `InvoiceController`, `PaymentController`, `DiscountController` (+ `AnalyticsController` in its own sub-module). The other 5 (`ReceiptService`, `RefundService`, `ReconciliationService`, `LateFeeService`, `StandardDiscountService`) are registered as NestJS providers but have no HTTP surface — see `IMPLEMENTATION_BACKLOG.md` Epic `FEE-2`.

## 4. Coding Conventions

- **Money**: always `Decimal` with `@db.Decimal(12, 2)` in Prisma, never a float type. Followed consistently in `student-billing` today — continue it.
- **Multi-tenancy**: every model carries `tenantId`; branch-scoped models also carry `branchId`. Standard indexing pattern: standalone index on `tenantId`, composite `(tenantId, branchId)` index, plus any query-specific indexes.
- **State machines**: plain Prisma enums (e.g. `InvoiceStatus`), not a separate library. State transitions are validated in service code, not database constraints (see ADR-FEE-003 `IMM-004`/`005` for the normative requirement that only defined transitions are ever valid).
- **Audit logging**: a shared `AuditService` (`backend/src/core/compliance/`) with `logCreate`/`logUpdate` helpers. The `action` field is validated against a Prisma `AuditAction` enum — **an invalid string value throws `PrismaClientValidationError`, silently swallowed by `AuditService.log()`'s own try/catch**. This exact bug class has been found and fixed multiple times in this codebase (most recently `RefundService`'s `'REFUND_INITIATED'`, which is not a valid enum value — the real one is `REFUND_PROCESSED`). When adding a new audit call, always verify the `action` string against the actual `AuditAction` enum in `enums.prisma` before assuming it's valid.
- **Authorization**: `JwtGuard`/`RolesGuard`/`@Roles()` decorator pattern. **`RolesGuard` currently allows any authenticated user through when no `@Roles()` decorator is present** — this is the root cause of several live P0 gaps the audit found (see `IMPLEMENTATION_BACKLOG.md` `FEE-0`). Under ADR-FEE-001 `AUTH-041`, absence of an explicit grant must be treated as a denial — do not rely on decorator-absence defaulting to allow when writing new endpoints.
- **Branch resolution**: `JwtStrategy` resolves a user's `branchId`/`branchIds` from the database on every request (not cached in the JWT) — this is already correct and is the canonical pattern (ADR-FEE-002 `AUTH-050`). `BranchContextMiddleware` validates an optional `x-branch-id` header against the resolved set. Follow this exact pattern for any new branch-scoped logic; do not invent a second mechanism.
- **Numbering**: `InvoiceService` uses `pg_advisory_xact_lock` + `count()` inside a transaction for invoice/receipt numbers — this is the correct, currently-used pattern. A second, unsafe, unused implementation exists in the dead `ReceiptService` (naive `count()`, no lock) — do not copy that one. The schema also has unused `InvoiceSequence`/`ReceiptSequence` tables designed for per-`(tenantId, branchId, year)` counters that neither implementation currently uses — see `IMPLEMENTATION_BACKLOG.md` `FEE-2` for the consolidation task.

## 5. Naming Conventions

- Decision IDs across the finance ADRs: `AUTH-0xx` (authorization, ADR-FEE-001/002, single continuous series), `IMM-0xx` (immutability, ADR-FEE-003, its own series), `INV-N` (invariants, one continuous series across all finance ADRs regardless of domain). **All are append-only and never renumbered** — a new rule gets the next unused ID in its series.
- `FEE-0`…`FEE-8`: the near-term implementation Epics for the current fee module (see `IMPLEMENTATION_BACKLOG.md`).
- `ADR-FIN-0xx`: reserved slots for the longer-horizon Target Architecture ADRs (Financial Engine, Payment Platform, etc.) — none started.
- `Phase 1`…`Phase 5`: the Target Architecture's own measurable evolution phases (Roadmap document) — a different numbering axis from `FEE-N`, cross-referenced but not identical (Phase 1 overlaps `FEE-0`→`FEE-4`).

## 6. Architecture Principles

The 5 **Architectural Invariants** (Roadmap document — directional, sit above the roadmap, changing one requires reopening the architecture, not a routine revision):
1. Only the Financial Engine creates financial documents and accounting entries; other modules only request charges.
2. Modules never own invoice/payment/accounting logic.
3. A projection is never the source of truth.
4. Payment technology never owns accounting.
5. Posted/occurred financial documents are immutable; corrections happen only through new opposing records.

Plus every binding `MUST`/`MUST NOT` rule in the three accepted/in-progress ADRs (see `ADR_INDEX.md`).

## 7. Two Roadmap Documents — Do Not Confuse Their Authority

- **`IMPLEMENTATION_BACKLOG.md`** (`FEE-0`…`FEE-8`) — what to actually implement now, code-grounded, sourced from a real audit of the current codebase. Authoritative for near-term work.
- **`SchoolOS-Target-Financial-Architecture-ROADMAP.md`** (Phases 1–5, `ADR-FIN-0xx`) — the long-term destination. **Non-normative, no RFC-2119 weight of its own, explicitly revisable on evidence.** It does not authorize starting any `ADR-FIN-0xx` work by existing. Do not treat a mention in this document as permission to build it.

## 8. Important Business Rules (verified, not inferred)

- A student's `PARENT` may access financial records **only** for students they have an active (non-revoked) guardian relationship with — evaluated from persistent DB state on every request, never trusted from a JWT claim (ADR-FEE-001 `AUTH-003`). Multiple active guardians (e.g. both parents) get equal access; `isPrimary` is for notification routing only, not access control.
- `STUDENT` role has **no** financial-data access by default — a school-configurable policy that defaults to disabled (ADR-FEE-001 `AUTH-004`). Do not bundle `STUDENT` access with `PARENT` access.
- `SCHOOL_OWNER` is unconditionally tenant-wide (all branches). `SCHOOL_ADMIN` is tenant-wide *by default* but can be administratively restricted to specific branches via the same `UserBranch` mechanism used for `PRINCIPAL`/finance staff (ADR-FEE-002 `AUTH-058`) — this is a confirmed, explicit business decision, not an inference from code.
- Financial facts are immutable once occurred (ADR-FEE-003 `IMM-001`). A `DRAFT` invoice can be edited; a `SENT` one cannot — only reversed (refund/credit note), never edited.
- No financial record is ever hard-deleted, and none ever will be — verified as a clean baseline the codebase has never violated (ADR-FEE-003 `IMM-009`/`010`). Do not add a `DELETE` endpoint or a `deletedAt` field to any financial model.
- `InvoiceStatus.EXPIRED` was removed (verified dead code — never set, never read, anywhere) and must not be reintroduced without a fresh, explicit decision.
- Legal retention duration for financial records is an **open question** requiring legal/compliance input — do not implement a purge/retention job with a guessed duration.

## 9. Current Implementation State (verified against repo, re-checked at handoff-package generation time)

- **Architecture**: 3 ADRs exist (2 Accepted, 1 Freeze Candidate); zero implementation against any of them has happened yet except the `EXPIRED` removal (schema change committed, migration not yet run).
- **Live, exploitable gaps still present** (verified, not assumed): several finance `GET` endpoints (`InvoiceController`, `PaymentController`, `DiscountController`, `FeePlansController`) have no `@Roles()`/ownership check; `getDefaulters()` trusts a client-supplied `branchId`; `PaymentService.verifyRazorpay()` silently skips signature verification if the gateway secret is missing/placeholder; `DiscountService.create()`'s category-to-FK mapping is broken (every discount creation will fail); `Receipt.invoiceId @unique` breaks receipts for a second partial payment; `RefundService`'s audit call uses an invalid enum value (`REFUND_INITIATED`) and has no concurrency guard.
- **5 of 10 `student-billing` services have no controller** (see §3); `ledger.service.ts` is a 0-byte stub; `InvoiceSequence`/`ReceiptSequence` tables exist in the schema but are never used by any code.
- None of this is new information — it is the `student-billing-audit.md` findings, individually re-verified against the current repository state as part of generating this handoff package, not carried forward from memory.

## 10. What a New Session Should Do First

Read `IMPLEMENTATION_HANDOFF.md` §7 (Immediate Next Implementation Steps), then `IMPLEMENTATION_RULES.md` before writing any code.
