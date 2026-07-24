# Finance Architecture Delta v1.2

**Status:** Accepted — final architecture amendment before implementation
**Supersedes:** `FINANCE_ARCHITECTURE_DELTA_v1.1.md`
**Baseline:** the finance architecture package as of `f57cdca` (ADR-FEE-001 v1.2, ADR-FEE-002 v1.0, ADR-FEE-003 Freeze Candidate, Roadmap, `IMPLEMENTATION_BACKLOG.md`)

---

## 1. Executive Summary

### 1.1 Why v1.2 exists

`FINANCE_ARCHITECTURE_DELTA_v1.1.md` recorded the decisions taken after the original architecture freeze and raised four unresolved conflicts (`X-1`…`X-4`). Those conflicts have since been resolved, and a Domain-Driven Design review of the finance domain model produced a set of refinements to the decisions v1.1 recorded.

v1.2 exists to consolidate both into a single accepted amendment. It preserves every accepted decision from v1.1, resolves the four conflicts, and incorporates the DDD refinements. It introduces no new architectural concepts.

This document is the final architecture amendment before implementation begins. It supersedes v1.1 in its entirety; v1.1 remains on disk as historical record and MUST NOT be cited as current.

### 1.2 Scope

In scope: the operational finance domain model of the `student-billing` module — aggregate boundaries, ownership, transaction and consistency boundaries, domain events, idempotency, invariants, and the implementation corrections identified as mandatory.

Out of scope, and unchanged by this document: double-entry accounting, Journal, Gateway Clearing Accounts (`ADR-FIN-005`, Phase 4); the Financial Engine bounded-context boundary (`ADR-FIN-002`, other than the Allocation entity promoted by `X-2`); the Payment Platform (`ADR-FIN-004`); notifications and dunning.

### 1.3 Relationship with the accepted ADRs

This document is an amendment, not an ADR. It creates no normative rule on its own authority and does not modify, supersede or relax any rule in ADR-FEE-001, ADR-FEE-002 or ADR-FEE-003.

- **ADR-FEE-001 (Accepted v1.2)** — authorization model. §2.4 of this document resolves a naming collision against `AUTH-021` and confirms the projection defined there is unchanged.
- **ADR-FEE-002 (Accepted v1.0)** — branch isolation. §4.6 records the closure of Deferred Decision 1. `AUTH-050`…`AUTH-058` are unchanged.
- **ADR-FEE-003 (Freeze Candidate)** — immutability, state machines, concurrency, idempotency, audit. §3 and §4 apply its existing rules to entities introduced by v1.1. The `PaymentStatus` and `InvoiceStatus` changes in §4.3 and §4.4 require a revision to ADR-FEE-003's state-transition graphs; that revision MUST be made in ADR-FEE-003 itself, not here.

Decision identifiers `D-1`…`D-9`, `C-1`…`C-5` from v1.1 are preserved unchanged. New identifiers in this document continue in the same provisional series (`C-6`…`C-10`, `R-1`…`R-9`, `M-1`…`M-5`). Per `IMPLEMENTATION_RULES.md` §9, real `AUTH-`/`IMM-` identifiers MUST be assigned only when these are folded into a named ADR, taking the next unused identifier in the relevant series.

---

## 2. Accepted Clarifications

### 2.1 (C-6) The Ledger is authoritative financial history, not current state

The Ledger defined by `IMPLEMENTATION_BACKLOG.md` FEE-3 **MUST** be understood as the authoritative, immutable, append-only record of what occurred. It **MUST NOT** be described or implemented as the source of truth for current state.

Current state is held by the aggregates that own it: `Invoice` holds its own balance, `Payment` its own settlement state, `LateFee` its own outstanding amount, `StudentAccount` its own balances. Those aggregates **MUST** enforce their own invariants independently of the Ledger.

The system **MUST NOT** reconstruct current balances by replaying Ledger entries. Event sourcing is explicitly not the model.

Where an aggregate's cached figure and the Ledger-derived figure disagree, the disagreement **MUST** be treated as a defect in the writing path. The Ledger is the evidence used to investigate; it does not silently correct the aggregate. A scheduled reconciliation job **MUST** exist to detect such disagreement (§3.3).

