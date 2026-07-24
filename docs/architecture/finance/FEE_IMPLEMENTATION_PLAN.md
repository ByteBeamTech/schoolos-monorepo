# FEE Implementation Plan

**Status:** Execution plan — implementation authority
**Governing documents:** `FINANCE_ARCHITECTURE_DELTA_v1.2.md` and `FINANCE_ARCHITECTURE_AMENDMENT_v1.2.1.md`, read as one frozen architecture
**Binding rules:** every `MUST`/`MUST NOT` in ADR-FEE-001, ADR-FEE-002, ADR-FEE-003; `IMPLEMENTATION_RULES.md` §1–§12

---

## 0. How this plan is derived

Milestone order follows the frozen implementation sequence in v1.2 §6 as amended by v1.2.1 §F. **That order is not re-derived here and MUST NOT be re-ordered.** Milestones subdivide the frozen steps into independently commit-able units; they do not reorder them.

Complexity is qualitative (Small / Medium / Large), consistent with `IMPLEMENTATION_BACKLOG.md`'s stated convention. No time estimates are given, and none should be inferred.

### 0.1 Mapping to frozen sequence

| Frozen step (v1.2 §6, v1.2.1 §F) | Milestones |
|---|---|
| 1 — CAS on `verifyRazorpay` | M1 |
| 2 — Decimal discipline; refund re-billing defect | M2, M3 |
| 3 — Invoice lock in late-fee assessment | M4 |
| 4 — Derived `OVERDUE`; refund state off `PaymentStatus` | M5, M6 |
| 5 — FY/branch gap-free numbering (`D-2`) | M7, M8 |
| 6 — Allocation, `FundingSource`, payer, allocation rule, tender | M9–M13 |
| — Credit note (see §0.2) | M14 |
| 7 — `StudentAccount`, deposits, exit settlement | M15–M18 |
| 8 — Ledger (FEE-3) | M19, M20 |
| 9 — Outbox for domain events | M21 |
| 10 — Fee structure, terms, heads (FEE-6) | M22, M23 |
| 11 — Late-fee surface completion (`D-7`, `X-4`) | M24 |
| 12 — Statutory controls (`D-8`) | M25–M27 |
| §4.6 — ADR-FEE-002 DD1 closure | M28 (independent) |

### 0.2 One placement decision

Credit note is frozen (v1.2 `C-5`, invariant 5, §3.4 `CreditNoteIssued`, §3.7 state machine) but the frozen sequence does not assign it a numbered step. It is placed at M14 — after allocation, because a credit note reduces an invoice balance that allocation reads, and before `StudentAccount`, because deposit adjustment logic must not be built against an invoice balance model that is still changing. This is an implementation-planning placement, not a change to the frozen order.

### 0.3 Rules applying to every milestone

- **Verify before changing** (`IMPLEMENTATION_RULES.md` §1). Re-read the file; do not trust this plan's description of current state.
- **One aggregate at a time** (§5). Finish an aggregate's change, tests and compliance notes before starting the next.
- **No half-built financial paths** (§6). If a milestone cannot complete, leave the prior working state and record the gap.
- **Every financial write** carries authorization, immutability compliance, transactional audit, idempotency and concurrency safety (§8).
- **Audit MUST receive the transaction.** `AuditService` accepts a caller `tx` as of `4bf4157`; no caller passes one. Every milestone touching a financial write closes this for its own paths (v1.2 §3.2).
- **Aggregate ownership MUST be documented in code** at the point of implementation (v1.2 §4.5).
- **Decision IDs are append-only** (§9).
- Each milestone is one commit unless stated otherwise. Each leaves `main` green: full `student-billing` + `common` suite and `tsc --noEmit`.

### 0.4 Known pre-existing condition

`src/core/feature-flags/feature-flags.service.spec.ts` fails at HEAD, unrelated to `student-billing`. Verified identical before and after the FEE-2 P0 commits. It is not a regression and is out of scope for this plan.

---

# Phase A — Mandatory corrections (frozen steps 1–4)

No schema-breaking work. Each milestone is small, independently valuable, and unblocks nothing downstream except by reducing risk.

---

## M1 — CAS guard on `verifyRazorpay`

**Goal.** Close the live double-credit. `verifyRazorpay()` sets a payment to `SUCCESS` and applies its amount unconditionally, with no check that it is not already `SUCCESS`. Inputs are deterministic and client-supplied; the endpoint is `PARENT`-reachable. A replay credits the invoice twice, and because receipt generation is idempotent on `paymentId`, the duplicate is invisible in the receipt register.

**Files to modify.** `payment/services/payment.service.ts`; `payment/services/payment.service.spec.ts`.

**Prisma schema changes.** None.
**Migrations.** None.

**Backend services.** Replace the unconditional `payment.update` with a compare-and-swap predicated on the current pending status, matching the pattern established in `718ce07`. Zero affected rows means the payment is already settled: return the existing settlement result and do not re-apply the amount, do not re-allocate late fees, do not re-generate a receipt.

**Controllers / DTOs / Validation.** None.
**Events.** None. `payment.success` must not be re-emitted on a replayed call.

**Tests.** Replay of an identical verified payload credits the invoice exactly once. Concurrent duplicate verification results in one settlement. The first legitimate verification is unaffected. A payment already `FAILED` is not resurrected by a replay.

**Frontend impact.** None. A replayed confirmation now returns the existing result rather than an error.

**Breaking changes.** None.
**Estimated complexity.** Small.
**Dependencies.** None. **This is the first task.**

---

## M2 — Refund invoice re-billing defect

