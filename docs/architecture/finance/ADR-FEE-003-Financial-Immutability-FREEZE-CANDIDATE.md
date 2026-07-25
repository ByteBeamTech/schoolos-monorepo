# ADR-FEE-003 — Financial Immutability

**Status:** Freeze Candidate (pending final review → v1.0) — promoted from Draft now that the last blocking policy question (`EXPIRED`) is resolved; remaining Deferred Decisions (legal retention duration, period-freeze mechanism, discount-reversal mechanism) are non-blocking by their own framing.
**Depends on:** ADR-FEE-001 (Financial Data Visibility), ADR-FEE-002 (Branch Isolation)
**Cross-references:** Finance Architecture Principles, ADR-FEE-004 (Ledger Architecture — this ADR is the foundation ADR-004 builds on), ADR-FEE-005 (Posting Engine — the mechanism that enforces §8's audit requirement transactionally)

| | |
|---|---|
| **Authors** | SchoolOS Finance Architecture |
| **Reviewers** | *(pending review)* |
| **Created** | 2026-07-19 |
| **Version** | Freeze Candidate |

---

## 1. Purpose

This ADR defines the normative model for how financial data changes over time in SchoolOS: what "immutable" means in practice, how entities move between states, the difference between correcting a mistake and reversing a completed fact, why hard delete is prohibited, what must be audited, how concurrent mutations are kept safe, how long records must be kept, and what it means for a financial mutation to be safely retryable.

This is explicitly a **broader** ADR than "no hard delete" — per the founding discussion, it is the foundation ADR-FEE-004 (Ledger Architecture) and ADR-FEE-005 (Posting Engine) build on. Where this ADR says a fact must never be overwritten, ADR-004 defines the structure that stores that fact; where this ADR says a mutation must be atomic and audited, ADR-005 defines the mechanism (the Posting Engine transaction) that satisfies it.

Normative keywords **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, **MAY** per RFC 2119, consistent with ADR-FEE-001/002.

**ID prefix note:** ADR-FEE-001/002 used a single continuous `AUTH-0xx` series because both are authorization ADRs. This ADR is not about authorization — it introduces its own domain-scoped prefix, **`IMM-0xx`**, starting at `IMM-001`. Invariants (`INV-`) remain a single continuous series across all finance ADRs regardless of domain, since they serve the same purpose everywhere (testable FEE-0/FEE-3 verification criteria) — this ADR continues at **INV-14**.

### 1.1 Non-Goals

This ADR does **not** define: the Ledger's schema or entry structure (ADR-FEE-004); the Posting Engine's transaction mechanics (ADR-FEE-005); which domain events fire on which mutation (ADR-FEE-006); authorization for who may perform a mutation (ADR-FEE-001/002 — this ADR assumes the caller is already authorized and governs what happens to the data once they act); specific retention *durations* (§10 — a legal/compliance input this ADR cannot supply on its own).

---

## 2. Audit Findings (Baseline)

Per this project's standing practice, the actual codebase was checked before writing normative rules, rather than assuming a green field.

- **State-machine enums already exist and are clean**: `InvoiceStatus` (DRAFT/SENT/PARTIALLY_PAID/PAID/OVERDUE/EXPIRED/CANCELLED — `EXPIRED` since removed as confirmed-dead code, and `OVERDUE` since made a derived read-time condition rather than a persisted transition target, both see §4), `PaymentStatus` (PENDING/PROCESSING/SUCCESS/FAILED/REFUNDED/PARTIALLY_REFUNDED), `RefundStatus` (PENDING/COMPLETED/FAILED), `LateFeeStatus` (ACTIVE/PAID/WAIVED/REVERSED), `ApprovalStatus` (PENDING/APPROVED/REJECTED/CANCELLED, used by `Discount`). No financial model was found with a hard-delete endpoint, and none carries a `deletedAt` column — the codebase has never had a soft-delete pattern on financial data to begin with, clean or otherwise. §6 ratifies this absence as correct rather than fixing anything.
- **A correct idempotency reference implementation already exists**: offline payment recording checks for an existing `SUCCESS` payment with the same `gatewayPaymentId`/reference before creating a new one, preventing duplicate-submission from creating two payments for one real transaction. §9 canonizes this shape as the model for all financial mutations, the same way ADR-FEE-002 canonized the existing `UserBranch` mechanism.
- **No optimistic-concurrency infrastructure exists anywhere in the financial schema.** No financial model carries a `version` field or any row-locking pattern. (One unrelated `version` field exists on a `saas-billing` model, but per its own code comment it is a plan/schema-version label, not a concurrency-control mechanism — not a precedent to reuse.) This is a genuine gap, not something to ratify. §8 defines the requirement.
- **A concrete, already-identified concurrency bug motivates §8**: `RefundService.initiate()` reads existing refunds to check against a maximum-refundable amount, then creates a new refund, with no transaction wrapping the check-then-create — a classic time-of-check-to-time-of-use gap that could allow two concurrent refund requests to each pass the check before either commits, together exceeding the payment's refundable amount. This is exactly the failure mode §8 exists to close.

---

## 3. Immutability Model

**IMM-001.** A financial fact, once it has occurred, **MUST NOT** be edited or overwritten. "Occurred" means the state transition that recorded it has completed (e.g. a payment reached `SUCCESS`, a discount reached `APPROVED`, a late fee was applied). Correcting an error in an occurred fact **MUST** be done by recording a new, opposing fact (a reversal, §5) — never by mutating the original record's monetary fields, status history, or the fact that it happened.

**IMM-002.** The only mutations a financial record MAY ever receive after creation are: (a) a defined state transition (§4) that is itself a new fact being appended to the record's history, not an edit of a prior one; (b) population of fields that record *how* a transition happened (e.g. `approvedBy`, `waivedBy`, `revokedAt`) at the moment of that transition — these are write-once-per-transition fields, not freely re-editable; (c) fields that are pure denormalized projections recomputed from other immutable facts (e.g. an invoice's `paidAmount` recomputed from its payments) — and even these **MUST** only move in the direction the underlying facts justify, never backward except via a recorded reversal. Once a transition's metadata fields (b) are written, they **MUST** remain immutable — an `approvedBy`/`approvedAt` pair, once set, is itself a financial fact under IMM-001 and is never overwritten by a later transition or correction.

