# Finance Architecture Delta v1.1

**Status:** Addendum — pending review
**Baseline:** the finance architecture package as of `f57cdca` (ADR-FEE-001 v1.2, ADR-FEE-002 v1.0, ADR-FEE-003 Freeze Candidate, Roadmap, `IMPLEMENTATION_BACKLOG.md`)
**This is not an ADR.** It creates no new normative rule on its own authority. Every decision below either (a) needs folding into a named ADR before it becomes binding, or (b) is a clarification of existing ADR text.

---

## Purpose

The baseline package was generated before the FEE-0/FEE-1 implementation sessions and before the finance design discussion that followed them. That discussion produced a small number of decisions that are genuinely absent from the package, and surfaced four places where a decision taken in discussion **contradicts** the package.

This document exists to record the delta and nothing else. Per `IMPLEMENTATION_RULES.md` §12, a change that creates a contradiction elsewhere in the package must be reconciled in the same pass — §Conflicts below is that reconciliation, raised rather than silently resolved.

**Most of what the discussion produced is already covered.** Recorded here so nobody re-derives it:

| Discussion output | Already covered in |
|---|---|
| Payment Allocation as an entity | `ADR_INDEX.md` — `ADR-FIN-002` (Financial Engine: "Invoice, Allocation, Receipt, Ledger v1"), Reserved |
| Receipt 1:1 with Payment | `IMPLEMENTATION_HANDOFF.md` §10; `IMPLEMENTATION_BACKLOG.md` FEE-1 item 2 |
| Invoice immutability; corrections pre-fact, reversals post-fact | `ADR-FEE-003` §3 (`IMM-001`, `IMM-006`, `IMM-007`) |
| Credit Note as the correction instrument | `ARCHITECTURE_STATE.md` §Financial Engine (future ownership); `ADR-FEE-003`'s reversal model |
| Numbering consolidated onto `InvoiceSequence`/`ReceiptSequence`, keyed `(tenantId, branchId)` | `IMPLEMENTATION_BACKLOG.md` FEE-2 item 6 |
| Opening balance / carry-forward / write-off / adjustments | `IMPLEMENTATION_BACKLOG.md` FEE-5 |
| Instalments; `FeeHead`/`FeeCategory` catalog | `IMPLEMENTATION_BACKLOG.md` FEE-6 |
| Ageing report; branch + date-range analytics | `IMPLEMENTATION_BACKLOG.md` FEE-8 |
| `RefundService` controller; late-fee apply/waive/reverse/list endpoints | `IMPLEMENTATION_BACKLOG.md` FEE-2 items 1–2 |
| Late-fee cron tenant scoping | `ADR-FEE-002` (`AUTH-056`/`AUTH-057`); FEE-2 item 9; FEE-7 item 4 |
| Gateway webhook; bank reconciliation; cashier/cashbook | `IMPLEMENTATION_BACKLOG.md` FEE-7 |
| Parent-safe Student Financial Account projection | `ADR-FEE-001` §8 (`AUTH-021`); FEE-4 |
| Period freeze on closed sessions/FY | `ADR-FEE-003` §7; mechanism deferred to `ADR-FEE-005` |
| Money as `Decimal(12,2)` | `IMPLEMENTATION_HANDOFF.md` §8 (see D-9 for the service-layer gap) |
| Payment Intent / Attempt separation | `ARCHITECTURE_STATE.md` §Payment Flow; `ADR-FIN-004`, Reserved |

---

## New Architectural Decisions

Decision IDs are provisional (`D-n`). Per `IMPLEMENTATION_RULES.md` §9, real `AUTH-`/`IMM-` IDs MUST be assigned only when these are folded into a named ADR, taking the next unused ID in the relevant series.

---

### D-1 — Guardian is the financial payer of record

**Decision.** `Payment` MUST carry a nullable `payerId` referencing `Guardian`. Money is received *from a payer* and allocated *to students*. `payerId` is nullable because counter cash is sometimes tendered by a relative, driver or employer who is not a registered guardian; where null, a free-text payer name MUST be captured instead.