**Goal.** `RefundService` Phase 3 sets `paidAmount: 0` and `dueAmount: totalAmount` when a refund fully covers *that payment*, erasing every other payment's contribution to the same invoice. It also writes a `totalAmount` read before the gateway round-trip, which is stale if a late fee was assessed in between.

**Files to modify.** `refund/refund.service.ts`; `refund/refund.service.spec.ts`.

**Prisma schema changes.** None.
**Migrations.** None.

**Backend services.** Recompute the invoice position from its own current state and its remaining non-refunded payments, inside the existing transaction and under the existing per-payment advisory lock. Re-read the invoice inside the transaction rather than reusing the pre-gateway snapshot. Also correct the hardcoded `actorRole: 'ACCOUNTANT'` in the audit call, and pass the transaction to `AuditService`.

**Controllers / DTOs / Validation.** None.
**Events.** None yet; `RefundCompleted` lands in M21.

**Tests.** Invoice with two payments, one fully refunded: the other payment's contribution survives. Partial refund adjusts proportionally. A late fee assessed between initiation and settlement is not erased. Audit records the real actor role.

**Frontend impact.** None.
**Breaking changes.** None.
**Estimated complexity.** Medium.
**Dependencies.** None.

---

## M3 — Decimal discipline in the service layer (`D-9`)

**Goal.** Schema columns are `Decimal(12,2)` throughout, but service code reads money via `Number(...)`, computes in binary floating point and writes back. Percentage-based late fees and discounts are where this produces unexplainable paise, and rounding is applied inconsistently across paths.

**Files to modify.** `payment/services/payment.service.ts`; `invoice/services/invoice.service.ts`; `late-fee/late-fee.service.ts`; `discounts/services/discount.service.ts`; `refund/refund.service.ts`; `analytics/services/analytics.service.ts`; `reconciliation/reconciliation.service.ts`; corresponding specs.

**Prisma schema changes.** None — the schema is already correct.
**Migrations.** None.

**Backend services.** Perform all monetary arithmetic in a decimal type end-to-end. Define and apply rounding explicitly at named points. Remove `Number()` coercion from every money path. Comparison and equality on money use decimal comparison, not floating-point.

**Controllers / DTOs / Validation.** DTO money fields validated as decimal-representable with at most two fraction digits.
**Events.** None.

**Tests.** Percentage late fee on an amount that is not cleanly divisible produces an exact two-decimal result. Repeated partial payments sum exactly to the invoice total with no residue. Discount percentage plus late fee percentage on the same invoice reconciles to the cent.

**Frontend impact.** None. Values may differ in the final paise from previously computed figures; this is the correction.

**Breaking changes.** None to the API contract. Historical rows are not restated.
**Estimated complexity.** Medium — mechanical but broad, touching every money path.
**Dependencies.** M1, M2 (avoid rebasing correctness fixes on top of a wide mechanical change).

---

## M4 — Invoice lock in late-fee assessment

**Goal.** The assessment job reads and writes invoice balance fields with no lock, concurrently with settlement, which holds the per-invoice advisory lock over the same fields. This is a lost update.

**Files to modify.** `late-fee/late-fee.service.ts`; `late-fee/late-fee.service.spec.ts`.

**Prisma schema changes.** None.
**Migrations.** None.

**Backend services.** Assessment acquires the same per-invoice advisory lock used by settlement, and performs the `LateFee` insert and the `Invoice` update within one transaction. The lock helper is shared rather than copied a fifth time; it uses the two-argument `pg_advisory_xact_lock(classId, objId)` form, namespaced by lock class, per v1.2 §3.8.

**Controllers / DTOs / Validation.** None.
**Events.** None yet; `LateFeeAssessed` lands in M21.

**Tests.** Concurrent assessment and settlement on one invoice produce a consistent balance. Assessment failure rolls back both the fee and the invoice update. Advisory lock is taken with the two-argument namespaced form.

**Frontend impact.** None.
**Breaking changes.** None.
**Estimated complexity.** Small.
**Dependencies.** M3.

---

## M5 — `OVERDUE` becomes derived

**Goal.** Overdue is a function of due date and outstanding balance, currently stored and set only when the assessment job happens to touch the row — which is why the analytics figure and the overdue listing disagree.

**Files to modify.** `backend/prisma/schema/enums.prisma`; `invoice/services/invoice.service.ts`; `analytics/services/analytics.service.ts`; `reconciliation/reconciliation.service.ts`; `late-fee/late-fee.service.ts`; corresponding specs.

**Prisma schema changes.** Remove `OVERDUE` from `InvoiceStatus`.

**Migrations.** Pre-check required per `IMPLEMENTATION_RULES.md` §4: count existing `Invoice` rows with `status = 'OVERDUE'` before dropping the enum value. Existing rows migrate to their correct stored status (`SENT` or `PARTIALLY_PAID`) based on paid amount. Verified-dead-in-code is not verified-unused-in-data.

**Backend services.** One shared derivation used by every consumer. Overdue is expressed as a query predicate, never a stored value.

**Controllers / DTOs / Validation.** Response shapes retain an overdue indicator, now computed. Any DTO accepting `OVERDUE` as a filter value maps it to the derived predicate.
**Events.** None.

**Tests.** Analytics overdue count and `findOverdue()` return identical sets for the same input. An invoice past due that the job has not touched is counted. An invoice paid in full is never counted.

**Frontend impact.** `billing/page.tsx`, `billing/defaulters/page.tsx`, `billing/invoices/[id]/page.tsx` — any status badge or filter referencing `OVERDUE` as a stored status. Behaviour improves; the two previously disagreeing numbers converge.