**IMM-003.** This ADR's immutability model applies to the individual entity records that exist today (Invoice, Payment, Discount, LateFee, Refund). ADR-FEE-004 elevates this to a dedicated Ledger as the actual system of record; until ADR-004 lands, these entities *are* the record, and §3–§9 apply to them directly.

### 3.1 Financial Lifecycle (non-normative overlay)

§§3–7 define immutability, transitions, corrections/reversals, deletion, and period-freeze as separate concerns; they are more easily held together as one lifecycle a financial fact moves through:

```
Draft  →  Committed Financial Fact  →  Settled  →  Reversed  →  Archived
(§6)         (IMM-001, "occurred")      (terminal      (§5)      (§7, period
                                          state,                   closed;
                                          §4)                      IMM-020/021)
```

- **Draft**: pre-fact, correctable (§5, IMM-006) — a `DRAFT` invoice, a `PENDING` discount request before decision.
- **Committed Financial Fact**: the moment a transition completes and IMM-001 takes effect — a payment reaching `SUCCESS`, a discount reaching `APPROVED`.
- **Settled**: the entity's own terminal "resolved" state (§4) — `PAID`, `COMPLETED`, `WAIVED`.
- **Reversed**: an opposing fact has been recorded against a settled fact (§5) — a refund against a payment, a reversed late fee.
- **Archived**: the fact now sits in a closed period (§7) — still fully present and queryable, immutable, but no longer eligible for new activity against it except a reversal dated in the current period.

This overlay is descriptive, not an additional normative requirement beyond §§3–7 — it exists to give ADR-FEE-004 (Ledger Architecture) one vocabulary to build against instead of five scattered ones, per review feedback on this draft.

---

## 4. State Transitions

**IMM-004.** Every financial entity's status **MUST** move only along the transitions explicitly defined for it. An implementation **MUST NOT** allow a status update that isn't one of the entity's defined edges (e.g. `PAID` **MUST NOT** transition directly to `DRAFT`; `COMPLETED` (Refund) **MUST NOT** transition to `PENDING`).

Reference transition graphs, reflecting the existing enums (§2) and this project's own established conventions (approve/reject/cancel/revoke, mirroring the pattern already built for feature-flag override requests):