FEE-3's own phrasing — "source of truth for balances" — **MUST** be read as superseded by this clarification when FEE-3 is implemented.

### 2.2 (C-7) Payment creates the Receipt; Receipt is an independent aggregate root

The `Payment` aggregate **MUST** create the `Receipt`. Once created, `Receipt` **IS** an independent aggregate root.

`Payment` **MUST** hold only the Receipt's identity. `Payment` **MUST NOT** hold authority over the Receipt's lifecycle. Receipt cancellation, reprint, duplicate marking and series contiguity are `Receipt`'s own invariants, and no `Payment` operation **MAY** modify them.

`Receipt.paymentId @unique` remains mandatory and unchanged (`IMPLEMENTATION_HANDOFF.md` §10).

### 2.3 (C-8) Ownership boundaries and transaction boundaries are distinct concepts

Ownership is a modelling decision: which aggregate holds an entity's invariants and governs its lifecycle. Transaction co-location is a durability decision: which writes MUST commit or fail together.

The two **MUST NOT** be conflated. Two aggregates written in one transaction do not thereby become one aggregate, and one aggregate's entities are not thereby required to be written in a single transaction across its whole lifecycle.

Where an invariant genuinely spans two aggregate roots, a single transaction spanning both is permitted, and such cases **MUST** be documented as deliberate. Two such cases exist and are recorded in §3.1.

### 2.4 (C-9) `StudentAccount` aggregate and the `AUTH-021` Student Financial Account projection

Two distinct concepts exist. They **MUST NOT** share a name and **MUST NOT** be merged.

**`StudentAccount` — aggregate root.** Owns the student's held balances: advance balance, credit balance and security deposit. These carry enforceable invariants (notably `balance >= 0`) that **MUST** be enforced transactionally under concurrent debit. `StudentAccount` **MUST** be the lock target when advance or credit is applied. Balance movements **MUST** be append-only, with the balance derived from them.

**Student Financial Account — projection.** Defined by ADR-FEE-001 §8 (`AUTH-021`) and scoped by `IMPLEMENTATION_BACKLOG.md` FEE-4. A read model presenting outstanding across invoices and academic years, current exposure, running balance and the parent statement. It holds no invariants, enforces nothing, and remains parent-safe by construction. Architectural Invariant 3 continues to apply: a projection is never the source of truth.

The distinguishing test is whether the concept requires a lock. Advance debit does; outstanding does not.

Consequently: `Invoice` **MUST NOT** be required to compute a student's total outstanding position across invoices, and `Payment` **MUST NOT** maintain advance balance. Student-level financial position is owned by `StudentAccount` (for held balances) and by the projection (for reporting).

### 2.5 (C-10) `PaymentAllocation` targets a Charge, not an Invoice

`PaymentAllocation` **MUST** be modelled as targeting a charge, not specifically an invoice. Allocation **MUST** be the single mechanism by which money is applied to any charge.

A charge is any obligation money can be allocated against. At minimum this includes invoices and late fees; adjustments and other charge types extend the same mechanism without reshaping allocation.

The `Charge` supertype **MAY** be introduced when the additional charge types require it. The allocation target decision is the freeze-critical part and is taken now: allocation **MUST NOT** be built with an invoice-only target.

Consequently, `LateFee.paidAmount` **MUST** become derived from allocations targeting that late fee, and **MUST NOT** be written directly. The interim direct-write mechanism introduced in commit `829a123` **MUST** be retired when allocation lands. It **MUST NOT** be extended.

---

## 3. Accepted DDD Refinements

### 3.1 (R-1) Aggregate ownership

The finance domain's aggregate roots and their contents are frozen as follows.

| Aggregate root | Contains | Basis for the boundary |
|---|---|---|
| `Invoice` | `InvoiceItem` | Items have no meaning outside their invoice; the totals invariant is internal |
| `Payment` | `PaymentTender`, `PaymentAllocation`, `Refund` | All three are constrained by the payment's amount; the invariants are internal |
| `Receipt` | — | Independent lifecycle and its own number series (§2.2) |
| `CreditNote` | — | Cannot reside within `Invoice`, which is immutable after issue |
| `LateFee` | — | Owns its own assessment, waiver and reversal lifecycle |
| `StudentAccount` | balance movements | Held balances with enforceable invariants (§2.4) |
| `Discount` | `DiscountApproval` | Existing model, unchanged |
| `FeeStructure` | `FeeItem`, `FeeTerm` | Configuration aggregate |