**Breaking changes.** Yes — `InvoiceStatus` enum value removed. Requires the migration pre-check above. Requires an ADR-FEE-003 revision to the invoice state-transition graph (v1.2 §4.3).
**Estimated complexity.** Medium.
**Dependencies.** M4.

---

## M6 — Refund state off `PaymentStatus`

**Goal.** `REFUNDED` and `PARTIALLY_REFUNDED` are set independently of the refund records — the mechanism behind the defect M2 corrects. Per `D-3`/`D-4`, refund state is derived.

**Files to modify.** `backend/prisma/schema/enums.prisma`; `refund/refund.service.ts`; `payment/services/payment.service.ts`; `payment/controllers/payment.controller.ts`; `analytics/services/analytics.service.ts`; corresponding specs.

**Prisma schema changes.** `PaymentStatus` narrows to money state: pending, completed, failed, reversed. Remove `REFUNDED` and `PARTIALLY_REFUNDED`. Add `REVERSED` (required by tender bounce in M13).

**Migrations.** Existing `REFUNDED`/`PARTIALLY_REFUNDED` rows migrate to `SUCCESS`/completed; refund state is thereafter derived from `Refund` rows. Pre-check counts per §4 before altering the enum.

**Backend services.** Refund state computed from a payment's refund records wherever previously read from the status field.

**Controllers / DTOs / Validation.** Payment response DTOs expose a derived refund state. Filters accepting the removed values map to the derived predicate.
**Events.** None.

**Tests.** A fully refunded payment reports the derived state correctly without a stored flag. A partially refunded payment likewise. Migration maps existing rows without loss.

**Frontend impact.** `billing/invoices/[id]/page.tsx`, `billing/students/[studentId]/page.tsx` — payment status display and any filter on the removed values.

**Breaking changes.** Yes — enum values removed; `SUCCESS` semantics narrow further in M13 (cleared, not accepted). Requires an ADR-FEE-003 revision to the payment state-transition graph (v1.2 §4.4).
**Estimated complexity.** Medium.
**Dependencies.** M2, M5.

---

# Phase B — Numbering (frozen step 5)

---

## M7 — Sequence-backed numbering infrastructure

**Goal.** Replace `count(*)`-based numbering held under a tenant-wide advisory lock — simultaneously the top audit finding and the module's write-throughput ceiling — with the existing, unused `InvoiceSequence`/`ReceiptSequence` tables.

**Files to modify.** `backend/prisma/schema/student-billing/sequences.prisma`; new numbering service under `backend/src/modules/student-billing/`; its spec.

**Prisma schema changes.** `InvoiceSequence`/`ReceiptSequence` already carry `@@unique([tenantId, branchId, year])` and `lastNumber`. `year` is interpreted as financial-year start — `2026` means FY 2026-27 — per `D-2`. Add a document-prefix field if branch prefixes are required by the number format.

**Migrations.** Seed sequence rows for existing tenant/branch/FY combinations, initialised above the highest number already issued in each. Existing documents retain their issued numbers; the new series begins at changeover and the transition is recorded.

**Backend services.** A numbering service allocating from the sequence row under a row-level lock scoped to `(tenantId, branchId, financialYear)`. Financial year derived from the document date on a 1 April – 31 March boundary, never from `getFullYear()`. Gap-free: a number is allocated only inside the transaction that persists the document; cancelled documents retain their number.

**Controllers / DTOs / Validation.** None.
**Events.** None.

**Tests.** Financial-year boundary: a document dated 31 March and one dated 1 April fall in different series. Concurrent allocation across two branches does not serialise against each other. Concurrent allocation within one branch produces contiguous numbers with no duplicates and no gaps. A rolled-back document does not burn a number.

**Frontend impact.** Number format changes on newly issued documents.
**Breaking changes.** Yes, for numbering. Historical numbers are preserved.
**Estimated complexity.** Medium.
**Dependencies.** M6.

---

## M8 — Cut invoice and receipt numbering over

**Goal.** Retire both existing mechanisms. `IMPLEMENTATION_BACKLOG.md` FEE-2 item 6 requires exactly one numbering mechanism in the codebase.

**Files to modify.** `invoice/services/invoice.service.ts` (remove `generateInvoiceNumber`, `generateReceiptNumber`); `payment/services/payment.service.ts`; `receipt/receipt.service.ts` (remove the naive `count()` numbering); corresponding specs.

**Prisma schema changes.** None.
**Migrations.** None.

**Backend services.** Both call sites use the M7 service. The tenant-wide advisory lock around numbering is removed; the per-invoice settlement lock remains and is unaffected.

**Controllers / DTOs / Validation.** None.
**Events.** None.

**Tests.** No `count(*)`-based numbering remains anywhere (automated check, in the spirit of the existing no-hard-delete tripwire). Settlement throughput is no longer serialised tenant-wide. Receipt numbers remain unique per branch per FY.

**Frontend impact.** None beyond M7.
**Breaking changes.** None additional.
**Estimated complexity.** Small.
**Dependencies.** M7.

---

# Phase C — Allocation core (frozen step 6)

The load-bearing phase. Everything downstream assumes it.

---

## M9 — `FeeHead` catalog with `accountingNature`

**Goal.** `FeeHead` is the single charge catalog (`C-2`, `C-13`) and is a prerequisite for charge-targeted allocation. Introduced here rather than in Phase G because allocation targets a charge, and liability-nature settlement (M16) depends on the classification.

**Files to modify.** New `backend/prisma/schema/student-billing/fee-heads.prisma`; `student-billing.module.ts`; new fee-head service and controller; specs.