**Invoice:**
```
              DRAFT
                |
                v
              SENT ──────┐
               |  \        |
               v   v       v
        PARTIALLY_PAID  CANCELLED
               |
               v
              PAID
```
`DRAFT → SENT → {PARTIALLY_PAID → PAID, CANCELLED}`. `SENT`/`PARTIALLY_PAID` may reach `PAID` as payments complete. `CANCELLED` is terminal. `DRAFT` may go directly to `CANCELLED`. A `PAID` invoice **MUST NOT** be cancelled (existing, correct behavior per the audit — a refund is the reversal path instead, not a cancellation). Overdue-ness is a derived condition evaluated over `SENT`/`PARTIALLY_PAID`, not a transition target in this graph — see below.

**`EXPIRED` removed (resolved, not deferred):** an earlier draft of this ADR treated `EXPIRED`'s semantics as an open accounting-policy question. Per review, the correct first step was to check whether it had any surviving behavior before treating it as a policy question at all. Verified directly: repo-wide search confirms `InvoiceStatus.EXPIRED` was never set by any code path and never checked by any code path anywhere in `student-billing` (backend or frontend) — genuinely dead code, not a state anyone relied on. There was no policy to decide; there was nothing to decide *about*. Removed from the schema (`backend/prisma/schema/enums.prisma`) as a direct implementation change, not an ADR-level decision — per the standing principle that ADRs are for architectural choices, not for deleting unused states. See the accompanying migration and commit message for the rationale record.

**`OVERDUE` becomes a derived condition, not a persisted state (M5 — this IS an ADR revision, unlike `EXPIRED` above):** `OVERDUE` was not dead code. It was actively written by `LateFeeService.applyLateFees()` (the daily late-fee assessment job) and actively read, independently and inconsistently, by four separate call sites (`InvoiceService.findOverdue()`, `getDefaulters()`, `ReconciliationService.reconciliationSummary()`, `AnalyticsService.getOverview()`) — one of which (`findOverdue()`) had its own latent bug, excluding rows the cron had already marked `OVERDUE` from its own results. Per IMM-005, retiring a live transition target from an entity's state machine **MUST** be treated as a revision to this ADR, not a silent implementation choice — the same discipline applies whether a state is being added or retired, and this is why this change is documented here, unlike `EXPIRED`'s direct removal above.

The change: `LateFeeService.applyLateFees()` **MUST NOT** write `status: 'OVERDUE'`. An invoice that becomes overdue remains `SENT` or `PARTIALLY_PAID`; overdue-ness is derived at read time from one shared predicate (`invoice/overdue.util.ts`, `overdueWhere()`/`isInvoiceOverdue()`) — `status IN (SENT, PARTIALLY_PAID) AND dueDate < now` — that every prior independent copy of the rule now calls into, rather than a status value an entity transitions into. **`isOverdue`**, exposed on the invoice API response (`InvoiceService.findAll()`/`findById()`), is the canonical field for "is this invoice overdue"; consumers, frontend or backend, **MUST NOT** re-derive it from `status`/`dueDate` themselves.

The underlying Prisma `InvoiceStatus` enum is deliberately left unchanged — `OVERDUE` remains a valid enum value. Two reasons, both recorded in the M5 pre-flight review: (a) `SaasInvoice.status` shares this exact enum (a separate bounded context, `ADR-FIN-004`), so removing the value would require a schema migration touching a table this milestone has no authorization to change; (b) unlike `EXPIRED`, this codebase does not have a confirmed-zero live-row count for `OVERDUE` — it is actively written today. Student Billing simply stops writing the value and stops treating it as a transition target; the value's continued presence in the enum is a schema fact, not evidence that `OVERDUE` is still reachable in this graph. A temporary, explicitly-labelled read-side allowance (`overdue.util.ts`'s `LEGACY_OVERDUE_STATUSES`) still matches rows already carrying the value from before this change, so they remain visible rather than silently vanishing from defaulter lists and dashboards; this is a data-migration accommodation for historical rows, not a reopening of `OVERDUE` as something new work may transition an invoice into.