`Refund` **MUST** reside within the `Payment` aggregate. The invariant it protects — cumulative refunds not exceeding the payment amount less prior refunds — spans payment and its refunds, and `Payment` is therefore the consistency boundary.

The `Payment` aggregate is bounded by a single counter transaction and **MUST** remain so bounded. It **MUST NOT** be permitted to grow with tenant size, student count or elapsed time.

The Ledger is not an aggregate. Its entries carry no cross-entry invariant and are immutable on write.

Ownership per entity:

| Entity | Owner aggregate | Lifecycle owner | Invariants owner |
|---|---|---|---|
| `InvoiceItem` | `Invoice` | `Invoice` | `Invoice` |
| `PaymentTender` | `Payment` | `Payment` | `Payment` |
| `PaymentAllocation` | `Payment` | `Payment` | `Payment` and the targeted charge |
| `Refund` | `Payment` | `Payment` | `Payment` |
| `Receipt` | `Receipt` | `Receipt` | `Receipt` |
| `CreditNote` | `CreditNote` | `CreditNote` | `Invoice` (cumulative limit) |
| `LateFee` | `LateFee` | `LateFee` | `LateFee` |
| Balance movement | `StudentAccount` | `StudentAccount` | `StudentAccount` |
| `DiscountApproval` | `Discount` | `Discount` | `Discount` |
| Ledger entry | — | Writing aggregate | None (immutable on write) |

`Invoice.paidAmount` and `Invoice.dueAmount` **MUST** be owned by the `Invoice` aggregate and updated only by `Invoice` in response to allocation. No other aggregate **MAY** write them.

Two deliberate multi-aggregate transactions exist and are recorded here as permitted under §2.3:

1. `Payment` creates `Receipt` within the settlement transaction, protecting the invariant that a settled payment always has exactly one receipt.
2. `PaymentAllocation` updates the targeted charge's cached balance within the same transaction, protecting the invariant that allocations never exceed the charge's outstanding amount.

### 3.2 (R-2) Transaction boundaries

Recognition on clearance (`D-5`) splits settlement into two transactions for instruments.

**T1 — tender received.** `Payment` (pending) + `PaymentTender` (received) + `Receipt` (issued) + Ledger entry recording instrument receipt + audit entry. The receipt **MUST** be issued at the counter. For an instrument not yet cleared, the receipt **MUST** be marked as subject to realisation.

**T2 — tender cleared.** `PaymentTender` (cleared) + `Payment` (completed) + `PaymentAllocation` records + targeted charges' cached balances + Ledger entry recording application of funds + audit entry.

**T2′ — tender bounced.** `PaymentTender` (bounced) + `Payment` (reversed) + `Receipt` (cancelled) + reversing Ledger entry + audit entry.

For cash and other immediately-cleared tenders, T1 and T2 **MUST** be executed as a single transaction.

`Receipt` creation **MUST NOT** be transactionally bound to allocation.

The following **MUST** each occur within a single transaction: invoice issue with its items, number allocation and Ledger entry; credit note issue with Ledger entry and invoice cache update; refund settlement with payment state change and Ledger entry; late fee assessment with Ledger entry; late fee waiver or reversal with Ledger entry and invoice cache update; any `StudentAccount` balance movement with its Ledger entry.

Every transaction listed in this section **MUST** write its audit entry within the same transaction, per `IMM-022`/`IMM-023`. `AuditService` accepts a caller transaction as of commit `4bf4157`; every financial path **MUST** pass one.

### 3.3 (R-3) Consistency boundaries

**Strong consistency is mandatory** for every transaction in §3.2, and for these three cross-aggregate money invariants, which **MUST** be enforced under a lock and **MUST NOT** be enforced optimistically:

- allocation against a charge's outstanding amount;
- refund against a payment's refundable balance;
- credit note against an invoice's balance.