**Prisma schema changes.** `FeeHead` with tenant and branch scoping per the standing convention, optional self-reference for a parent group, `accountingNature` (`REVENUE` | `LIABILITY`), active flag, display order. Depth is capped at 2 and enforced in code (`C-1`). `InvoiceItem` gains an optional `feeHeadId`, nullable during transition.

**Migrations.** Additive. Seed a default head set per tenant derived from distinct existing `InvoiceItem.chargeCategory` values. Existing items are back-linked where the mapping is unambiguous; the free-text field is retained until M23.

**Backend services.** Catalog CRUD. `accountingNature` immutable once the head is referenced by an issued invoice (invariant 19), enforced in the aggregate and by constraint where expressible.

**Controllers / DTOs / Validation.** Fee-head management endpoints, finance-staff roles, branch-scoped per ADR-FEE-002. Validation rejects a parent whose own parent is set (depth 2), and rejects mutation of `accountingNature` on a referenced head.

**Events.** None.

**Tests.** Depth-3 hierarchy rejected. `accountingNature` change rejected once referenced by an issued invoice, permitted before. Branch scoping enforced on list and detail per `INV-1`…`INV-13`.

**Frontend impact.** New fee-head configuration screen. `billing/fee-plan/*` gains head selection.
**Breaking changes.** None — additive and nullable.
**Estimated complexity.** Medium.
**Dependencies.** M8.

---

## M10 — `PaymentAllocation` with charge targeting

**Goal.** Introduce allocation as the single mechanism by which money is applied to any charge (`C-10`).

**Files to modify.** `backend/prisma/schema/student-billing/payments.prisma`; `payment/services/payment.service.ts`; new allocation service; `invoice/services/invoice.service.ts`; specs.

**Prisma schema changes.** `PaymentAllocation` with tenant and branch scoping, funding source (payment, in this milestone), charge target expressed so that both invoice and late-fee targets are representable without reshaping, amount, and the allocation rule that produced it (`C-4`). `Payment.invoiceId` becomes nullable; it is not dropped in this milestone.

**Migrations.** Backfill one allocation per existing payment for its full amount against its current invoice. Mechanical, and it MUST run before the Ledger backfill in M20 so the backfill runs once against the final model.

**Backend services.** Settlement creates allocations rather than crediting the invoice directly. Default rule oldest-due-first, configurable, manual override permitted and audited. Allocation updates the targeted charge's cached balance in the same transaction — the second documented multi-aggregate transaction (v1.2 §3.1).

**Controllers / DTOs / Validation.** Payment recording accepts an optional explicit allocation set; absent one, the default rule applies. Validation enforces that the allocation total does not exceed the payment amount (invariant 2) and that allocations against a charge do not exceed its outstanding amount (invariant 3).

**Events.** None yet. Per v1.2 §3.4, no separate `PaymentAllocated` event exists — allocation and completion are the same moment.

**Tests.** Allocation total never exceeds the payment amount. Allocation against a charge never exceeds its outstanding amount. Oldest-due-first ordering. Manual override recorded with its rule and audited. Backfill produces exactly one allocation per historical payment, summing to the original amount.

**Frontend impact.** `billing/invoices/[id]/page.tsx`, `billing/students/[studentId]/page.tsx` — payments now show what they settled.
**Breaking changes.** `Payment.invoiceId` nullable. API responses gain allocations.
**Estimated complexity.** Large.
**Dependencies.** M9.

---

## M11 — `FundingSource` generalisation

**Goal.** Generalise the allocation source from `Payment` to a funding source (`C-15`). Implemented within frozen step 6 and not deferred: generalising after allocation rows exist would require migrating every one.

**Files to modify.** `backend/prisma/schema/student-billing/payments.prisma`; allocation service; specs.

**Prisma schema changes.** Allocation source expressed as a funding source discriminated between a payment and a `StudentAccount` held balance. The account-sourced branch is structurally present here; its first producer arrives in M17.

**Migrations.** All backfilled and new allocations are payment-sourced. Additive.

**Backend services.** Allocation ownership follows its source (v1.2.1 §C.2). Each source aggregate enforces its own ceiling — the payment amount, or the held balance. No synthetic `Payment` is ever created to represent an internal transfer.

**Controllers / DTOs / Validation.** Allocation responses expose the funding source.
**Events.** None.

**Tests.** A payment-sourced allocation is bounded by the payment amount. The account-sourced branch is representable and correctly rejected while no account balance exists.

**Frontend impact.** None yet.
**Breaking changes.** None beyond M10.
**Estimated complexity.** Medium.
**Dependencies.** M10.

---

## M12 — Guardian as payer (`D-1`)

**Goal.** Give `Payment` a payer identity. Prerequisite for §269ST aggregation (M25) and for coherent sibling payments.

**Files to modify.** `backend/prisma/schema/student-billing/payments.prisma`; `payment/services/payment.service.ts`; `payment/controllers/payment.controller.ts`; DTOs; specs.

**Prisma schema changes.** `Payment.payerId` nullable, referencing `Guardian`, with an index. `Payment.payerName` free text, required when `payerId` is null — counter cash is sometimes tendered by a relative, driver or employer.

**Migrations.** Additive and nullable. Historical payments are not back-attributed; inferring a payer is fabrication.

**Backend services.** Payer captured at recording. Allocations may span students; the guardian link is not required to match every allocated student, because a payer may legitimately pay for a child they are not the registered guardian of.

**Controllers / DTOs / Validation.** Offline payment DTO accepts payer identity or payer name; validation requires exactly one.
**Events.** None.