- **Payment**: `PENDING → {PROCESSING → {SUCCESS, FAILED}, FAILED}`. `SUCCESS → {REFUNDED, PARTIALLY_REFUNDED}` as refunds are recorded against it. `FAILED` is terminal (a new payment attempt is a new record, not a resurrected one).
- **Discount** (`ApprovalStatus`): `PENDING → {APPROVED, REJECTED, CANCELLED}`. All three are terminal for the approval decision itself; an approved discount's *application* to an invoice is a separate fact (§5 — revoking an applied discount is a reversal, not an edit back to `PENDING`).
- **LateFee**: `ACTIVE → {PAID, WAIVED, REVERSED}`. All three terminal.
- **Refund**: `PENDING → {COMPLETED, FAILED}`. Both terminal.

**IMM-005.** Adding a new terminal or intermediate state to an existing entity's machine, or a new transition edge, **MUST** be treated as a change to this ADR (a revision), not a silent implementation choice — the same discipline ADR-FEE-001 §11 (default-deny) established for authorization applies here to state machines: an undefined transition is forbidden, not "probably fine."

---

## 5. Corrections vs. Reversals

This distinction is the conceptual core of this ADR and the one most often collapsed in practice.

**IMM-006.** A **correction** fixes an error in a record that has **not yet become a financial fact** — e.g. editing a `DRAFT` invoice's line items before it is sent, or a `PENDING` discount request's requested amount before anyone has approved it. Corrections **MAY** mutate the record directly, because nothing has "occurred" yet in the IMM-001 sense. Once a record leaves its correctable pre-fact state (Invoice leaves `DRAFT`, Discount leaves `PENDING`, etc.), correction is no longer available — only reversal is.

**IMM-007.** A **reversal** offsets a fact that has already occurred, by recording a new, opposing fact — it **MUST NOT** edit or delete the original. Examples already present in the schema and this ADR ratifies as the correct pattern: a `Refund` reverses part or all of a `SUCCESS` `Payment` (the payment record itself is untouched — its status moves to `REFUNDED`/`PARTIALLY_REFUNDED`, a new fact, and the `Refund` is a separate new record); a `LateFee` moving to `WAIVED` or `REVERSED` records the reversal as a status transition with a reason and actor, not a deletion of the fact that the late fee was once `ACTIVE`.

**IMM-008.** Where no reversal mechanism yet exists for a fact type this ADR or a future one identifies as needing one (e.g. reversing an applied `Discount` after invoice generation has already consumed it), the correct fix is to add the reversal mechanism — recording a new opposing fact and threading it back through the same entities it affected — not to allow editing the original `APPROVED` discount record. The specific *accounting effect* of such a reversal (whether the affected invoice's totals recompute directly, or the reversal instead posts a separate adjustment entry against it) is deferred to ADR-FEE-004 — that is a Ledger-structure question, not an immutability one; this ADR fixes only that editing the original record is never the answer.

---

## 6. Soft Delete Policy

**IMM-009.** Financial records **MUST NOT** be hard-deleted. This ADR ratifies the codebase's existing behavior (§2) as correct and binding, not merely incidental: no `DELETE` endpoint exists today for Invoice, Payment, Discount, LateFee, or Refund, and none **MUST** ever be added.

**IMM-010.** Financial records **MUST NOT** use a `deletedAt`-style soft-delete flag either. A `deletedAt` marker is designed to make a record disappear from ordinary queries while technically retaining it — that is the wrong shape for a financial fact, which must remain a first-class, visible part of the record's history (subject to ADR-FEE-001's authorization rules, not to a delete flag). Termination of a financial record's active life **MUST** be represented by a real, meaningful terminal state in its own state machine (§4) — `CANCELLED`, `REJECTED`, `REVERSED`, `WAIVED`, `FAILED` — each of which carries its own reason and actor, which a generic `deletedAt` timestamp does not.

**IMM-011.** "Termination" and "deletion" are not synonyms in this ADR. A cancelled invoice, a rejected discount, and a reversed late fee are all still fully present, queryable (subject to authorization), and immutable records of what happened — they are not soft-deleted, they are terminally stated.

---

## 7. Financial Period Freeze

**IMM-012.** When a financial period is closed — an academic session ends, or a fiscal year closes — records dated within that period **MUST NOT** accept new edits or new postings dated into the closed period. The only mutation a closed-period record **MAY** receive is a reversal, and that reversal **MUST** be dated in the *current* open period, not backdated into the closed one.