**Eventual consistency is mandatory** — that is, these **MUST NOT** be performed within a financial transaction — for: analytics, the Student Financial Account projection, reports and ageing, notifications, gateway reconciliation, and the drift-detection job below.

A scheduled reconciliation job **MUST** exist that asserts each invoice's cached balance equals its Ledger-derived balance, and reports every disagreement. Without it, §2.1's treatment of the Ledger as authoritative history has no enforcement.

### 3.4 (R-4) Domain events

The following domain events **SHALL** exist. No other domain event **SHALL** be introduced in this module without an ADR-level decision.

| Event | Consumers |
|---|---|
| `InvoiceIssued` | notification, Ledger, projection |
| `PaymentCompleted` | Ledger, projection, analytics, receipt |
| `TenderCleared` | payment completion, collection reporting |
| `TenderBounced` | dues reinstatement, receipt cancellation, notification |
| `RefundCompleted` | Ledger, projection, notification |
| `CreditNoteIssued` | Ledger, projection |
| `LateFeeAssessed` | notification, projection |

Domain events **MUST** be written to the existing `EventOutbox` within the same transaction as the state change that produced them. Domain events **MUST NOT** be published through in-process emission after transaction commit, which is lossy on crash. The correct pattern already exists in this repository in `saas-payment` and **MUST** be followed.

### 3.5 (R-5) Idempotency

Every operation below **MUST** be idempotent, keyed on a caller-supplied or content-derived key, following the offline-payment pattern already implemented in `PaymentService.recordOffline()`.

| Operation | Basis |
|---|---|
| `verifyRazorpay` | Client-driven and retryable; a replay currently double-credits (§4.1) |
| `recordOffline` | Already compliant; the reference implementation |
| Refund initiation | Money leaving the institution; a retry must not double-refund |
| Allocation application | Retried after partial failure |
| Credit note issue | A retry must not double-credit |
| Late fee waiver and reversal | A retry must not double-waive or double-reverse |
| Discount approval | A retry must not re-approve |
| Invoice generation and bulk generation | Bulk generation is retried after timeout |
| Tender clearance | Bank file replays are routine |

Every operation that moves money or issues a numbered document **MUST** be idempotent.

### 3.6 (R-6) Invariants

The following **MUST NEVER** be violated.

1. Sum of a payment's tender amounts equals the payment amount.
2. Sum of a payment's allocations does not exceed the payment amount.
3. Sum of allocations against a charge does not exceed that charge's outstanding amount.
4. An invoice's due amount is never negative.
5. Sum of credit notes against an invoice does not exceed that invoice's balance.
6. Sum of refunds against a payment does not exceed the payment amount less prior refunds.
7. A late fee's amount equals paid plus waived plus outstanding.
8. A `StudentAccount` balance is never negative.
9. Exactly one receipt exists per payment.
10. Receipt numbers are contiguous per branch per financial year; cancelled numbers are retained in series.
11. Collections are recognised only on cleared tenders.
12. Ledger entries are never updated or deleted.
13. No hard delete and no soft-delete flag exists on any financial entity (`IMM-009`, `IMM-010`).
14. An invoice's cached balance equals its Ledger-derived balance.
15. No financial write is dated into a locked period except a reversal.

Invariants 1–8 **MUST** be enforced by database constraint or in-aggregate check. Invariants 10, 11 and 14 **MUST** be enforced by automated test.

### 3.7 (R-7) State machines

`InvoiceStatus` **MUST NOT** contain `OVERDUE` as a stored value (§4.3). An invoice **MUST NOT** transition from a paid state back to an issued state; the correction instrument is a credit note.

`PaymentStatus` **MUST** describe money state only: pending, completed, failed, reversed (`D-4`). It **MUST NOT** contain refunded or partially-refunded values (§4.4). Where tenders exist, a payment is completed only when every tender has cleared.

`PaymentTender` **MUST** implement: received → deposited → cleared or bounced. Cleared and bounced are terminal.

`Refund` **MUST** distinguish a reserved refund from one in flight at the gateway. A single pending value **MUST NOT** represent both.

`CreditNote` **MUST** be single-state and terminal on issue. A credit note **MUST NOT** be cancellable; the correction for an erroneous credit note is a further credit note.