**Tests.** Payer recorded on offline and gateway paths. Null payer with a name accepted; null both rejected. A sibling payment allocating across two students records one payer.

**Frontend impact.** Counter collection screen gains payer selection with free-text fallback.
**Breaking changes.** None — nullable.
**Estimated complexity.** Small.
**Dependencies.** M11.

---

## M13 — `PaymentTender` and instrument lifecycle (`D-5`)

**Goal.** Own instrument lifecycle and recognise collections only on clearance. Splits settlement into the two-phase form frozen in v1.2 §3.2.

**Files to modify.** `backend/prisma/schema/student-billing/payments.prisma`; `payment/services/payment.service.ts`; new tender service; `receipt/receipt.service.ts`; specs.

**Prisma schema changes.** `PaymentTender` with tenant and branch scoping, mode, amount, instrument reference, and status (`RECEIVED` → `DEPOSITED` → `CLEARED` | `BOUNCED`, both terminal). Not a JSON blob: mode-wise collection and cash tally are daily reports and must be queryable.

**Migrations.** Backfill one tender per existing payment, in `CLEARED`, carrying the payment's existing mode and amount.

**Backend services.** T1 creates the payment pending, the tender received, and the receipt issued — marked subject to realisation where uncleared. T2 on clearance completes the payment and creates allocations. T2′ on bounce reverses the payment, cancels the receipt and reinstates dues. Cash and other immediately-cleared tenders execute T1 and T2 as one transaction. `SUCCESS` now means cleared, not accepted.

**Controllers / DTOs / Validation.** Tender clearance and bounce endpoints, finance-staff roles, idempotent — bank file replays are routine. Validation enforces that tender amounts sum to the payment amount (invariant 1).

**Events.** None yet; `TenderCleared` and `TenderBounced` land in M21.

**Tests.** Cheque received issues a receipt but no allocation. Clearance allocates. Bounce reverses the payment, cancels the receipt and restores dues. Cash collapses both phases into one transaction. Tender sum equals payment amount. Clearance is idempotent under replay.

**Frontend impact.** `billing/page.tsx` collection figures change meaning — uncleared instruments are no longer counted. A cheque management surface is required. This is the most visible behavioural change in the plan and needs coordinated release notes.

**Breaking changes.** Yes — collection recognition semantics change.
**Estimated complexity.** Large.
**Dependencies.** M12.

---

## M14 — `CreditNote`

**Goal.** Provide the correction instrument that invoice immutability requires. Placement rationale in §0.2.

**Files to modify.** New `backend/prisma/schema/student-billing/credit-notes.prisma`; new credit-note service and controller; `invoice/services/invoice.service.ts`; specs.

**Prisma schema changes.** `CreditNote` with tenant and branch scoping, target invoice, amount, reason, its own number series, and a single terminal issued state (`C-5`, v1.2 §3.7). A credit note is not cancellable; the correction for an erroneous credit note is a further credit note.

**Migrations.** Additive. New sequence rows per the M7 mechanism.

**Backend services.** Issue reduces the invoice's cached balance in the same transaction, under the per-invoice lock. Cumulative credit notes never exceed the invoice balance (invariant 5).

**Controllers / DTOs / Validation.** Issue endpoint, finance-staff roles, idempotent. Validation enforces the cumulative limit and a mandatory reason.

**Events.** None yet; `CreditNoteIssued` lands in M21.

**Tests.** Cumulative limit enforced under concurrency. Invoice balance reduced correctly. No mutation path exists on an issued credit note. Number allocated from the M7 series, gap-free.

**Frontend impact.** Issue action on the invoice detail screen; staff-facing label "Fee Adjustment", document label "Credit Note" (`C-5`).
**Breaking changes.** None.
**Estimated complexity.** Medium.
**Dependencies.** M13.

---

# Phase D — StudentAccount and deposits (frozen step 7)

---

## M15 — `StudentAccount` aggregate

**Goal.** Give held balances an owner with an enforceable non-negative invariant (`C-9`).

**Files to modify.** New `backend/prisma/schema/student-billing/student-account.prisma`; new account service; `student-billing.module.ts`; specs.

**Prisma schema changes.** `StudentAccount` per student per tenant. Balance movements append-only, typed, each carrying amount, direction and a reference to what caused it. Balances are derived from movements, never stored as a mutable figure.

**Migrations.** Additive. No backfill — there are no historical held balances.

**Backend services.** Movements are append-only; corrections append a further movement and never edit. Concurrent debit is serialised by a per-student lock (v1.2 §3.8). Balance never negative (invariant 8).

**Controllers / DTOs / Validation.** Read endpoints for held balances, branch-scoped. No direct mutation endpoint — movements are produced by allocation, deposit and refund paths only.

**Events.** None.

**Tests.** Concurrent debit cannot drive a balance negative. Balance derived from movements equals the expected figure. No mutation path exists on a written movement.

**Frontend impact.** Held balances surface on `billing/students/[studentId]/page.tsx`.
**Breaking changes.** None.
**Estimated complexity.** Medium.
**Dependencies.** M14.

---

## M16 — Deposits: `StudentDeposit`, `DepositPolicy`, liability settlement

**Goal.** Liability-nature allocation credits `StudentAccount` (`C-11`, `C-13`, `C-14`).

**Files to modify.** `student-account.prisma`; new `deposit-policy.prisma`; account service; allocation service; specs.

**Prisma schema changes.** `StudentDeposit` as an entity within `StudentAccount` — not an aggregate root — carrying its `FeeHead` reference, collected amount, an immutable refund policy snapshot, and the reference to the allocation that funded it. `DepositPolicy` as configuration referencing a `FeeHead`; `FeeHead` holds no reference back. A tenant-level flag controls whether deposits are collected at all.