**Rationale.** ADR-FEE-001 models the guardian relationship as an **authorization** dimension (who may *see* a student's financial data, `AUTH-003`, resolved per request from `Guardian`/`GuardianStudent`). It does not model the guardian as a **financial actor**. Two consequences follow that the package cannot currently satisfy:

1. §269ST of the Income-tax Act limits cash received to ₹2,00,000 **per person per day**, with penalty under §271DA equal to the amount received. Without a payer identity on `Payment`, that aggregation has no subject and the control is unimplementable.
2. Sibling payments (one parent, one counter transaction, several children) have no coherent representation.

**Extends.** `ADR-FEE-001` §4 (ownership dimension) — extends it from a read-authorization concept to a financial-actor concept. Interacts with `ADR-FIN-002` (Allocation).

**Implementation impact.** One nullable FK plus an index on `Payment`. `AdvanceBalance`, when built, remains **student-level**, with family-level *visibility* only; moving credit between siblings MUST be an explicit, audited action, not an implicit consequence of shared payer identity.

**Breaking change?** No. Additive and nullable.

---

### D-2 — Receipt and invoice numbering is financial-year based

**Decision.** Invoice and receipt series MUST be scoped to `(tenantId, branchId, financialYear)` where financial year runs 1 April – 31 March, and MUST be gap-free. A cancelled or voided document MUST retain its number in the series. Numbers MUST NOT be derived from `count(*)`.

**Rationale.** FEE-2 item 6 correctly requires consolidating onto the existing `InvoiceSequence`/`ReceiptSequence` tables keyed on `(tenantId, branchId)` — but is silent on the *year* dimension, and both sequence tables already carry a `year Int` column with no stated semantics. Current code derives the year from `new Date().getFullYear()` (calendar year). A receipt issued in February 2027 therefore lands in a different series from one issued the previous October, splitting every financial year's receipt register across two series. An auditor requesting "the receipt register for FY 2026-27" cannot be given a contiguous answer. This is an audit-facing defect, not a preference.

**Extends.** `IMPLEMENTATION_BACKLOG.md` FEE-2 item 6 (adds the year dimension and the gap-free requirement).

**Implementation impact.** `ReceiptSequence.year`/`InvoiceSequence.year` are interpreted as financial-year start (e.g. `2026` = FY 2026-27). Removes the tenant-wide advisory lock and the `count(*)` inside it — this is also the module's principal write-throughput bottleneck.

**Breaking change?** Yes, for numbering. Existing documents MUST retain their issued numbers; the new series begins at the changeover with the transition recorded.

---

### D-3 — Allocation status and refund status are derived, never stored

**Decision.** How much of a payment has been allocated MUST be computed from `PaymentAllocation` rows. Whether a payment is refunded or partially refunded MUST be computed from its `Refund` rows. Neither MUST be persisted as a status field.

**Rationale.** `Invoice.paidAmount`/`dueAmount` are already denormalised running totals written by five independent code paths, and drift between them and the underlying rows is the module's most likely silent-corruption mode. `PaymentStatus.REFUNDED`/`PARTIALLY_REFUNDED` are currently *set* independently of the refund rows, which is the mechanism behind the live refund defect where fully refunding one payment zeroes `Invoice.paidAmount` and re-bills money the school still holds. Adding stored allocation state would replicate that failure on a new axis.

**Extends.** `ADR-FEE-003` §3 (immutability of occurred facts) and Architectural Invariant 3 (a projection is never the source of truth) — applies both to a payment's own derived state.

**Implementation impact.** `PaymentStatus` narrows to money state (D-4). Unallocated remainder becomes `AdvanceBalance` rather than a status.

**Breaking change?** Yes for `PaymentStatus` semantics. Requires a data migration for existing `REFUNDED`/`PARTIALLY_REFUNDED` rows.

---

### D-4 — `PaymentStatus` means money state only

**Decision.** `PaymentStatus` MUST describe only whether the money has arrived: `PENDING → COMPLETED | FAILED | REVERSED`. Where tenders exist (D-5), a payment is `COMPLETED` only when every tender has cleared.

**Rationale.** Conflating money state, allocation state and refund state into one enum is what makes the three mutually corrupting. It also silently redefines `SUCCESS`: for a cheque, "accepted at the counter" and "cleared" are different facts with different accounting effect, and only the second is money.

**Extends.** `ADR-FEE-003` §4 (Payment state-transition graph) — narrows it; the graph itself MUST be revised in that ADR, not here.

**Implementation impact.** Any report reading `PaymentStatus = SUCCESS` as "collected" changes meaning once cheque lifecycle exists.

**Breaking change?** Yes. Requires an ADR-FEE-003 revision.

---

### D-5 — Instrument lifecycle belongs to `PaymentTender`

**Decision.** A `PaymentTender` entity MUST exist, owning mode, amount, instrument reference and clearance state (`RECEIVED → DEPOSITED → CLEARED | BOUNCED`). Collections MUST be recognised only on `CLEARED`. Tender data MUST NOT be stored as a JSON blob on `Payment`.

**Rationale.** Recognising a cheque as collected on receipt date overstates collections — materially, during peak season — and guarantees the collection figure will not reconcile to bank. The clearance state has to live somewhere; if not on a tender, it lands on `Payment` and must later be migrated off it while uncleared instruments are in flight. JSON is rejected because mode-wise collection and cash-tally reporting are daily operational requirements (D-8) and cannot be served from an unindexable blob.

Multi-tender (cash + UPI in one transaction) is a *consequence* of this entity, not its justification.

**Extends.** `IMPLEMENTATION_BACKLOG.md` FEE-7 (bank reconciliation) — supplies the instrument model that reconciliation reads. Distinct from `ADR-FIN-004` (Payment Platform), which concerns gateway intent/attempt, not physical instruments.

**Implementation impact.** New entity. The deposit/clearance *workflow* (bulk deposit slips, bounce handling, bank-charge recovery) MAY follow later; the entity and its states SHOULD land with allocation.

**Breaking change?** No, if introduced alongside the allocation work. Yes, if deferred past first production use.

---

### D-6 — Per-student due-date override (`StudentFeeSchedule`)

**Decision.** A per-student, per-term schedule row MUST be able to override the structure's due date, carrying `originalDueDate`, `overrideDueDate`, `reason`, `approvedBy`, `approvedAt`. `originalDueDate` MUST be preserved, never overwritten. Late-fee assessment MUST evaluate against the effective (overridden) date.

**Rationale.** Instalment rescheduling on parent request is routine and school-granted. FEE-6 item 1 introduces an `Installment` model but places the due date only on the schedule/structure. If that is the sole source of truth, rescheduling has nowhere to live and would be retrofitted into the late-fee engine — the worst place for it. Preserving the original date is required so that late-fee reversal and appeals (D-7) can reference what was originally due, and so reporting can distinguish "rescheduled" from "always was".

**Extends.** `IMPLEMENTATION_BACKLOG.md` FEE-6 item 1.

**Implementation impact.** Late-fee assessment resolves the effective due date rather than reading the structure directly.

**Breaking change?** No, if decided before FEE-6 is built. Yes, afterwards.

---

### D-7 — Waiver and reversal are distinct outcomes

**Decision.** A late fee that was correctly assessed and is being forgiven MUST be recorded as a **waiver** (`WAIVED`). A late fee that should never have been assessed — upheld appeal, payment recorded late, cheque in transit, due date falling on a holiday — MUST be recorded as a **reversal** (`REVERSED`). Waiver MUST NOT be used as a substitute for reversal.

**Rationale.** `LateFeeStatus.REVERSED` and `reversedAt`/`reversedById` already exist in the schema and are written by nothing. Recording upheld appeals as waivers inflates the concession register with entries that are not concessions — the register is an audit- and, in several states, regulator-facing artifact, and materially misstating it is a compliance exposure rather than a cosmetic issue. The distinction is also exactly ADR-FEE-003's own correction-vs-reversal model applied to late fees.

**Extends.** `ADR-FEE-003` §3 (`IMM-006`/`IMM-007`) — applies the existing rule to a concrete entity. FEE-2 item 2 already lists `reverse` among the required late-fee endpoints; this fixes its *semantics*.

**Implementation impact.** Reversal MUST also reverse the fee's effect on outstanding.

**Breaking change?** No.

---

### D-8 — Statutory and operational controls absent from the package

**Decision.** The following MUST be treated as production gates and MUST be assigned to a named Epic:

- **§269ST cash control** — warn or block at ₹2,00,000 aggregated per payer per day (depends on D-1).
- **RTE/EWS student category** — such students MUST be excluded from invoice generation, late-fee assessment and defaulter lists, and a fees-foregone report MUST exist for state reimbursement claims under §12(1)(c) of the RTE Act. RTE MUST NOT be modelled as a 100% discount; that produces dunning against RTE families.
- **GST posture** — K-12 fees charged by a school to its own students are generally exempt (Notification 12/2017-CT(R), entry 66). The schema currently carries `gstRate`/`gstCode`/`gstAmount` with an 18% case exercised in tests, but has no GSTIN, place of supply, HSN/SAC or tax-invoice format. The module MUST either default to exempt and suppress GST on the K-12 path, or complete tax-invoice compliance. The current half-state MUST NOT ship.
- **Daily collection register and cash tally** — day-close artifacts; a school cannot operate a counter without them.

**Rationale.** None of these appear anywhere in the baseline package. The first three are statutory; the fourth is a daily operational necessity. State fee regulation varies — the specific treatments above SHOULD be confirmed with the schools' chartered accountant before implementation.

**Extends.** Nothing — genuinely new scope. Closest homes: FEE-7 (cashbook, already flagged as needing product confirmation), FEE-8 (reports).

**Implementation impact.** RTE affects invoice generation and late-fee assessment, both of which are FEE-2/FEE-6 code paths.

**Breaking change?** No, but the GST decision may retire schema fields.

---

### D-9 — `Decimal` discipline extends to the service layer

**Decision.** Monetary values MUST NOT be converted to JavaScript `number` for arithmetic. Calculation MUST use a decimal type end-to-end, with rounding applied explicitly and consistently at defined points.

**Rationale.** `IMPLEMENTATION_HANDOFF.md` §8 records the `Decimal(12,2)` convention as "already correctly followed everywhere." That is true of the **schema** and false of the **service layer**: money is routinely read via `Number(...)`, arithmetic performed in binary floating point, and written back. Percentage-based late fees and discounts are precisely where this produces values like `100.00000000000001`, and rounding is applied inconsistently across paths. At scale this yields a steady drip of paise-level discrepancies that accountants can find and cannot explain — corrosive to trust in a finance module even though no single error is large.

**Extends.** `IMPLEMENTATION_HANDOFF.md` §8 — corrects the scope of an existing convention.

**Implementation impact.** Touches every money calculation in `student-billing`.

**Breaking change?** No. Corrective.

---

## Clarifications

**C-1 — `FeeHead` hierarchy depth.** FEE-6 item 2 specifies a `FeeHead`/`FeeCategory` catalog without stating its shape. Clarification: build **`FeeHead` only**, with an optional parent, and a **maximum depth of 2** (group → head) enforced in code. Two entities (`FeeHead` *and* `FeeCategory`) would duplicate one concept; arbitrary depth turns every collection report into a recursive CTE and makes rollups ambiguous when a charge is posted to an intermediate node.

**C-2 — Charge types are fee heads, not entities.** Transport, hostel, mess, library fines, uniform and books MUST be modelled as `FeeHead` values, never as separate charge entities. Separate entities would fragment the ledger and duplicate the invoice pipeline per charge type. This is the mechanism by which FEE-6 makes those verticals configuration rather than code.

**C-3 — Fee structure versioning is not invoice versioning.** `ADR-FEE-003` establishes that issued invoices are immutable; that stands, and invoice *versioning* MUST NOT be introduced (immutability plus credit notes is simpler and more auditable). Separately, a fee structure MUST be versioned, and an issued invoice MUST reference the structure version it was billed under, so that a mid-year revision approved by a fee committee is answerable without archaeology. These are different concepts and are frequently conflated.

**C-4 — Allocation rule is recorded per allocation.** When allocation is built, each `PaymentAllocation` MUST record which rule produced it (default oldest-due-first, configurable, manual override permitted and audited). A receipt has to explain at the counter what a parent's money settled.

**C-5 — Credit note terminology.** The entity and the parent-facing/auditor-facing document SHOULD both read *Credit Note*; staff-facing UI MAY use "Fee Adjustment" or "Correction". Internal vocabulary and document vocabulary need not match, and the auditor-facing term should not be softened.

---

## Conflicts Requiring Resolution

Raised, not resolved. Each MUST be decided before the affected Epic starts. `IMPLEMENTATION_RULES.md` §2 requires an ADR revision rather than a quiet deviation.

**X-1 — Derived ledger vs `FEE-3` Ledger v1.** A direction was taken in discussion that the student ledger be **derived** from existing entities with **no new tables**, plus frozen year-close snapshots. `IMPLEMENTATION_BACKLOG.md` FEE-3 specifies the opposite: a **persisted, append-only `Ledger` model**, every mutation writing an entry in the same transaction, with a backfill of existing history. FEE-5 then requires opening balance to be "a specific Ledger entry type, **not a second parallel mechanism**." An `OpeningBalanceSnapshot` entity as discussed would be exactly that second mechanism.

These cannot both hold. FEE-3/FEE-5 is the authoritative backlog; the derived approach is not recorded in any package document. **Recommendation: keep FEE-3 as written.** A persisted append-only ledger is the stronger position for historical correctness and audit, and FEE-4/FEE-5/FEE-8 all already depend on it. If the derived approach is preferred instead, FEE-3, FEE-4, FEE-5 and FEE-8's dependency chain all require rewriting, which is an ADR-level change.

**X-2 — Payment Allocation sequencing.** Discussion concluded that `PaymentAllocation` MUST exist before first production release, on the grounds that the cost of deferring is not migration difficulty but **unrecoverable data quality**: without it, a parent settling two invoices in one counter transaction is recorded as two payments and handed two receipts, and that history cannot be reconstructed later. Advance payments have the same shape and force fabricated invoices.

However, Allocation sits inside `ADR-FIN-002` (Financial Engine), status `Reserved (Not Started)`, and `IMPLEMENTATION_RULES.md` §3 states plainly that no `ADR-FIN-0xx` work is authorized and only `FEE-N` Epics are near-term. Elevating Allocation into the pre-production set is therefore a **roadmap re-sequencing decision requiring ADR-level authorization** — either by promoting a scoped subset of `ADR-FIN-002` or by adding it to a `FEE-N` Epic. It cannot be authorized by this addendum.

**X-3 — `ADR-FEE-002` Deferred Decision 1 was consumed by implementation.** FEE-8 item 3 assigns `AUTH-055`'s per-branch analytics question — *current-branch-context vs. full-authorized-set aggregate* — to be resolved as part of that Epic. The analytics branch-scoping already implemented (commit `b56567e`) chose **full-authorized-set** without that decision being formally taken. The behaviour is defensible and consistent with every other read path in the module, but the deferred decision SHOULD now be formally closed in `ADR-FEE-002` with the chosen answer recorded, rather than left open against shipped code.

**X-4 — Late-fee endpoint surface is incomplete against FEE-2.** FEE-2 item 2 requires `apply`, `waive`, `reverse` and `list` endpoints, and notes the frontend already calls `/billing/late-fees*` and currently 404s. Only `waive` exists (commit `70f3bc8`). The remaining three MUST be completed before FEE-2 can be considered met; `reverse` additionally depends on D-7's semantics.

---

## Decisions Explicitly Deferred

| Deferred | Why | Revisit trigger |
|---|---|---|
| `OpeningBalanceSnapshot` as an entity | Subsumed by X-1. If FEE-3 stands, opening balance is a Ledger entry type per FEE-5 and this entity MUST NOT be created. | Resolution of X-1 |
| Tender deposit/clearance **workflow** (bulk deposit slips, bounce handling, bank-charge recovery) | The entity and states (D-5) are the freeze-critical part; the workflow is operational tooling that can follow without schema churn. | First school banking cheques at volume |
| Multi-tender counter UX (one receipt spanning cash + UPI) | A convenience, not a data-integrity requirement, once D-5 exists. | Counter feedback |
| Write-off, TC pro-rata settlement, mid-year fee revision | Already scoped to FEE-5 / future work; no new decision needed here. | FEE-5 |
| Dunning, reminders, demand notices | Notification scope, explicitly out of the current milestone. A demand note is an invoice print template plus a reminder job — it MUST NOT become a second entity representing the same obligation. | Notifications milestone |
| Multi-currency | No requirement. `Currency` enum already defaults `INR`. | A non-INR school |
| Ledger v2 / double-entry / Journal | `ADR-FIN-005`, Phase 4, explicitly sequenced after Ledger v1. `IMPLEMENTATION_HANDOFF.md` §10 forbids starting it early. The fee module is a *subsidiary* ledger; schools keep statutory books in Tally, so a summary export SHOULD be preferred over a general ledger. | `ADR-FIN-005` |
| Interest on arrears | Rarely charged by Indian schools; poorly received by several state regulators. | Explicit product demand |
| Legal recovery / `RecoveryCase` | Handled outside the ERP in practice. | Explicit product demand |

---

## Modules Impacted

| Decision | Billing | Fee Engine | Payment Engine | Receipt Engine | Student Billing | Reporting |
|---|---|---|---|---|---|---|
| D-1 Guardian as payer | | | ● | ● | ● | ● |
| D-2 FY numbering | ● | | | ● | ● | ● |
| D-3 Derived statuses | | | ● | | ● | ● |
| D-4 PaymentStatus narrowed | | | ● | | ● | ● |
| D-5 PaymentTender | | | ● | ● | ● | ● |
| D-6 StudentFeeSchedule | ● | ● | | | ● | ● |
| D-7 Waiver vs reversal | | ● | | | ● | ● |
| D-8 Statutory controls | ● | ● | ● | ● | ● | ● |
| D-9 Decimal in services | ● | ● | ● | ● | ● | ● |
| C-1/C-2 FeeHead | ● | ● | | | ● | ● |
| C-3 Structure versioning | ● | ● | | | ● | ● |
| C-4 Allocation rule | | | ● | ● | ● | ● |

---

## Recommended Sequencing

Subject to X-1 and X-2 being resolved first. Ordered by "cost of doing it later", not by size.

1. **D-9** (Decimal) and the refund defect in `RefundService` Phase 3 — correctness, small, unblocks trust in every downstream number.
2. **D-2** (FY/branch gap-free numbering, FEE-2 item 6) — removes the top audit finding and the write-throughput bottleneck together.
3. **X-2 resolution**, then Allocation + **D-1** + **C-4** if authorized — the load-bearing decision; everything downstream assumes it.
4. **D-5** (PaymentTender) alongside 3.
5. **D-3/D-4** (status semantics) — must land with 3–4, not after.
6. **D-6**, **C-1**, **C-2**, **C-3** with FEE-6.
7. **D-7** and **X-4** to complete FEE-2.
8. **D-8** statutory controls.
9. **X-3** — close the deferred decision in ADR-FEE-002.

---

## References

- `ADR-FEE-001-Financial-Data-Visibility-v1.2.md` — authorization model; `AUTH-003`, `AUTH-021`, §4, §7, §8
- `ADR-FEE-002-Branch-Isolation-v1.0.md` — branch scoping; `AUTH-050`–`AUTH-058`, Deferred Decision 1
- `ADR-FEE-003-Financial-Immutability-FREEZE-CANDIDATE.md` — `IMM-001`–`IMM-023`, §3, §4, §7
- `ADR_INDEX.md` — ADR status; `ADR-FIN-002`/`004`/`005` reserved scope
- `ARCHITECTURE_STATE.md` — bounded contexts, Financial Engine, Ledger v1/v2 disambiguation, payment flow
- `IMPLEMENTATION_BACKLOG.md` — Epics FEE-0…FEE-8
- `IMPLEMENTATION_HANDOFF.md` — §8 conventions, §10 must-never-change list
- `IMPLEMENTATION_RULES.md` — §2 (no quiet deviation), §3 (no `ADR-FIN-0xx` work), §9 (append-only IDs), §12 (consistency)
- `SchoolOS-Target-Financial-Architecture-ROADMAP.md` — Architectural Invariants 1–5, Phases 1–5
- `student-billing-audit.md` — original findings
- `docs/SESSION-HANDOFF-FEE-0-FEE-1.md` — FEE-0/FEE-1 implementation record, including the CAS-instead-of-`version`-column deviation from FEE-1 item 4

**Statutory references** (confirm with the schools' chartered accountant; state fee regulation varies): Income-tax Act §269ST, §271DA; RTE Act §12(1)(c); CGST Notification 12/2017-CT(R) entry 66.