`LateFee` **MUST NOT** reach a paid state by direct write. It **MUST** reach it through allocation (§2.5).

### 3.8 (R-8) Concurrency

The following locking strategy is frozen. No additional locking mechanism **SHALL** be introduced.

| Contention point | Required strategy |
|---|---|
| Payment replay | Compare-and-swap predicated on current status (§4.1) |
| Concurrent collection against one invoice | Existing per-invoice advisory lock |
| Refund concurrent with allocation | Existing per-payment advisory lock |
| Receipt and invoice numbering | Row lock on the sequence row, scoped to branch and financial year |
| Late fee assessment concurrent with settlement | The same per-invoice advisory lock (§4.2) |
| Invoice regeneration | Unique constraint on student, term and academic year |
| Allocation retry | Idempotency key |
| Concurrent `StudentAccount` debit | Per-student lock over append-only movements |
| Write into a closing period | Period-freeze check evaluated inside the transaction |

Advisory locks **MUST** use the two-argument form, namespaced by lock class, so that identifiers of different entity types cannot collide within a shared key space.

### 3.9 (R-9) `AUTH-021` projection unchanged

Nothing in this document modifies the Student Financial Account projection defined in ADR-FEE-001 §8, or its scope in FEE-4. The projection remains read-only, parent-safe by construction, and never a source of truth.

---

## 4. Mandatory Implementation Corrections

Each correction below is mandatory and **MUST** be completed. They are ordered by execution priority.

### 4.1 (M-1) Compare-and-swap protection for `verifyRazorpay` replay

`PaymentService.verifyRazorpay()` loads a payment by gateway order identifier, verifies the HMAC signature, then unconditionally sets the payment to a successful state and applies its amount to the invoice. There is no check that the payment is not already in that state.

All inputs are deterministic and client-supplied, and the endpoint is reachable by the `PARENT` role. A replayed request therefore credits the invoice twice. Receipt generation is idempotent on payment identity, so the duplicate credit produces no second receipt and is invisible in the receipt register.

The status update **MUST** be performed as a compare-and-swap predicated on the payment's current pending status, consistent with the pattern established in commit `718ce07`. Where the swap affects zero rows, the operation **MUST** return the existing settlement result and **MUST NOT** re-apply the amount.

This is the first implementation task.

### 4.2 (M-2) Late-fee assessment MUST take the invoice lock

The late-fee assessment job reads and writes invoice balance fields without holding any lock, concurrently with payment settlement, which reads and writes the same fields under the per-invoice advisory lock. This is a lost-update race.

Late-fee assessment **MUST** acquire the same per-invoice advisory lock used by settlement, and **MUST** perform its late fee record creation and invoice update within a single transaction.

### 4.3 (M-3) `OVERDUE` becomes a derived state

Overdue status is a function of due date and outstanding balance. It is currently stored, and becomes true only when the assessment job touches the row, which is why the analytics figure and the overdue listing disagree.

`OVERDUE` **MUST** be derived at query time from due date and outstanding balance. It **MUST NOT** be stored as an invoice status value. All consumers **MUST** use one derivation. The corresponding revision to ADR-FEE-003's invoice state-transition graph **MUST** be made in that ADR.

### 4.4 (M-4) Remove refund state from `PaymentStatus`

`PaymentStatus` currently carries refunded and partially-refunded values that are set independently of the refund records. This is the mechanism behind the defect in which fully refunding one payment zeroes an invoice's paid amount and re-bills money the institution still holds.

Refund state **MUST** be derived from a payment's refund records and **MUST NOT** be persisted on the payment. The values **MUST** be removed from `PaymentStatus`, with a data migration for existing rows. The corresponding revision to ADR-FEE-003's payment state-transition graph **MUST** be made in that ADR.

The invoice re-billing defect in `RefundService` **MUST** be corrected in the same change.

### 4.5 (M-5) Aggregate ownership MUST be documented in code

The aggregate boundaries frozen in §3.1, and the two deliberate multi-aggregate transactions recorded there, **MUST** be documented at the point of implementation, so that a future reader does not infer the boundaries from lock placement alone.

### 4.6 `ADR-FEE-002` Deferred Decision 1 — closure