**Migrations.** Additive.

**Backend services.** Where an allocation settles a `LIABILITY`-nature charge, the same transaction creates or credits a `StudentDeposit` (transaction T3). Where the nature is `REVENUE`, it does not. Deposit status is derived from movements — `HELD`, `PARTIALLY_SETTLED`, `SETTLED`, `FORFEITED` — never stored. Movement types: `COLLECTED`, `ADJUSTED`, `REFUNDED`, `FORFEITED`. Disabling the tenant flag suppresses new collection and the exit deposit step; it never hides or deletes existing deposits.

**Controllers / DTOs / Validation.** Deposit policy configuration endpoints. Deposit read endpoints. Validation enforces that held balance never exceeds collected (invariant 16) and never goes negative (invariant 17).

**Events.** None.

**Tests.** Liability-nature charge settlement creates a deposit; revenue-nature does not. Policy snapshot immutable after collection. Status derived correctly at each stage. Disabling the flag leaves existing deposits intact and refundable. Two deposits of the same type across separate enrolments are grouped distinctly.

**Frontend impact.** Deposit configuration screen; held deposits on the student billing view.
**Breaking changes.** None.
**Estimated complexity.** Large.
**Dependencies.** M15.

---

## M17 — Deposit adjustment, refund and forfeiture

**Goal.** Discharge held balances through the frozen mechanisms (`C-12`, `C-15`).

**Files to modify.** Account service; allocation service; new deposit controller; specs.

**Prisma schema changes.** None beyond M16.
**Migrations.** None.

**Backend services.** Adjustment (T4) writes one debit movement and one account-sourced allocation of equal amount against the targeted charge, in one transaction — the first live producer of M11's account-sourced branch. Refund (T5) writes one debit movement and the outbound payment record, dated in the current open period regardless of collection date, and is never a `Refund`. Forfeiture (T6) writes one debit movement and records revenue recognition, requires approval, and is never automatic.

**Controllers / DTOs / Validation.** Adjustment, refund and forfeiture endpoints, finance-staff roles, idempotent. Adjustment capped at the lesser of held balance and outstanding dues; refund capped at held balance after adjustment.

**Events.** None.

**Tests.** Every adjustment has exactly one corresponding account-sourced allocation of equal amount (invariant 18). A deposit collected in a locked period refunds without writing into that period (invariant 15). No synthetic `Payment` is created for an adjustment — asserted, since this is the failure the frozen design exists to prevent. Forfeiture requires approval.

**Frontend impact.** Deposit actions on the student billing view.
**Breaking changes.** None.
**Estimated complexity.** Medium.
**Dependencies.** M16.

---

## M18 — Exit settlement application service (`R-10`)

**Goal.** Orchestrate student exit, TC and withdrawal settlement. An application service, not an aggregate.

**Files to modify.** New exit settlement service and controller; specs.

**Prisma schema changes.** None.
**Migrations.** None.

**Backend services.** Reads outstanding position from the projection and held balances from `StudentAccount`. Policy supplies per-deposit defaults; operator override is audited with actor and reason. All selected adjustments and refunds commit or fail together (T7) — the third documented multi-aggregate transaction. Leaving a refund pending requires no state change.

**Controllers / DTOs / Validation.** Preview endpoint returning position and defaults; execute endpoint, idempotent. Validation enforces the adjustment and refund caps of M17.

**Events.** None.

**Tests.** Partial failure rolls back the entire exit. Policy defaults applied; override audited. Pending refund leaves the balance held and visible after exit. Caps enforced.

**Frontend impact.** New exit settlement screen with per-deposit action selection.
**Breaking changes.** None.
**Estimated complexity.** Medium.
**Dependencies.** M17.

---

# Phase E — Ledger (frozen step 8)

---

## M19 — Ledger model and partitioning

**Goal.** Authoritative, immutable, append-only financial history (`C-6`, FEE-3). Not current state; balances are never reconstructed by replay.

**Files to modify.** New `backend/prisma/schema/student-billing/ledger.prisma`; `ledger/services/ledger.service.ts` (currently a 0-byte stub); specs.

**Prisma schema changes.** One row per financial event, immutable on write, tenant and branch scoped, with student, event type, amount, occurrence timestamp and a reference to the originating record.

**Migrations.** **Partitioning MUST be decided and applied at table creation** (v1.2 §4.7). Repartitioning at the projected volume is not realistically achievable later. Partition by tenant or by financial year; either satisfies the requirement.

**Backend services.** Append only. No update or delete path exists anywhere.

**Controllers / DTOs / Validation.** No mutation endpoint. Read access is staff-only; parents reach financial history only through the `AUTH-021` projection.

**Events.** None.

**Tests.** No code path updates or deletes a ledger entry (automated check). Partitioning present and correct. Ledger read endpoints unreachable by `PARENT`/`STUDENT` per `AUTH-021`.

**Frontend impact.** None directly.
**Breaking changes.** None.
**Estimated complexity.** Medium.
**Dependencies.** M18.

---

## M20 — Ledger wiring, backfill and drift detection

**Goal.** Every financial mutation writes a ledger entry in its own transaction; history is backfilled; disagreement is detectable.

**Files to modify.** Every financial service; new reconciliation job; specs.

**Prisma schema changes.** None.

**Migrations.** Backfill existing invoice, payment, discount, refund and late-fee history. Runs after M10's allocation backfill so it executes once against the final model.

