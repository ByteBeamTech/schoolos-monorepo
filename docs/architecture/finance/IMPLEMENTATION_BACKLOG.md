# IMPLEMENTATION_BACKLOG.md

## Sourcing Note (read this first)

`FEE-0` through `FEE-8` are cited extensively across all three ADRs' Compliance Matrix appendices and the Roadmap document, but **the label was never previously written to a standalone document** — it existed only in prior discussion. Every Epic below was reconstructed, with **no invented work**, by cross-referencing:
- `student-billing-audit.md` §8's own "Prioritized Implementation Roadmap" (its Phase 0–4, 19 numbered items — the actual concrete findings),
- every `FEE-N` citation inside ADR-FEE-001/002/003's Appendix B (Compliance Matrix),
- the Roadmap document's `FEE-`-prefixed cross-references in its Evolution Roadmap phases.

Where the audit's own phase numbers (0–4) differ from the `FEE-N` numbers the ADRs already cite, the `FEE-N` numbering governs, since that's what the accepted ADRs reference. Complexity is qualitative (Small/Medium/Large) — no estimation exercise was previously done in any source document, and none is fabricated here.

---

## Epic FEE-0 — Security Hardening

**Objective:** Close live, exploitable P0 authorization gaps in the currently-deployed `student-billing` module. Nothing here depends on any new architecture existing — it is entirely "add missing checks to code that already runs in production."

**Dependencies:** None. Independent of every other Epic. Do first.