Deferred Decision 1 (per-branch analytics scope) is closed. Analytics **MUST** default to the caller's full authorised branch set, and **MUST** narrow to a single branch where a valid branch selector is present, consistent with the selector semantics already established in ADR-FEE-002 — a selector selects within the authorised set and never widens it. The shipped implementation in commit `b56567e` correctly bounds by the authorised set and **MUST** be extended to honour the selector. The closure **MUST** be recorded in ADR-FEE-002.

### 4.7 Ledger physical design

The Ledger's partitioning strategy **MUST** be decided and applied when FEE-3 creates the table. It **MUST NOT** be deferred.

---

## 5. Updated Architecture Maturity

Two figures are recorded, because they measure different things and the difference between them is itself the useful signal.

**Model as specified — 8.2 / 10.** The accepted ADRs, this amendment and the frozen decisions together define documented invariants, specified state machines, a complete authorization model, an enforced immutability policy and correct aggregate identity on the entities where it is hardest.

**Model as implemented — 7.0 / 10.** Held below the specified figure by: the live double-credit path in §4.1; status fields conflating independent facts; two money-application mechanisms about to coexist until §2.5 is completed; and domain events published lossily despite the correct pattern existing in this repository.

**Target on completion — 9.0 / 10**, reached when allocation, the Ledger, the outbox migration and `PaymentTender` are delivered and the corrections in §4 are complete.

The spread of approximately 1.2 points between specified and implemented is narrow, and is concentrated in the paths that move money. Closing §4 closes most of it.

---

## 6. Final Frozen Decisions

The following are frozen. They **MUST NOT** be revisited during implementation. A change to any of them requires an ADR-level decision, per `IMPLEMENTATION_RULES.md` §2.

1. `Guardian` is the financial payer of record; `Payment` carries a nullable payer reference (`D-1`).
2. Invoice and receipt numbering is scoped to branch and financial year, gap-free, with cancelled numbers retained (`D-2`).
3. Allocation state and refund state are derived, never stored (`D-3`).
4. `PaymentStatus` describes money state only (`D-4`).
5. Instrument lifecycle is owned by `PaymentTender`; collections are recognised only on clearance (`D-5`).
6. Per-student due-date override exists, preserving the original due date (`D-6`).
7. Waiver and reversal are distinct outcomes (`D-7`).
8. Statutory controls — cash receipt limits, RTE exemption, GST posture, day-close artifacts — are production gates (`D-8`).
9. Decimal discipline extends from schema to service layer (`D-9`).
10. `FeeHead` only, maximum depth two; no separate fee-category entity (`C-1`).
11. Charge types are fee heads, not entities (`C-2`).
12. Fee structure is versioned; invoices are not (`C-3`).
13. The allocation rule is recorded on every allocation (`C-4`).
14. Credit note terminology is retained on the entity and on parent- and auditor-facing documents (`C-5`).
15. The Ledger is authoritative financial history, not current state (`C-6`).
16. `Payment` creates the `Receipt`; `Receipt` is an independent aggregate root thereafter (`C-7`).
17. Ownership boundaries and transaction boundaries are distinct (`C-8`).
18. `StudentAccount` is an aggregate; the Student Financial Account is a projection; they are distinct (`C-9`).
19. `PaymentAllocation` targets a charge, not an invoice (`C-10`).
20. The Ledger is persisted and append-only, per FEE-3 as written (`X-1` resolved).
21. `PaymentAllocation` is promoted into the pre-production set by explicit authorization; the Financial Engine boundary remains unstarted (`X-2` resolved).
22. `ADR-FEE-002` Deferred Decision 1 is closed with selector-aware semantics (`X-3` resolved).
23. FEE-2 is incomplete until the full late-fee endpoint surface exists (`X-4` resolved).
24. The aggregate roster and ownership table in §3.1.
25. The domain event set in §3.4; no further events without an ADR.
26. The locking strategy in §3.8; no further locking mechanisms.

### Implementation sequence