**Backend services.** Each mutation writes its ledger entry in the same transaction (T1–T7). A scheduled job asserts each invoice's cached balance equals its ledger-derived balance and reports every disagreement — without it, "authoritative history" has no enforcement (v1.2 §3.3). Disagreement is a defect in the writing path; the job reports, it does not silently correct.

**Controllers / DTOs / Validation.** Drift report endpoint, staff-only.
**Events.** None.

**Tests.** From-scratch ledger summation matches entity totals for a sample of students. Every mutation path produces an entry. Drift job detects a deliberately introduced discrepancy.

**Frontend impact.** None.
**Breaking changes.** None.
**Estimated complexity.** Large.
**Dependencies.** M19.

---

# Phase F — Events (frozen step 9)

---

## M21 — Domain events to the transactional outbox

**Goal.** Emit the seven frozen events reliably. Current emission is in-process and post-commit, so events are lost on crash.

**Files to modify.** Every financial service; `backend/src/infra/queue/workers/outbox.worker.ts` (consumer registration); specs.

**Prisma schema changes.** None — `EventOutbox` exists.
**Migrations.** None.

**Backend services.** The seven events frozen in v1.2 §3.4 — `InvoiceIssued`, `PaymentCompleted`, `TenderCleared`, `TenderBounced`, `RefundCompleted`, `CreditNoteIssued`, `LateFeeAssessed` — written to the outbox inside the producing transaction. No other domain event is introduced. Existing in-process emission is removed. The correct pattern already exists in `saas-payment`.

**Controllers / DTOs / Validation.** None.

**Tests.** A crash after commit but before dispatch still delivers the event. No event is emitted for a rolled-back transaction. Exactly seven event types are produced (automated check).

**Frontend impact.** None.
**Breaking changes.** In-process listeners must migrate to outbox consumers.
**Estimated complexity.** Medium.
**Dependencies.** M20.

---

# Phase G — Fee structure (frozen step 10)

---

## M22 — Fee structure versioning and `FeeTerm`

**Goal.** Term-wise billing with per-term due dates, and versioned structures (`C-3`, FEE-6).

**Files to modify.** `backend/prisma/schema/student-billing/fee-plans.prisma`; `plans/services/*`; `invoice/services/invoice.service.ts`; specs.

**Prisma schema changes.** Structure version. `FeeTerm` with its own due date. Issued invoices reference the structure version they were billed under. Invoices are not versioned (`C-3`).

**Migrations.** Existing plans become version 1. Existing invoices back-link to it.

**Backend services.** Invoice generation is term-wise. A uniqueness constraint on student, term and academic year closes the duplicate-invoice risk in bulk generation. Bulk generation moves off the synchronous request path and becomes idempotent.

**Controllers / DTOs / Validation.** Structure versioning endpoints. Bulk generation returns a job reference rather than blocking.
**Events.** `InvoiceIssued` per M21.

**Tests.** Re-running bulk generation creates no duplicates. Term due dates drive assessment. An issued invoice's structure version is stable across a later revision.

**Frontend impact.** `billing/fee-plan/*` gains terms and versions. Bulk generation becomes asynchronous with progress.
**Breaking changes.** Invoice generation shape changes.
**Estimated complexity.** Large.
**Dependencies.** M21.

---

## M23 — `StudentFeeSchedule` override and `FeeHead` completion

**Goal.** Per-student due-date override (`D-6`); complete the `FeeHead` migration (`C-2`).

**Files to modify.** `fee-plans.prisma`; `fee-heads.prisma`; late-fee service; specs.

**Prisma schema changes.** `StudentFeeSchedule` carrying original due date, override due date, reason, approver and approval timestamp. Original due date preserved, never overwritten. `InvoiceItem.feeHeadId` becomes required; the free-text charge category is removed.

**Migrations.** Any remaining unmapped items are assigned a head before the column is made required. Pre-check per §4.

**Backend services.** Late-fee assessment resolves the effective due date, not the structure default.

**Controllers / DTOs / Validation.** Reschedule endpoint, approval-gated and audited.
**Events.** None.

**Tests.** Rescheduling defers assessment. Original due date recoverable after override. Reporting distinguishes rescheduled from originally-dated.

**Frontend impact.** Reschedule action on the student billing view.
**Breaking changes.** `InvoiceItem` charge category removed.
**Estimated complexity.** Medium.
**Dependencies.** M22.

---

# Phase H — Late-fee completion (frozen step 11)

---

## M24 — Late-fee surface and reversal semantics

**Goal.** Complete FEE-2 item 2 (`X-4`) and implement waiver-versus-reversal (`D-7`).

**Files to modify.** `late-fee/late-fee.service.ts`; `late-fee/late-fee.controller.ts`; new policy configuration; specs.

**Prisma schema changes.** `LateFeePolicy` per branch and term — grace, rate, cap, working-day handling — replacing the hardcoded national defaults. `LateFee.paidAmount` becomes derived from allocations (`C-10`).

**Migrations.** Seed policy rows from the existing hardcoded defaults so behaviour is unchanged at cutover.

**Backend services.** Add `apply`, `reverse` and `list` alongside the existing `waive`. Reversal restores the charge as never having been assessed and reverses its effect on outstanding; waiver records a concession. The interim direct-write mechanism from `829a123` is retired — late-fee settlement now flows through allocation only. Holiday and working-day handling reuses the existing academic calendar.

**Controllers / DTOs / Validation.** Four endpoints, finance-staff roles, idempotent.
**Events.** `LateFeeAssessed` per M21.

**Tests.** Reversal and waiver produce distinct records and distinct reporting. Due date on a holiday does not attract a fee. Policy is honoured per branch. No direct `paidAmount` write path remains.

