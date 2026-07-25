# ARCHITECTURE_STATE.md

*Condensed architecture summary. No implementation detail — for that, see `IMPLEMENTATION_BACKLOG.md` and the ADRs themselves.*

---

## Bounded Contexts

Two layers exist: what's **accepted and governs today** (ADR-FEE-001/002/003, entity-level), and what's **directional/future** (the Roadmap's bounded contexts, not yet authorized).

**Today**, the finance module is a single `StudentBillingModule` containing: Fee Plans, Invoice, Payment, Discount, Late Fee, Refund, Receipt, Reconciliation, Analytics — no formal bounded-context separation between "who requests a charge" and "who creates the financial document." This is the gap the Roadmap's Financial Engine concept addresses, directionally.

**Directionally** (Roadmap, non-normative): Admissions, Enrollment, Financial Engine, Payment Platform as separate bounded contexts, with a golden rule — *any module may request a charge; only the Financial Engine creates financial documents and accounting entries.*

## Financial Engine

Not yet a real module boundary in code. Directionally, it will be the sole owner of Invoice, Credit Note, Payment, Payment Allocation, Refund, Receipt, Journal, Ledger, Clearing Accounts, Financial Reconciliation. Reserved as `ADR-FIN-002`, dependent on `ADR-FIN-001` (Financial Domain Foundation). Not started.

Today, this ownership is implicit and inconsistent: some entities (Fee Plans) are correctly branch-scoped and controller-guarded; others (Invoice, Payment, Discount) have real, live authorization gaps (see `ARCHITECTURE_STATE.md`'s sibling document `IMPLEMENTATION_BACKLOG.md`, Epic `FEE-0`).

## Billing (Current State)

Fee Plan → Fee Assignment → Invoice (`DRAFT→SENT→{PARTIALLY_PAID→PAID, CANCELLED}`, `EXPIRED` removed as dead code, `OVERDUE` removed as M5 turned it into a derived read-time condition — see ADR-FEE-003 §4) → Payment (online via Razorpay, or offline cash/cheque) → Receipt. Discount and Late Fee attach to this flow; Refund reverses a completed Payment.

Governed by ADR-FEE-003's state-machine rules (`IMM-004`/`005`): no undefined transitions, ever. Corrections are only valid pre-fact (e.g. editing a `DRAFT` invoice); once a fact has occurred (e.g. `SENT`, `APPROVED`, `SUCCESS`), only a reversal (new opposing record) is valid — never an edit to the original (`IMM-001`, `IMM-006`, `IMM-007`).

**Overdue status (M5).** `InvoiceStatus` no longer persists `OVERDUE` — `LateFeeService.applyLateFees()` stopped writing it; an overdue invoice simply remains `SENT` or `PARTIALLY_PAID`. `isOverdue`, on the invoice API response, is the canonical field for overdue-ness; it **MUST NOT** be re-derived from `status`/`dueDate` anywhere. Full rationale in ADR-FEE-003 §4.

The frontend cannot filter or paginate invoices by `isOverdue` server-side — it is computed, not a stored column, and backend filtering was intentionally out of scope for M5. The billing list's "overdue only" view is therefore an **interim client-side implementation**: it walks every backend page matching the other active filters (bounded by a defensive `MAX_SCAN_PAGES` ceiling, fetched with bounded concurrency via `SCAN_CONCURRENCY`), filters the accumulated set by `isOverdue`, and shows an explicit warning banner if the ceiling is hit before scanning everything. This is not the target architecture — it exists only because the correct fix (below) is a backend change this milestone did not authorize.

**Target architecture, next milestone:** expose `isOverdue` as an optional filter on `InvoiceService.findAll()`, translated server-side into the same `overdueWhere()` predicate already centralized in `invoice/overdue.util.ts` and already proven correct in `getDefaulters()`/`getOverview()`/`reconciliationSummary()` — no new derivation logic, just wiring the existing one into one more query. Once that lands, the frontend's scan loop, `MAX_SCAN_PAGES`, `SCAN_CONCURRENCY`, and the truncation warning banner are all removed — the backend does the filtering and pagination directly, the same way it already does for `status`/`studentId`/`academicYear`.

## Ledger

**Does not exist yet.** No `Ledger` Prisma model; the one file path that suggests one (`ledger.service.ts`) is a 0-byte stub. ADR-FEE-003 §3 explicitly states its immutability rules apply *directly* to today's entities (Invoice, Payment, Discount, LateFee, Refund) precisely because no Ledger exists to elevate them to yet.

Two future scopes are explicitly disambiguated in the Roadmap (do not conflate them):
- **Ledger v1** — single-entry, append-only, source of truth for balances. Reserved as `ADR-FIN-002` / near-term Epic `FEE-3`. No double-entry.
- **Ledger v2 / Journal** — full double-entry Dr/Cr posting, Gateway Clearing Accounts, settlement reconciliation. Reserved as `ADR-FIN-005`, far-term (Phase 4). Extends Ledger v1; does not replace it.

## Projections

Directional concept (Roadmap, Architectural Invariant 3): a projection (Student Due / Student Financial Account) is a read model computed from source records, never itself a source of truth, never directly mutated. ADR-FEE-001 §8 (`AUTH-021`) mandates that parents/students see financial history **only** through this projection, never raw Ledger entries — and that the projection is parent-safe *by construction* (no reversal noise, no staff-only fields), not by a filter bolted onto an endpoint.

**Does not exist yet.** Reserved as `ADR-FIN-006` / near-term Epic `FEE-4`. Today, partial equivalents (`getStudentFeeSummary`, `getStudentReconciliation`) exist but are not a single consolidated account view, and have real authorization gaps (no ownership check — any authenticated user can query any student's summary today).

## Payment Flow

**Today**: client-initiated confirmation only — no server-to-server payment-gateway webhook exists anywhere in the module (verified via repo-wide search). `PaymentService.verifyRazorpay()` does real HMAC signature verification when configured, but silently skips verification (accepting the payment as `SUCCESS` unconditionally) if the gateway secret is missing or a placeholder — a live P0 risk on an endpoint the `PARENT` role can call directly.

**Directionally** (Roadmap, not yet built): Payment Intent (customer wants to pay) → Payment Attempt (gateway execution, many per intent, `CREATED→PROCESSING→{CAPTURED,FAILED,ABANDONED,EXPIRED}`) → Payment (the accounting fact, created only on confirmed capture, via webhook — not via client callback). This shape directly resolves the concurrency/idempotency gaps already found in the current `PaymentService`.

Cash payments are directional-invariant-compatible without change: they already bypass any async confirmation flow (`recordOffline`), matching the Roadmap's stated rule that cash never needs the (future) async Payment Platform's webhook machinery.

## Invariants (Both Layers)

**Normative, binding today** (ADR-FEE-001/002/003 — full text in those documents, IDs are the citable reference):
- `AUTH-001`…`AUTH-058`: tenant/branch/role/ownership authorization, field classification, conflict resolution (most-restrictive-wins, missing-context-denies).
- `IMM-001`…`IMM-023`: immutability, state transitions, corrections vs. reversals, no-hard-delete, period freeze, concurrency, idempotency, retention, audit.
- `INV-1`…`INV-19`: testable assertions extending across all three ADRs, meant to be lifted directly into test suites.

**Directional, above the Roadmap, not yet enforced in code** (Architectural Invariants, Roadmap document):
1. Only the Financial Engine creates financial documents and accounting entries.
2. Modules never own invoice/payment/accounting logic.
3. A projection is never the source of truth.
4. Payment technology never owns accounting.
5. Posted/occurred financial documents are immutable — restates `IMM-001`/`IMM-007`, foundational to the whole target architecture, not just ADR-FEE-003.

The distinction matters: the `AUTH-`/`IMM-`/`INV-` rules are **binding now** on any new work; the 5 Architectural Invariants are the **destination** every future ADR should move toward, without implying any of the surrounding Roadmap machinery (Financial Engine, Payment Platform, Ledger v2) is built or authorized yet.