1. §4.1 — compare-and-swap on `verifyRazorpay`.
2. `D-9` decimal discipline, and the refund re-billing defect (§4.4).
3. §4.2 — invoice lock in late-fee assessment.
4. §4.3 and §4.4 — derived overdue, refund state removed from `PaymentStatus`.
5. `D-2` — financial-year, branch-scoped, gap-free numbering.
6. `PaymentAllocation` with charge targeting (`C-10`), `D-1` payer reference, `C-4` allocation rule, and `D-5` `PaymentTender`.
7. `StudentAccount` aggregate (`C-9`).
8. Ledger (FEE-3) with partitioning decided at creation (§4.7).
9. Outbox migration for domain events (§3.4).
10. `D-6`, `C-1`, `C-2`, `C-3` with FEE-6.
11. `D-7` and the remaining late-fee endpoint surface (`X-4`).
12. `D-8` statutory controls.

---

## 7. Changelog (v1.1 → v1.2)

**Status change.** v1.1 was `Addendum — pending review`. v1.2 is `Accepted — final architecture amendment before implementation`, and supersedes v1.1 in full.

**Conflicts resolved.** All four conflicts raised in v1.1 §Conflicts are closed: `X-1` in favour of the persisted append-only Ledger as FEE-3 specifies; `X-2` by promoting the `PaymentAllocation` entity through explicit authorization while leaving the Financial Engine boundary unstarted; `X-3` by closing ADR-FEE-002 Deferred Decision 1 with selector-aware semantics; `X-4` by confirming FEE-2 incomplete. The `OpeningBalanceSnapshot` entity deferred in v1.1 is now permanently withdrawn as a consequence of `X-1`: opening balance is a Ledger entry type per FEE-5 and the entity **MUST NOT** be created.

**Clarifications added.** `C-6` Ledger as authoritative history rather than current state; `C-7` Payment creates Receipt, Receipt independent thereafter; `C-8` ownership distinct from transaction boundaries; `C-9` `StudentAccount` aggregate distinct from the `AUTH-021` projection; `C-10` allocation targets a charge.

**Refinements added.** `R-1` through `R-9`: the frozen aggregate roster and ownership table; two-phase settlement for instruments; strong and eventual consistency boundaries; the seven-event domain event set and the mandatory outbox mechanism; the idempotency roster; fifteen invariants; state machine corrections; the frozen locking strategy.

**Corrections added.** `M-1` through `M-5`, plus ADR-FEE-002 Deferred Decision 1 closure and the Ledger partitioning requirement.

**Maturity assessment added.** Not present in v1.1.

**Preserved unchanged from v1.1.** Decisions `D-1` through `D-9` and clarifications `C-1` through `C-5`, in full and without modification. The v1.1 table of decisions already covered by existing package documents remains accurate and is not restated here.

---

## 8. References

- `ADR-FEE-001-Financial-Data-Visibility-v1.2.md` — `AUTH-003`, `AUTH-021`, §4, §7, §8
- `ADR-FEE-002-Branch-Isolation-v1.0.md` — `AUTH-050`–`AUTH-058`, Deferred Decision 1
- `ADR-FEE-003-Financial-Immutability-FREEZE-CANDIDATE.md` — `IMM-001`–`IMM-023`, §3, §4, §7
- `ADR_INDEX.md` — ADR status; `ADR-FIN-002`/`004`/`005` reserved scope
- `ARCHITECTURE_STATE.md` — bounded contexts, Ledger v1 and v2 disambiguation, payment flow
- `IMPLEMENTATION_BACKLOG.md` — Epics FEE-0 through FEE-8
- `IMPLEMENTATION_HANDOFF.md` — §8 conventions, §10 must-never-change list
- `IMPLEMENTATION_RULES.md` — §2, §3, §9, §12
- `SchoolOS-Target-Financial-Architecture-ROADMAP.md` — Architectural Invariants 1–5
- `student-billing-audit.md` — original findings
- `FINANCE_ARCHITECTURE_DELTA_v1.1.md` — superseded; historical record
- `docs/SESSION-HANDOFF-FEE-0-FEE-1.md` — FEE-0/FEE-1 implementation record

**Statutory references**, per `D-8`, to be confirmed with the institutions' chartered accountant as state fee regulation varies: Income-tax Act §269ST and §271DA; RTE Act §12(1)(c); CGST Notification 12/2017-CT(R) entry 66.