Concretely: once a session/FY is closed, **MUST NOT**: create a new invoice dated into it, edit an existing invoice's line items or amounts, record a new payment against an invoice as if it were still open. **MAY**: issue a refund against a payment that occurred in the closed period (the refund itself is dated today, in the open period; the original payment record is untouched per §5).

**IMM-013.** The mechanism for enforcing IMM-012 (a period/session-close flag, and where it's checked) is not specified by this ADR — that is implementation and belongs with ADR-FEE-005's Posting Engine, since the Posting Engine is where every financial mutation is intended to funnel through (per the design discussion this ADR formalizes). This ADR fixes the *requirement*; ADR-005 fixes the *mechanism*.

**Edge case flagged, not resolved here:** a background job (e.g. a queued late-fee application or a retried payment-confirmation) may be processed *after* its target period has closed, if the job was enqueued before close and only executes after. Whether such a late-arriving job is rejected outright, requeued against the now-current period, or handled some other way is a Posting Engine concern (ADR-FEE-005) — this ADR only establishes that IMM-012's freeze applies regardless of *when* the mutation attempt was queued, not just when it was made.

---

## 8. Concurrency and Versioning

**IMM-014.** A financial mutation that reads state to make a decision (e.g. "is this refund within the refundable amount," "has this invoice already been paid") and then writes based on that decision **MUST** do so atomically — the read-decide-write sequence **MUST NOT** be split across a window where a concurrent request can invalidate the decision before the write commits. This directly closes the `RefundService.initiate()` gap identified in §2: the over-refund check and the refund creation **MUST** be wrapped in a single transaction (or equivalent serialization), not two independent statements.

**IMM-015.** Financial entities whose correctness depends on a caller having read the latest state before mutating (approval/rejection of a still-`PENDING` request being the clearest case: two staff members should not both be able to approve the same discount request) **MUST** provide optimistic concurrency control: the mutating write **MUST** be conditioned on the state last read, and **MUST** fail — not silently overwrite — if that state has changed since. This ADR prescribes the guarantee, not the mechanism; a `version` column incremented on every mutation is one valid implementation, and the one this ADR expects will be used given the codebase's existing patterns, but `updatedAt`-conditioned writes, a database-native row-version mechanism, or an equivalent are equally acceptable as long as the guarantee holds. Whatever mechanism is chosen, the concurrency token **MUST** only advance on a successful, committed mutation — never on a failed or rejected attempt. No financial model currently has any such mechanism (§2); one **MUST** be added as part of implementing this ADR, not treated as optional hardening.

**IMM-016.** A concurrency conflict (the optimistic-concurrency check failing, by whichever mechanism IMM-015 uses) **MUST** surface to the caller as a definite failure requiring a fresh read and retry — never as a silent overwrite of the intervening change, and never resolved by "last write wins."

---

## 9. Idempotent Mutations

**IMM-017.** Every financial mutation reachable via a retryable channel (an HTTP endpoint a client may resend after a timeout, a webhook a gateway may redeliver, a queued job that may be reprocessed) **MUST** be safe to receive more than once without producing more than one real-world effect. This ADR canonizes the existing offline-payment pattern (§2) as the model: check for an existing record with the same idempotency key (a gateway reference, a client-supplied request ID, or equivalent) in the relevant terminal/success state before creating a new one; if found, return the existing result rather than creating a duplicate.

**IMM-018.** Every financial mutation endpoint **MUST** have an identified idempotency key before it is considered complete. Where none is naturally available from the caller, the implementation **MUST** mint and require one (e.g. a client-generated request ID header), rather than leaving the endpoint unprotected. This is a concrete, checkable gap this ADR expects FEE-1/FEE-2 to close wherever it does not already exist (payment recording already has it per §2; refund initiation, discount creation, and late-fee application should each be checked against this requirement when implemented/wired).

**IMM-019.** Idempotency and concurrency (§8) are related but distinct: idempotency protects against the *same logical request* arriving twice; concurrency protects against *two different requests* racing over the same state. A mutation endpoint **MUST** satisfy both independently — solving one does not imply the other.

---

## 10. Legal Retention

**IMM-020.** Financial records **MUST** be retained for at least the minimum period required by applicable law and regulation for the jurisdictions SchoolOS operates schools in. This ADR does **not** specify that minimum duration — it is a legal/compliance input this architecture cannot supply on its own, and **MUST NOT** be guessed at or defaulted to an arbitrary number in implementation. The correct duration **MUST** be obtained from whoever owns legal/compliance policy for SchoolOS (the same class of authority ADR-FEE-001 and ADR-FEE-002 drew their confirmed policy decisions from), and recorded here as a revision once known.

**IMM-021.** Until IMM-020's duration is confirmed, the safe default is: **no automated purge of any financial record, ever**, pending that answer. IMM-009's no-hard-delete rule already makes this the natural default; this section exists to make explicit that "we don't delete financial records" and "we have satisfied our legal retention obligation" are not the same claim, and the second one is not yet made by this ADR.

---

## 11. Audit Requirements

**IMM-022.** Every financial state transition (§4) **MUST** produce a corresponding audit trail entry — this extends the practice already established and fixed for feature-flag override requests (this project's own prior work) to every financial entity's transitions. An implementation **MUST NOT** ship a state-transition code path without an accompanying audit write. At minimum, every such entry **MUST** identify: the actor (or an explicit system/no-actor marker for automated transitions, e.g. a cron), the timestamp, the action/transition taken, the target entity and its identifier, and — where the transition carries one — its reason. This is the minimum contract; it does not prescribe implementation (field names, storage shape), only what must be recoverable from the entry.

**IMM-023.** Audit writes for financial mutations **MUST** be transactional with the mutation they record, not best-effort or eventually-consistent — the same distinction this project's design discussion already settled for the Posting Engine (audit is a transactional guarantee; notifications and other side effects are best-effort, downstream of the transaction committing). This ADR states the requirement; ADR-FEE-005 defines the mechanism that satisfies it.

---

## 12. Integrity Invariants

These continue the single cross-ADR `INV-` series (§1's ID-prefix note) and **MUST** be verified alongside ADR-FEE-001's INV-1…INV-9 and ADR-FEE-002's INV-10…INV-13.

- **INV-14.** No financial entity's status **MUST** ever be observed to have taken a transition not listed in its defined state machine (§4).
- **INV-15.** No financial record's monetary fields (amounts, dates that fix when a fact occurred) **MUST** ever differ between two reads taken after the record reached a terminal or fact-recording state, except via a recorded reversal creating a *new* record/entry.
- **INV-16.** No `DELETE` operation **MUST** ever succeed against a financial table in production.
- **INV-17.** A concurrent-mutation test (two simultaneous approval/refund/other decision-dependent requests against the same entity) **MUST** result in exactly one succeeding and the other failing with a concurrency error — never both succeeding, never a lost update.
- **INV-18.** Replaying the same idempotency key against a mutation endpoint **MUST** produce the same terminal result and **MUST NOT** create a second record.
- **INV-19.** Every row in a financial state-transition's audit trail **MUST** exist in the same committed transaction as the state transition itself — an audit entry **MUST NOT** be found missing for any transition that is otherwise visible in the data.

---

## 13. Conflict Resolution

Per ADR-FEE-001 AUTH-005 (most-restrictive-wins, missing-context-denies), which this ADR does not restate but explicitly inherits, adapted to this ADR's domain: where a mutation's correct handling is ambiguous between "allow as a correction" and "require a reversal," the **reversal path governs** — treating a fact as already-occurred and requiring a new opposing entry is the safe default; treating it as still-correctable when it should not have been is the unsafe one. Missing state (e.g. a record whose current status cannot be determined) **MUST** block the mutation, not default to allowing it.

---

## Deferred Decisions

1. **Legal retention duration** (§10, IMM-020) — requires legal/compliance input this ADR cannot supply; blocking only IMM-020's specific number, not the rest of this ADR.
2. **Period-freeze enforcement mechanism** (§7, IMM-013) — the requirement is frozen here; the mechanism is ADR-FEE-005's Posting Engine.
3. **Applied-discount reversal mechanism and its accounting effect** (§5, IMM-008) — flagged as a concrete gap to close, not yet designed; the mechanism is likely FEE-1/FEE-2 territory, the accounting effect (recompute vs. adjustment entry) is ADR-FEE-004's to decide once the Ledger exists to record the reversal against.

## Appendix A — Decision ID Index

| ID | Rule | Section |
|---|---|---|
| IMM-001 | Occurred facts MUST NOT be edited/overwritten; corrections happen via reversal | §3 |
| IMM-002 | Only defined transitions, write-once-per-transition actor/timestamp fields, and justified projections MAY mutate a record post-creation | §3 |
| IMM-003 | Applies to today's entities directly; ADR-004 elevates to a dedicated Ledger | §3 |
| IMM-004 | Status MUST move only along defined transition edges | §4 |
| IMM-005 | New states/edges are an ADR revision, not a silent implementation choice | §4 |
| IMM-006 | Corrections apply only to not-yet-occurred (pre-fact) records | §5 |
| IMM-007 | Reversals offset occurred facts via a new opposing record; never edit the original | §5 |
| IMM-008 | Missing reversal mechanisms MUST be built, not worked around via edits | §5 |
| IMM-009 | No hard delete, ever, for financial records | §6 |
| IMM-010 | No `deletedAt`-style soft delete; use real terminal states instead | §6 |
| IMM-011 | Termination ≠ deletion | §6 |
| IMM-012 | Closed-period records: no new edits/postings dated into the closed period; only reversals, dated in the open period | §7 |
| IMM-013 | Enforcement mechanism is ADR-005's responsibility | §7 |
| IMM-014 | Read-decide-write sequences MUST be atomic | §8 |
| IMM-015 | Decision-dependent mutations MUST provide optimistic concurrency (guarantee, not a mandated mechanism — `version` column expected but not required) | §8 |
| IMM-016 | Concurrency conflicts MUST fail visibly, never silently overwrite | §8 |
| IMM-017 | Retryable mutations MUST be idempotent; offline-payment pattern is the model | §9 |
| IMM-018 | Every mutation endpoint MUST have an identified/minted idempotency key | §9 |
| IMM-019 | Idempotency and concurrency are distinct; both MUST be satisfied independently | §9 |
| IMM-020 | Retention duration is a legal/compliance input, not to be guessed | §10 |
| IMM-021 | Default until confirmed: no automated purge, ever | §10 |
| IMM-022 | Every state transition MUST produce an audit entry | §11 |
| IMM-023 | Audit writes MUST be transactional with the mutation, not best-effort | §11 |
| INV-14 … INV-19 | Testable extensions of the cross-ADR invariant series | §12 |

## Appendix B — Compliance Matrix (to be completed during FEE-1/FEE-2/FEE-3)

| Requirement | Implemented In | Test |
|---|---|---|
| IMM-001 … IMM-007 (immutability, transitions, corrections/reversals) | *(FEE-1/FEE-2 — audit each entity's mutation code paths against §4's transition graphs; M5 partially closes this for Invoice — `OVERDUE` retired as a transition target per the §4 revision above, `LateFeeService.applyLateFees()`'s single write site removed)* | *(FEE-1/FEE-2; M5's change covered by `overdue.util.spec.ts` and the updated `late-fee.service.spec.ts`)* |
| IMM-009 … IMM-011 (no hard delete / no soft-delete flag) | *(already correct — confirmed via audit; add a regression/lint check that no `DELETE` route or `deletedAt` field is ever added to a financial model)* | *(FEE-1)* |
| IMM-012, IMM-013 (period freeze) | *(ADR-FEE-005 — Posting Engine)* | *(FEE-3, once Posting Engine lands)* |
| IMM-014 … IMM-016 (concurrency) | *(FEE-1 — starting with the identified `RefundService.initiate()` gap)* | *(FEE-1)* |
| IMM-017 … IMM-019 (idempotency) | *(FEE-1/FEE-2 — payment recording already compliant; audit refund/discount/late-fee endpoints as each is wired)* | *(FEE-1/FEE-2)* |
| IMM-022, IMM-023 (audit) | *(ADR-FEE-005 — Posting Engine's transactional audit write)* | *(FEE-3)* |

## Appendix C — ADR Traceability

| ADR | Relationship |
|---|---|
| ADR-FEE-001 | Governs who may act; this ADR governs what happens to the data once they do |
| ADR-FEE-002 | Branch-scoping applies to every mutation this ADR governs, unchanged |
| ADR-FEE-004 | Ledger Architecture — the structural elevation of §3's immutability model into a dedicated append-only store |
| ADR-FEE-005 | Posting Engine — the mechanism satisfying §7 (period freeze), §11 (transactional audit), and the single-writer shape that makes §8/§9's guarantees enforceable in one place rather than duplicated per service |
