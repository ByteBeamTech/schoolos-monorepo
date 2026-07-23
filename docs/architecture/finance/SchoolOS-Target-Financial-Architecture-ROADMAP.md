# SchoolOS — Target Financial Architecture (Roadmap)

> **This is the product's architectural destination, not an ADR.** It carries no RFC-2119 normative weight of its own and is not itself implementation-ready — but it is a **directional commitment**, not a hypothetical. SchoolOS's finance module is expected to evolve toward this architecture over coming releases. The distinction from an ADR is about *when* and *how much*, not *whether*.
>
> **How it's used — Business Vision → Target Financial Architecture → Architectural Invariants → Roadmap → ADR → Implementation → Code:**
> - **Business Vision** (not written down here — the underlying "why," owned by product/business) motivates:
> - **Target Financial Architecture** — the bounded contexts and destination shape (below), which motivates:
> - **Architectural Invariants** — the handful of rules that hold regardless of how the roadmap changes (below) — these sit *above* the roadmap, not inside it.
> - **Roadmap** — the phased, measurable path (below) — revisable on evidence, unlike the invariants.
> - Each **ADR** (`ADR-FEE-0xx` today, `ADR-FIN-0xx` once scope outgrows the fee module) defines the **next step**, pulling one or more roadmap concepts in when they become relevant.
> - **Implementation** and **Code** realize only that step — never the whole destination at once.
> - Every future finance ADR **SHOULD** note which roadmap phase/invariant it moves toward, so the connection stays visible over time instead of being reconstructed from memory.
>
> **Relationship to ADR-FEE-001/002/003:** those remain the actual governing contracts for what the finance module does today — code-grounded, reviewed line-by-line, normative. This document does not supersede or freeze any of their decisions; where this roadmap and an accepted ADR-FEE-0xx decision differ (e.g. single-entry today vs. double-entry as a future direction), the ADR governs current behavior and this document records the direction future work should not foreclose.
>
> **This roadmap is itself revisable.** Treating it as the destination is a default, not a permanent commitment immune to evidence. If a later ADR's code-grounded audit finds that a piece of this roadmap doesn't fit where the product actually needs to go (e.g. POS/retail never becomes a real requirement, or a different boundary turns out to work better once more of the system exists), the correct response is to revise this document explicitly — the same way ADR-FEE-002's `SCHOOL_ADMIN` policy question was resolved by getting a real answer rather than assumed — not to silently drift from it or treat it as unquestionable because it's labeled "the roadmap."
>
> **The `ADR-FIN-0xx` numbers below are reserved slots for future work in this direction — not scheduled, not authorized for start by this document's existence, but expected to eventually happen in roughly this shape.**

---

## Vision Statement

SchoolOS's finance module should not become fee-collection software that has to be rewritten if the product later needs to bill for admissions, transport, hostel, library fines, event registration, or (further out) retail/canteen/bookstore sales. The direction: every billable event across the ERP eventually routes through one financial engine, rather than each module inventing its own invoicing/payment logic.

```
ERP Modules (Admissions, Academics, Fees, Transport, Hostel, Library, Events, ...)
        │
        ▼
  Financial Engine  →  Payment Platform  →  Cash / Cheque / UPI / Razorpay / Stripe / POS
        │                                              │
        │                    Confirmation Events ──────┘
        ▼
  Payment · Allocation · Receipt · Journal · Ledger
        │
        ▼
  Projections (Student Due, Parent Portal, Cashier, Reports)
```

## Bounded Contexts (Direction, Not Design)

- **Admissions** — application, verification, decision, application-fee *request*. Does not own Invoice/Payment/Receipt/Ledger.
- **Enrollment** — the intended long-term billing root for recurring student fees (`PROVISIONAL → ACTIVE → COMPLETED/WITHDRAWN/TRANSFERRED`). Today, ADR-FEE-00x's Invoice/FeeAssignment model is the actual root — this is a future consolidation point, not a rename to do now.
- **Financial Engine** — the eventual sole owner of Invoice, Credit Note, Payment, Payment Allocation, Refund, Receipt, Journal, Ledger, Clearing Accounts, Financial Reconciliation. Golden rule: *any module may request a charge; only the Financial Engine creates financial documents and accounting entries.*
- **Payment Platform** — payment *technology* only (Payment Intent, Payment Attempt, gateway/POS SDKs, webhooks, signature validation, retry, provider failover). Never decides accounting; only executes.

## Architectural Invariants