**Implementation order:**
1. Add `@Roles()` + ownership + branch enforcement to every unguarded `GET` the audit found (`InvoiceController` list/detail, `PaymentController.getHistory`, `DiscountController` list/detail, `FeePlansController` student-summary endpoints).
2. Fix `InvoiceController.getDefaulters()`'s client-supplied `branchId` to be server-derived and intersected, never trusted (`AUTH-054`).
3. Hard-fail `PaymentService.verifyRazorpay()` on missing/placeholder gateway config in non-development environments, instead of silently skipping HMAC verification.
4. Add regression tests for the already-correct `UserBranch`/`JwtStrategy`/`BranchContextMiddleware` mechanism (`AUTH-050`, `AUTH-051`) and for `SCHOOL_OWNER` (`AUTH-052`) — these are already implemented correctly; this step is test coverage, not new code.
5. Implement and test both unrestricted and restricted `SCHOOL_ADMIN` paths (`AUTH-058`), including the branch selector for the unrestricted case.
6. Build the cross-role, cross-branch test suite covering `INV-1`…`INV-13` (ADR-FEE-001/002's invariants) — written to be lifted near-verbatim from the ADRs' own invariant text.

**Estimated complexity:** Medium. Mostly additive guard/decorator work on existing endpoints, but the test-suite breadth (every role × every entity × every surface) is real effort.

**Acceptance criteria:**
- Every `GET` endpoint the audit flagged now enforces role + ownership + branch per ADR-FEE-001/002.
- `getDefaulters()` branch parameter cannot be used to view another branch's data (verified by test, not just code review).
- Razorpay verification cannot be bypassed by missing/placeholder config in a non-dev environment (verified by test).
- `INV-1`…`INV-13` each have at least one passing cross-role and (where applicable) cross-branch test.

---

## Epic FEE-1 — Money Path Integrity

**Objective:** Fix the concrete, already-identified bugs in code paths that are wired to controllers and reachable by real users today.

**Dependencies:** None (independent of FEE-0, though both are top-priority and may run in parallel).

**Implementation order:**
1. Fix `DiscountService.create()`'s `categoryId` mapping — resolve the real `DiscountCategory.id` from `dto.category` (by `code` + `branchId`) instead of assigning the client-facing enum value directly as a foreign key. This single fix unblocks the entire discount/scholarship feature.
2. Fix the `Receipt` model and its generation for partial payments: drop `Receipt.invoiceId @unique` (keep `Receipt.paymentId @unique` — one receipt per payment is correct), update `generateReceipt()`/`generateAndUpload()` to always create a new receipt per successful payment.
3. Fix `RefundService`'s audit call (`REFUND_PROCESSED`, not the invalid `REFUND_INITIATED`) and wrap its over-refund check + refund creation in a single transaction (`IMM-014`).
4. Add optimistic concurrency (a `version` field or equivalent per `IMM-015`) to any financial entity whose correctness depends on read-then-write safety — starting with `Discount` approval and `Refund` initiation.
5. Wrap the full payment-confirmation flow (`payment.create()` → `updateInvoice()` → `generateReceipt()`) in one transaction instead of three independent steps.
6. Add a regression/lint check asserting no `DELETE` route or `deletedAt` field is ever added to a financial model (`IMM-009`–`011` — currently clean; keep it that way mechanically, not just by convention).

**Estimated complexity:** Medium-Large. Several of these are schema changes requiring migrations (`Receipt.invoiceId`, new `version` columns), not just service-code fixes.

**Acceptance criteria:**
- Discount creation succeeds end-to-end and correctly reduces the resulting invoice's total.
- A second partial payment against an invoice produces its own receipt, not a copy of the first.
- Refunds produce a real audit-log row; two concurrent refund requests against the same payment cannot together exceed the refundable amount.
- The full payment-confirmation flow is atomic (verified by a forced-crash-mid-flow test, not just code review).
- No `DELETE` route or `deletedAt` field exists on any financial model (verified by an automated check).

---

## Epic FEE-2 — Complete Existing Features

**Objective:** Wire up or deliberately retire the five orphaned services, and consolidate the duplicate/dead mechanisms the audit found.

**Dependencies:** FEE-1 (several of these services depend on FEE-1's fixes — e.g. `ReceiptService` can't be safely wired until the partial-payment receipt fix lands).

**Implementation order:**
1. `RefundService` — give it a real controller (money leaving the building currently has zero API surface). Highest priority of the five.
2. `LateFeeService` — give it manual apply/waive/reverse/list endpoints; the frontend already exists and expects these routes (`/billing/late-fees*`) and currently 404s on all of them.
3. `ReconciliationService` — give it a controller (outstanding-dues reporting is a common early ask); consider renaming to avoid the name collision with true bank/gateway reconciliation (`FEE-7`).
4. `ReceiptService` (post-FEE-1 fix) and `StandardDiscountService` — wire up as needed, or explicitly delete if genuinely redundant with what `PaymentService`/`DiscountService` already do.
5. `ledger.service.ts` — currently a 0-byte stub; either delete it (if `FEE-3` will create a properly-scoped Ledger service fresh) or note it as the intended home for `FEE-3`'s work.
6. Consolidate numbering onto one mechanism: retire `ReceiptService`'s naive `count()`-based numbering, adopt the schema's existing (currently unused) `InvoiceSequence`/`ReceiptSequence` tables, or fix the advisory-lock approach to key on `(tenantId, branchId)` instead of `tenantId` alone.
7. Consolidate `GatewayFactory`/`GatewayAdapter` into actual use by `PaymentService`, or remove it — it is currently registered but unused, reimplemented inline instead.
8. Close remaining idempotency gaps beyond the already-compliant offline-payment path — refund, discount, and late-fee endpoints each need an identified idempotency key (`IMM-018`).
9. Background-job branch-scoping shape improvements toward `AUTH-056`/`AUTH-057` (full completion, including the late-fee cron's unscoped platform-wide sweep, continues into `FEE-7`).

**Estimated complexity:** Large. Five services' worth of controller/DTO/guard work, plus two consolidation efforts (numbering, gateway abstraction) that touch already-live code paths.

**Acceptance criteria:**
- Every one of the five orphaned services either has a real, guarded controller or has been deliberately deleted with a recorded rationale — none remain silently unreachable.
- Exactly one invoice/receipt numbering mechanism exists in the codebase.
- `PaymentService` uses `GatewayFactory` (or `GatewayFactory` no longer exists).
- Every retryable financial mutation endpoint has an idempotency key (`IMM-017`/`018`).

---

## Epic FEE-3 — Financial Ledger Engine (Ledger v1)

**Objective:** Build the single-entry, append-only source of truth for balances, and backfill existing history into it.

**Dependencies:** FEE-1, FEE-2 (the Ledger should be built on top of already-fixed entity behavior, not compound existing bugs into its backfill).

**Implementation order:**
1. Design and migrate a `Ledger` model — one row per financial event (invoice raised, payment received, discount applied, refund issued, late fee applied), immutable, append-only, per ADR-FEE-003 §3.
2. Wire every existing mutation (invoice generation, payment confirmation, discount approval, refund, late-fee application) to also write a Ledger entry, in the same transaction as the mutation itself (`IMM-022`/`023` — audit is transactional, not best-effort — applies equally to Ledger writes).
3. Backfill: write existing `Invoice`/`Payment`/`Discount`/`Refund`/`LateFee` history into `Ledger` entries, with an explicit migration/script strategy (not left as "new data only").
4. This is explicitly **Ledger v1** — single-entry, no double-entry, no Journal. Do not build `ADR-FIN-005`-scope work (Journal, Gateway Clearing) as part of this Epic; that is Phase 4, far-term, and explicitly sequenced after this.

**Estimated complexity:** Large. New model + migration + a real backfill strategy for production data + wiring every existing mutation path.

**Acceptance criteria:**
- Every invoice/payment/discount/refund/late-fee event, past and future, has a corresponding Ledger entry.
- For a sample of students, summing Ledger entries from scratch matches the entity-level totals (a from-scratch reconciliation check).
- No code path anywhere edits or deletes a Ledger entry after it's written.

---

## Epic FEE-4 — Student Financial Account (Projection)

**Objective:** Build the parent/student-safe projection ADR-FEE-001 `AUTH-021` requires.

**Dependencies:** FEE-3 (the projection should read from the Ledger, not re-derive from raw entities a second time).

**Implementation order:**
1. Build a Student Financial Account read model computed from Ledger entries (or, if `FEE-3` isn't complete yet, from the underlying entities directly — but design it to be trivially re-pointed at the Ledger once available).
2. Ensure it is parent-safe *by construction*: no reversal noise, no staff-side adjustment detail, no field classified staff-only in ADR-FEE-001 §7 (approval notes, approver identity, engine metadata, audit metadata).
3. Wire `PARENT`/`STUDENT`-facing endpoints to use only this projection — never raw Ledger, never raw entity detail beyond what §7's field classification allows.

**Estimated complexity:** Medium.

**Acceptance criteria:**
- A parent's fee-summary view is entirely served by this projection.
- No endpoint reachable by `PARENT`/`STUDENT` returns raw Ledger entries or staff-only fields (verified by test, per `AUTH-021`, `AUTH-020`).
- The projection is read-only — no endpoint mutates it directly.

---

## Epic FEE-5 — Opening Balance, Carry Forward, Write-Off, Adjustments

**Objective:** Multi-session financial continuity primitives the audit found entirely missing.

**Dependencies:** FEE-3 (these should be modeled as Ledger entry types, not a second parallel mechanism, per the audit's own recommendation).

**Implementation order:**
1. Model arrears/opening-balance as a specific Ledger entry type, carried forward automatically at academic-session rollover.
2. Build a `WriteOff` model + approval workflow, mirroring the `Discount`/`DiscountApproval` pattern the audit found already well-designed.
3. Build a generic `Adjustment` primitive for manual debit/credit corrections outside the discount taxonomy.

**Estimated complexity:** Large. Session-rollover automation and a new approval workflow are both non-trivial.

**Acceptance criteria:**
- A student's prior-year unpaid balance correctly appears as an opening balance in the new session, sourced from a Ledger entry, not a bespoke calculation.
- Write-offs go through an approval chain equivalent in rigor to the existing Discount approval chain.

---

## Epic FEE-6 — Installments, Fee Heads, Fee Categories

**Objective:** Fee-structure completeness the audit found missing.

**Dependencies:** None beyond FEE-1/FEE-2 (independent of the Ledger work).

**Implementation order:**
1. Build an `Installment` model + invoice-generation support for installment schedules (today, `FeeItem`/`Invoice` each carry exactly one `dueDate`).
2. Build a `FeeHead`/`FeeCategory` catalog mirroring the `DiscountCategory` pattern the audit found already well-designed for discounts, but currently absent for fee line items themselves (`FeeItem.name` is free-text, re-typed per plan today).

**Estimated complexity:** Medium.

**Acceptance criteria:**
- An invoice can be generated with a multi-installment schedule, each installment individually trackable.
- Fee line items reference a shared `FeeHead`/`FeeCategory` catalog entry instead of a free-text name.

---

## Epic FEE-7 — Cashbook, Bank Reconciliation, Webhook

**Objective:** Operational completeness for in-person collection and real payment-gateway reconciliation.

**Dependencies:** FEE-2 (webhook needs the payment-confirmation flow already fixed to be atomic), FEE-3 (bank reconciliation should read against Ledger entries).

**Implementation order:**
1. **Confirm cashier-workflow/daily-cashbook is a real product requirement before building it** — explicitly flagged in the audit as the largest single item in this whole backlog; do not build speculatively.
2. Add a real payment-gateway webhook endpoint (Razorpay/Stripe both support this), signature-verified, reachable independent of any client-side confirmation call.
3. Build a reconciliation job that reads Ledger entries against gateway settlement data — a distinct concern from the existing `ReconciliationService` (which is an outstanding-dues report, not this).
4. Complete `AUTH-056`/`AUTH-057`'s background-job scoping requirements fully — the late-fee cron's unscoped, platform-wide, `take: 1000`-capped sweep is the concrete instance to fix.

**Estimated complexity:** Large, and Item 1 is a scope question, not an engineering one — resolve it before estimating the rest.

**Acceptance criteria:**
- A payment-gateway webhook exists, is signature-verified, and a payment whose client-side confirmation never arrives still reaches a correct terminal state via the webhook within a defined SLA.
- The late-fee cron (or any other financial background job) is tenant-batched, not an unscoped global sweep.
- (If cashier workflow is confirmed as in-scope) a cashier session/shift/till concept exists for offline collection.

---

## Epic FEE-8 — Enterprise Reports, Analytics, Ageing

**Objective:** Reporting completeness.

**Dependencies:** FEE-3/FEE-4 (reports should read from Ledger/projections, not re-derive independently).

**Implementation order:**
1. Build an ageing report (0–30/31–60/61–90/90+ day buckets), extending the existing `getDefaulters()`-style output.
2. Add branch and date-range breakdowns to `AnalyticsService` (today: tenant-wide only, no branch breakdown, no date filter).
3. Implement `AUTH-055`'s per-branch analytics breakdown requirement — resolving the open product/UX question (current-branch-context vs. full-authorized-set aggregate for an unscoped analytics endpoint) as part of this work, per ADR-FEE-002's Deferred Decision 1.

**Estimated complexity:** Medium.

**Acceptance criteria:**
- An ageing report exists and correctly buckets outstanding amounts.
- A branch-restricted role's analytics view never exceeds their authorized branch set, even in aggregate (`AUTH-055`, `INV`-equivalent test).

---

## Reserved (Not Started) — `ADR-FIN-0xx` Epics

Not part of this backlog's near-term sequence. Listed for completeness and dependency awareness only — **do not start any of these without a dedicated ADR review pass first**, per `IMPLEMENTATION_RULES.md`.

| Epic | Depends On | Roadmap Phase |
|---|---|---|
| `ADR-FIN-001` Financial Domain Foundation | None | — |
| `ADR-FIN-002` Financial Engine (Invoice, Allocation, Receipt, Ledger v1) | `ADR-FIN-001` | Phase 1 |
| `ADR-FIN-003` Billable Item Catalog | `ADR-FIN-002` | Phase 1–2 |
| `ADR-FIN-004` Payment Platform | `ADR-FIN-002` | Phase 2–3 |
| `ADR-FIN-005` Posting & Ledger v2 (Journal, Clearing Accounts) | `ADR-FIN-004` | Phase 4 |
| `ADR-FIN-006` Projection Layer | `ADR-FIN-002` (+ `ADR-FIN-004` for Parent Portal) | Phase 1 |
