# ADR_INDEX.md

*Status quoted exactly as written in each ADR's own header, re-verified against the file on disk immediately before this index was generated.*

## Accepted

### ADR-FEE-001 — Financial Data Visibility
**Status:** `Accepted (v1.2)`
**Summary:** Normative authorization model for all financial data. Authorization evaluated in order: Tenant → Branch → Role → Ownership. Default-deny for anything not explicitly granted. Parents/students see only actively-guardian-linked records, resolved from persistent state on every request (never trusted from a JWT claim). Field-level classification distinguishes what parents may see (amounts, dates, statuses, parent-facing reasons) from staff-only fields (approval notes, approver identity, engine metadata, audit metadata). Parents/students see financial history only through a Student Financial Account projection, never raw Ledger. Detail/Search/Export authorization must equal or be a subset of List authorization. Conflict resolution: most-restrictive-wins, missing context fails closed. 9 testable invariants (`INV-1`…`9`).
**Implementation impact:** Defines the guard/decorator/service-layer authorization every finance endpoint must implement. This is `FEE-0`'s governing contract.
**Related modules:** `InvoiceController`, `PaymentController`, `DiscountController`, `FeePlansController`, `AuditService`, `JwtStrategy`/`JwtGuard`/`RolesGuard`.

### ADR-FEE-002 — Branch Isolation
**Status:** `Accepted (v1.0)`
**Summary:** Normative branch-scoping model. The existing `UserBranch`/`JwtStrategy`/`BranchContextMiddleware` mechanism (verified already correct) is canonized as the mandatory baseline — resolved from persistent state per request, `x-branch-id` header validated against the resolved set (selects, never widens). `SCHOOL_OWNER` is unconditionally tenant-wide; `SCHOOL_ADMIN` is tenant-wide *by default* but administratively restrictable via the same `UserBranch` mechanism. Client-supplied branch parameters must intersect with (never widen) the authorized set, and must deny (not silently fall back) if out of range. Background financial jobs must be tenant-scoped, never an unscoped global sweep. 4 more testable invariants (`INV-10`…`13`).
**Implementation impact:** Defines exactly how the branch dimension of `FEE-0`'s authorization checks must work; also governs `FEE-2`/`FEE-7`'s background-job scoping fixes.
**Related modules:** Same controllers as ADR-FEE-001, plus `JwtStrategy`, `BranchContextMiddleware`, `LateFeeService`'s cron.

## In Progress

### ADR-FEE-003 — Financial Immutability
**Status:** `Freeze Candidate (pending final review → v1.0)`
**Summary:** Normative model for how financial data changes over time. Occurred facts are never edited — corrections only pre-fact (e.g. a `DRAFT` invoice), reversals only post-fact (a new opposing record, never an edit to the original). Explicit state-transition graphs for Invoice, Payment, Discount, LateFee, Refund — no undefined transition is ever valid. No hard delete, ever; no `deletedAt`-style soft delete either — real terminal states instead. Financial period freeze: closed sessions/FY accept only reversals, dated in the current open period. Optimistic concurrency required (mechanism-agnostic — a `version` column is expected but not mandated). Idempotency required on every retryable financial mutation, modeled on the already-correct offline-payment pattern. Legal retention duration explicitly flagged as an open input this ADR cannot supply. Every state transition must produce a transactional (not best-effort) audit entry. `InvoiceStatus.EXPIRED` was investigated, found to be dead code (never set, never read, anywhere), and removed as a direct implementation change rather than an ADR-level policy decision. 6 more testable invariants (`INV-14`…`19`).
**Implementation impact:** Governs `FEE-1`'s concurrency/atomicity/idempotency fixes and the no-hard-delete regression check; is the explicit foundation `ADR-FIN-002`/`ADR-FIN-005` (Ledger) build on.
**Related modules:** `InvoiceService`, `PaymentService`, `DiscountService`, `RefundService`, `LateFeeService`, `AuditService`, `backend/prisma/schema/enums.prisma`.
**Outstanding before Accepted:** final review sign-off. All previously-open Deferred Decisions are non-blocking by their own framing (legal retention duration needs external legal/compliance input; period-freeze mechanism and discount-reversal accounting effect are explicitly deferred to `ADR-FEE-005`/`ADR-FEE-004` respectively).

## Reserved (Not Started)

All six below are placeholder slots in the Target Financial Architecture Roadmap document — not scheduled, not authorized to begin by virtue of appearing here. Dependency order per the Roadmap's own dependency graph.

| ADR | Status | Summary | Depends On |
|---|---|---|---|
| `ADR-FIN-001` Financial Domain Foundation | `Reserved (Not Started)` | Bounded contexts, core aggregates, domain events for the target Financial Engine / Payment Platform architecture. | None |
| `ADR-FIN-002` Financial Engine | `Reserved (Not Started)` | Invoice, Allocation, Receipt, Ledger v1 (single-entry, append-only) as the sole document-creating boundary. | `ADR-FIN-001` |
| `ADR-FIN-003` Billable Item Catalog | `Reserved (Not Started)` | Centralized charge-type catalog (`IssueCharge` pattern) so modules request charges by code, not ad hoc payloads. | `ADR-FIN-002` |
| `ADR-FIN-004` Payment Platform | `Reserved (Not Started)` | Payment Intent / Payment Attempt / provider adapters / webhooks, separated from accounting. | `ADR-FIN-002` |
| `ADR-FIN-005` Posting & Ledger v2 | `Reserved (Not Started)` | Full double-entry Journal, Gateway Clearing Accounts, settlement reconciliation. Extends Ledger v1, does not replace it. | `ADR-FIN-004` |
| `ADR-FIN-006` Projection Layer | `Reserved (Not Started)` | Student Due, Parent Portal, Cashier, Reports as read models over the Financial Engine's records. | `ADR-FIN-002` (+ `ADR-FIN-004` for Parent Portal specifically) |

## Non-ADR Governing Document

**`SchoolOS-Target-Financial-Architecture-ROADMAP.md`** — Status (as written): *"architectural roadmap, directional commitment, revisable on evidence... No RFC-2119 normative weight of its own."* Not an ADR; does not supersede or freeze any ADR-FEE-0xx decision. Defines the 5 Architectural Invariants (above the roadmap in the governance hierarchy), the `ADR-FIN-0xx` dependency graph, and 5 measurable Evolution Phases with exit criteria.