**Frontend impact.** `billing/late-fee/page.tsx` currently 404s on these routes; it begins working. Policy configuration screen.
**Breaking changes.** Hardcoded defaults removed.
**Estimated complexity.** Medium.
**Dependencies.** M23.

---

# Phase I — Statutory controls (frozen step 12)

---

## M25 — §269ST cash control

**Goal.** Warn or block at ₹2,00,000 aggregated per payer per day (`D-8`). Depends on M12 — without a payer there is no aggregation subject.

**Files to modify.** `payment/services/payment.service.ts`; new limit service; specs.

**Prisma schema changes.** None — derived from payments and tenders.
**Migrations.** None.

**Backend services.** Aggregate cash tenders per payer per day across students and branches within the tenant. Threshold configurable; behaviour (warn or block) configurable.

**Controllers / DTOs / Validation.** Collection endpoints return the limit state before acceptance.
**Events.** None.

**Tests.** Two children paid in cash by one payer on one day aggregate. Cross-branch aggregation within a tenant. Non-cash tenders excluded.

**Frontend impact.** Counter warning before acceptance.
**Breaking changes.** None.
**Estimated complexity.** Medium.
**Dependencies.** M24.

---

## M26 — RTE category and fees-foregone report

**Goal.** RTE/EWS students excluded from invoicing, assessment and defaulter lists, with a reimbursement report (`D-8`). Modelled as a student category, never as a 100% discount.

**Files to modify.** Student schema; `invoice/services/invoice.service.ts`; `late-fee/late-fee.service.ts`; reporting; specs.

**Prisma schema changes.** RTE marker on the student record.
**Migrations.** Additive.

**Backend services.** Generation and assessment skip RTE students. Fees foregone computed from the applicable structure.

**Controllers / DTOs / Validation.** Fees-foregone report endpoint.
**Events.** None.

**Tests.** RTE student is never invoiced, never assessed, never appears as a defaulter. Fees foregone matches the structure.

**Frontend impact.** RTE marker on student records; new report.
**Breaking changes.** None.
**Estimated complexity.** Medium.
**Dependencies.** M25.

---

## M27 — GST posture and day-close artifacts

**Goal.** Resolve the half-implemented GST state and deliver the daily operational reports (`D-8`).

**Files to modify.** `invoices.prisma`; invoice service; new reporting service; specs.

**Prisma schema changes.** GST fields suppressed on the K-12 path, defaulting to exempt. Deposits are outside GST scope entirely (`C-11`).

**Migrations.** Per the decision taken; historical rows are not restated.

**Backend services.** Daily collection register by mode, by collector, with number range; cash tally with opening, collected, deposited and closing; cheques received for deposit; receipt numbers issued including cancellations.

**Controllers / DTOs / Validation.** Report endpoints, finance-staff roles, branch-scoped.
**Events.** None.

**Tests.** Register totals reconcile to tender records. Cancelled numbers appear in the range with status. Exempt-by-default applied on the K-12 path.

**Frontend impact.** Day-close screens.
**Breaking changes.** GST fields no longer populated on the K-12 path.
**Estimated complexity.** Medium.
**Dependencies.** M26. **The GST treatment MUST be confirmed with the institutions' chartered accountant before this milestone starts** (`D-8`).

---

# Independent

---

## M28 — Analytics branch selector (ADR-FEE-002 DD1 closure)

**Goal.** Analytics defaults to the full authorised branch set and narrows on a valid selector (v1.2 §4.6). The shipped implementation in `b56567e` correctly bounds by the authorised set but ignores the selector.

**Files to modify.** `analytics/controllers/analytics.controller.ts`; `analytics/services/analytics.service.ts`; specs.

**Prisma schema changes.** None.
**Migrations.** None.

**Backend services.** Honour the branch selector, intersecting and never widening, per ADR-FEE-002's existing semantics.

**Controllers / DTOs / Validation.** Selector accepted and validated against the authorised set; out-of-range denies rather than falling back.
**Events.** None.

**Tests.** Selector narrows correctly. Out-of-range selector denies. Absent selector returns the full authorised aggregate. A restricted role never exceeds its set, even in aggregate (`AUTH-055`).

**Frontend impact.** `billing/analytics` respects the branch switcher.
**Breaking changes.** None.
**Estimated complexity.** Small.
**Dependencies.** None — may be taken at any point. Closure MUST be recorded in ADR-FEE-002.

---

# Appendix — Cross-cutting checks

Verified once at the end of Phase C, and again at the end of Phase E:

- Exactly one numbering mechanism exists (FEE-2 item 6).
- No hard-delete route and no soft-delete field on any financial model (`IMM-009`, `IMM-010`).
- No ledger entry is updated or deleted by any code path (invariant 12).
- Every retryable financial mutation carries an idempotency key (`IMM-017`, `IMM-018`).
- Every financial write passes its transaction to `AuditService` (`IMM-022`, `IMM-023`).
- Invariants 1–19 each have at least one passing test; 10, 11, 14 and 18 are test-enforced by requirement.
- `INV-1`…`INV-19` cross-role and cross-branch coverage holds.
- No money value passes through a floating-point type.

## ADR revisions required

Two are mandated by the frozen architecture and are not optional:

1. **ADR-FEE-003 invoice state-transition graph** — `OVERDUE` removed (M5).
2. **ADR-FEE-003 payment state-transition graph** — refund state removed, `REVERSED` added, `SUCCESS` redefined as cleared (M6, M13).

Plus the ADR-FEE-002 Deferred Decision 1 closure recorded in M28.