These sit **above** the roadmap in the governance hierarchy, not inside it. The roadmap (below) is revisable on evidence; these are not — changing one of these is not a routine roadmap revision, it is a decision to change what SchoolOS's finance architecture fundamentally *is*, and needs the same order of scrutiny as making the original call. ("Never changes" here means "changing this requires reopening the architecture itself, not editing a phase" — not literally immune to ever being revisited if the business itself fundamentally changes; that honesty matters more than a claim of permanence this document can't actually enforce.)

1. **Only the Financial Engine creates financial documents and accounting entries.** Any other module may *request* a charge; none may construct an Invoice, Payment, Receipt, Refund, or Ledger entry directly. (Compatible with ADR-FEE-003's IMM-001/IMM-002 — a charge request is a pre-fact, correction-eligible draft; only the Financial Engine's write is the occurred fact.)
2. **Modules never own invoice/payment/accounting logic.** Admissions, Transport, Hostel, Library, Events, and any future vertical describe *what* they're charging for; they never implement *how* a charge becomes a financial document.
3. **A projection (Student Due, Student Financial Account, any "how much does X owe" view) is never the source of truth.** It is always computed from source records; nothing mutates it directly.
4. **Payment technology never owns accounting.** The Payment Platform (or today's equivalent) executes payment mechanics; it does not decide what a payment *means* financially — that is the Financial Engine's decision alone.
5. **Posted/occurred financial documents are immutable.** Corrections happen through new opposing records (credit note / refund / reversal), never edits to a posted document. This is already ADR-FEE-003's IMM-001/IMM-007, restated here because it is foundational to everything else in this architecture, not just to that ADR.

Two boundary notes worth keeping close to these, since they follow directly from them: modules request charges by a catalog code + payer + quantity, not by constructing ad hoc amount/tax payloads (keeps accounting policy centralized even before a real Billable Item Catalog exists — a consequence of Invariant 1); payment *execution* is conceptually separate from payment *accounting* even before the code has two separate objects for it (a consequence of Invariant 4).

## Not Being Pulled Into an ADR Yet (sequencing, not rejection)

Explicit, per the discussion that produced this document — these are part of the destination, not excluded from it; they are simply not the next step:

- Double-entry / Journal / Dr-Cr postings — ADR-FEE-004/005 discussion already decided single-entry is sufficient for the current step, schema kept migration-friendly so this remains reachable later without a rewrite. This vision's Journal/Ledger/Clearing-Account language describes where that road leads, not a change to the current decision.
- Gateway Clearing Accounts, T+2 settlement modeling, chargebacks — sequenced after double-entry exists.
- POS integrations (Pine Labs, HDFC, ICICI, Worldline), Retail/Canteen/Bookstore/Uniform-shop billing, Wallets/BNPL/subscription billing — directionally part of "any billable event routes through one engine," but **whether and when** these specific verticals become real product requirements still needs explicit business confirmation before a real ADR starts on them — the same kind of confirmation ADR-FEE-002 required for the `SCHOOL_ADMIN` branch-scope question. This roadmap records the shape they'd take *if* confirmed; it does not supply that confirmation.
- A full payment-orchestration platform ahead of finishing the current fee module's own implementation ADRs.

## Reference Concepts (for when their time comes)

Recorded here so a future ADR doesn't have to rediscover the reasoning, not as designs to build now:

- **Party model** (Applicant / Guardian / Student / Staff / Organization instead of just "Student") — motivated by an applicant needing to pay before becoming a student. Relevant once Admissions genuinely needs to charge someone who isn't yet a Student record.
- **PaymentIntent vs. PaymentAttempt vs. Payment** — intent (customer wants to pay) → attempt (gateway execution, many per intent, states `CREATED → PROCESSING → {CAPTURED, FAILED, ABANDONED, EXPIRED}`) → Payment (the accounting fact, created only on confirmed capture). This shape would cleanly resolve the concurrency/idempotency gaps ADR-FEE-003 §2/§8 already identified in the current `PaymentService` — worth remembering when a Payment Platform ADR is eventually written.
- **Payment Allocation** as its own aggregate (one payment → many invoices) — supports partial/advance/split payment more cleanly than the current direct payment↔invoice link.
- **Cash bypasses the async Payment Platform entirely** (no webhook confirmation needed) — already effectively true in today's `recordOffline` path; worth keeping true structurally if a Payment Platform is ever built.
- Outbox pattern (mandatory) / inbox pattern (recommended) / idempotency (mandatory) for any future async payment-confirmation event flow.

## Reserved Future ADR Slots — Dependency Order

Not a flat list — each depends on the one(s) above it:

```
ADR-FIN-001  Financial Domain Foundation
     │        (bounded contexts, core aggregates, domain events)
     ▼
ADR-FIN-002  Financial Engine
     │        (Invoice, Allocation, Receipt, Ledger v1 — see disambiguation below)
     │
     ├──────────────┬──────────────────┐
     ▼               ▼                  ▼
ADR-FIN-003    ADR-FIN-004        ADR-FIN-006
Billable Item  Payment Platform   Projection Layer
Catalog        (Payment Intent,   (Student Due, Cashier,
(needs a       Attempt, provider  Reports — needs Financial
Financial      adapters,          Engine's records to project
Engine to      webhooks)          from; Parent Portal specifically
issue charges       │             also benefits from Payment
into)                ▼            Platform existing, once built)
                ADR-FIN-005
                Posting & Ledger v2
                (Journal, Clearing
                Accounts, Reconciliation
                — needs Payment Platform's
                confirmation events to post
                settlement/clearing entries
                against)
```

**Status of every finance ADR** (vocabulary: `Accepted` / `In Progress` / `Reserved (Not Started)` / `Superseded` — kept in one place so it doesn't have to be inferred from prose elsewhere):

| ADR | Status |
|---|---|
| ADR-FEE-001 (Financial Data Visibility) | Accepted (v1.2) |
| ADR-FEE-002 (Branch Isolation) | Accepted (v1.0) |
| ADR-FEE-003 (Financial Immutability) | In Progress (Freeze Candidate — `EXPIRED` question resolved, pending final review → v1.0) |
| ADR-FIN-001 (Financial Domain Foundation) | Reserved (Not Started) |
| ADR-FIN-002 (Financial Engine) | Reserved (Not Started) |
| ADR-FIN-003 (Billable Item Catalog) | Reserved (Not Started) |
| ADR-FIN-004 (Payment Platform) | Reserved (Not Started) |
| ADR-FIN-005 (Posting & Ledger v2) | Reserved (Not Started) |
| ADR-FIN-006 (Projection Layer) | Reserved (Not Started) |

"Reserved (Not Started)" is deliberately not "Planned" — per this document's own banner, none of the `ADR-FIN-0xx` slots are scheduled or authorized to begin by virtue of appearing here.

**Naming disambiguation (surfaced during this reconciliation, not present in the original phase list):** "Ledger" appears in both `ADR-FIN-002` and `ADR-FIN-005`, but they are different scopes:
- **Ledger v1** (`ADR-FIN-002`, Phase 1 below) — the same single-entry, append-only source-of-truth already scoped as **FEE-3** in the current fee-module implementation roadmap (from the original student-billing audit). No double-entry, no Journal. Near-term.
- **Ledger v2 / Journal** (`ADR-FIN-005`, Phase 4 below) — full double-entry Dr/Cr posting, Gateway Clearing Accounts, settlement reconciliation. Far-term — this is the accounting-engine upgrade the "Not Being Pulled Into an ADR Yet" section above already said isn't happening now.

Building Ledger v1 (FEE-3) does not commit to or require Ledger v2 — it's a smaller, self-contained step Ledger v2 can later extend rather than replace.

## Evolution Roadmap (Measurable Phases)

Phases, not release dates — each phase's exit criterion is "the listed pieces work and are verified," the same discipline `FEE-0`/`FEE-1` already established (code-grounded, not "build complete"). Cross-referenced against the current fee-module roadmap (`FEE-0`…`FEE-8`, from the original student-billing audit) so the two roadmaps don't silently diverge.

**Phase 1 (MVP)** — roughly `FEE-0`→`FEE-4`
- Financial Engine boundary established (conceptually — "only this owns invoices/payments," even before every module actually routes through it)
- Invoice, Payment, Receipt — fixed and verified (the concrete bugs already found: discount `categoryId` FK, `Receipt.invoiceId` unique-constraint breaking partial payments, `RefundService` audit-action/concurrency gaps)
- Allocation — today's direct payment↔invoice link is acceptable for Phase 1; a formal Allocation aggregate (payment → many invoices) is a Phase 1 stretch goal, not a blocker
- Projection — Student Due / Student Financial Account (`FEE-4`)
- **Ledger v1** (`FEE-3`) — single-entry, append-only, source of truth for balances

*Phase 1 exit criteria:*
- ✓ No code path outside the Financial Engine boundary writes an Invoice, Payment, Discount, Refund, or LateFee record directly (Invariant 1, checkable by review/lint, not just self-report)
- ✓ Discount creation succeeds end-to-end (the `categoryId` FK bug is fixed) and an approved discount correctly reduces the resulting invoice's total
- ✓ A second partial payment against an invoice produces its **own** receipt — not a copy of the first payment's receipt (the `Receipt.invoiceId`-unique bug is fixed)
- ✓ `RefundService`'s audit call uses a valid `AuditAction` value and every refund produces a real audit-log row
- ✓ Two concurrent refund requests against the same payment: at most one succeeds if together they'd exceed the refundable amount (IMM-014/015 from ADR-FEE-003)
- ✓ Student Due / Student Financial Account is read-only from the caller's perspective — no endpoint mutates it directly, only the source records it's computed from
- ✓ For a sample of students, summing Ledger v1 entries from scratch matches the Student Financial Account's reported balance (a from-scratch reconciliation check, not just "the code ran without error")

**Phase 2** — roughly `FEE-2` continuing
- Payment Platform *formalized* as a boundary (Razorpay integration already exists — this phase separates its concerns cleanly, not builds it from scratch)
- Parent Portal payment flow
- Webhooks — a confirmed gap from the original audit (no server-to-server payment-gateway webhook exists today; the flow is entirely client-confirmation-driven)

*Phase 2 exit criteria:*
- ✓ A payment-gateway webhook endpoint exists, its signature is verified (no silent-skip-on-missing-config, per the specific gap identified in the original audit), and it is reachable independent of any client-side confirmation call
- ✓ A payment whose client-side confirmation never arrives (simulated: close the browser mid-flow) still reaches a correct terminal state via the webhook, within a defined SLA
- ✓ No frontend code path can create a Payment record directly — only a confirmed gateway event or a staff-recorded offline payment can

**Phase 3** — roughly `FEE-2`/`FEE-5`
- Payment Attempt as a distinct concept from Payment (resolves the concurrency/idempotency gaps already identified)
- Refund — wired up, with its audit-action bug and concurrency gap fixed
- Idempotency — close remaining gaps beyond the already-compliant offline-payment path
- Reconciliation — technical (webhook/gateway-status) reconciliation; not yet the accounting/settlement kind (that's Phase 4)

*Phase 3 exit criteria:*
- ✓ Every retryable financial mutation endpoint (refund, discount, late-fee application — not just offline payment) has an identified idempotency key and replaying it produces the same result, never a duplicate record (IMM-017/018)
- ✓ A technical-reconciliation report exists and, run against a test window with deliberately induced gateway/webhook failures, surfaces zero unresolved mismatches after retry
- ✓ Multiple `PaymentAttempt`s against one logical payment intent never produce more than one accounting-level `Payment` record

**Phase 4** — new territory, not in the original `FEE-0`…`FEE-8` roadmap
- Double Entry
- Journal
- **Ledger v2** (see disambiguation above — distinct from Phase 1's Ledger v1)
- Gateway Clearing Accounts, settlement/chargeback reconciliation

*Phase 4 exit criteria:*
- ✓ Every posted financial document has a balanced (debits = credits) journal entry — checkable as an invariant over the whole Journal table, not just per-transaction
- ✓ Gateway settlement reports reconcile against Gateway Clearing Account balances within a defined tolerance, for a full settlement cycle (e.g. T+2)
- ✓ A chargeback is recorded as a new reversing entry against the original transaction, never as an edit to it (Invariant 5 extended to the double-entry structure)

**Phase 5** — contingent on business confirmation (per the "Not Being Pulled Into an ADR Yet" section above)
- POS, Retail, Wallets, Subscription Billing

*Phase 5 exit criteria:* deliberately not defined here — defining exit criteria for unconfirmed scope would imply the scope itself is already decided, which it is not (per the "Not Being Pulled Into an ADR Yet" section). Exit criteria get written once business confirms which Phase 5 vertical is actually being built.

## A Concrete Connection Back to ADR-FEE-003 (Resolved)

This section originally flagged that this roadmap's target Invoice lifecycle (no stored `EXPIRED` state, "overdue" computed instead) was one possible answer to ADR-FEE-003's then-open question about `EXPIRED` semantics. That question has since been resolved directly in ADR-FEE-003 — not by inheriting this roadmap's direction, but by checking the actual codebase first: `InvoiceStatus.EXPIRED` was never set or read by any code path anywhere in `student-billing`, confirmed by direct repo-wide search. There was no accounting policy to decide; it was dead code, removed as a direct implementation change (schema migration) rather than an ADR-level decision, per the principle that ADRs govern architectural choices, not the deletion of states nobody used. The outcome happens to match this roadmap's direction, but the reasoning that got there was code-verification, not roadmap-inheritance — worth keeping that distinction on record so a future reader doesn't conclude the roadmap can be cited as settling open ADR questions on its own authority.

## Glossary

Terms that recur across this document and the finance ADRs, listed once here to prevent drift between casual and precise usage as the document ages.

| Term | Meaning |
|---|---|
| **Financial Engine** | The single owner of financial documents (Invoice, Payment, Receipt, Refund, Ledger). Other modules request charges; only this creates accounting records. |
| **Payment Platform** | Executes payment technology (gateways, POS, webhooks, retries). Never decides accounting meaning — that's the Financial Engine's job. |
| **Ledger v1** | The single-entry, append-only source of truth for balances — `FEE-3` in the current fee-module roadmap, `ADR-FIN-002` in the target architecture. No double-entry. |
| **Ledger v2 / Journal** | The full double-entry Dr/Cr posting system, `ADR-FIN-005`, Phase 4. Extends Ledger v1; does not replace it. |
| **Projection** | A read model computed from source records (e.g. Student Due / Student Financial Account). Never itself mutated directly, never a source of truth. |
| **Source of Truth** | The record(s) a projection is computed from — for finance, ultimately the Ledger (v1 today, v1+v2 once Phase 4 lands), and today's Invoice/Payment/Discount/Refund/LateFee entities directly per ADR-FEE-003 §3 until the Ledger fully subsumes them. |
| **Charge Request** | A module's ask ("bill this payer for this item") — a pre-fact draft, correctable, not yet a financial document. Becomes an Invoice (or equivalent) only once the Financial Engine acts on it. |
| **Payment** | The accounting fact that money was received — created only after a confirmed capture event, never directly by a client or a gateway callback without going through the Financial Engine. |
| **Payment Attempt** | One gateway execution try. Many attempts may exist per logical payment; at most one `Payment` (accounting fact) results. |
| **Payment Intent** | The customer-facing "I want to pay" object, owned by the Payment Platform, distinct from both Attempt (technical execution) and Payment (accounting fact). |
| **Billable Item Catalog** | The centralized set of charge types (e.g. `FEE.TUITION`, `ADM.APPLICATION_FEE`) modules reference by code rather than constructing ad hoc amount/tax payloads. |
| **Reversal** | A new, opposing financial record that offsets an occurred fact (refund, credit note, reversed late fee) — never an edit to the original, per ADR-FEE-003 IMM-007. |
| **Correction** | An edit to a record that has *not yet* become a financial fact (e.g. a `DRAFT` invoice) — only available pre-fact, per ADR-FEE-003 IMM-006. |

## Architecture Decision Index

One table to find where any given topic is actually decided — the ADR (or roadmap section) that governs it, and where it sits in the phased roadmap. Meant to stay useful once this document is a year old and the topic-to-ADR mapping isn't fresh in anyone's memory.

| Topic | Governing ADR / Section | Roadmap Phase / Invariant |
|---|---|---|
| Financial data visibility (who sees what) | ADR-FEE-001 | — (foundation, all phases) |
| Branch isolation | ADR-FEE-002 | — (foundation, all phases) |
| Invoice/Payment/Refund immutability, corrections vs. reversals | ADR-FEE-003 | Invariant 5 |
| Invoice `EXPIRED` semantics | ADR-FEE-003 (resolved — removed as dead code) | — |
| Concurrency / idempotency for financial mutations | ADR-FEE-003 §8–9 | Phase 1 & 3 exit criteria |
| Financial Engine as sole document-creator | ADR-FIN-002 (reserved) | Invariant 1, Phase 1 |
| Ledger v1 (single-entry, source of truth) | `FEE-3` / ADR-FIN-002 (reserved) | Phase 1 |
| Billable Item Catalog | ADR-FIN-003 (reserved) | Phase 1–2 boundary concept |
| Payment Platform, Payment Intent/Attempt | ADR-FIN-004 (reserved) | Phase 2–3 |
| Webhooks / gateway confirmation | ADR-FIN-004 (reserved) | Phase 2 exit criteria |
| Double-entry, Journal, Ledger v2, Gateway Clearing | ADR-FIN-005 (reserved) | Phase 4 |
| Student Due / Student Financial Account projection | `FEE-4` / ADR-FIN-006 (reserved) | Invariant 3, Phase 1 |
| POS, Retail, Wallets, Subscription Billing | Not yet an ADR — needs business confirmation first | Phase 5 |

---

*Status: architectural roadmap, directional commitment, revisable on evidence (see banner). No RFC-2119 normative weight of its own — governs by informing ADR-FEE-0xx/ADR-FIN-0xx sequencing, not by being directly implemented.*
