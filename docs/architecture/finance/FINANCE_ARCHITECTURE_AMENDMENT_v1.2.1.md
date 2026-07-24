# Finance Architecture Amendment v1.2.1

**Status:** Accepted — final amendment before implementation
**Amends:** `FINANCE_ARCHITECTURE_DELTA_v1.2.md` (Accepted)
**Nature:** Patch document. Applies to v1.2; does not replace it. v1.2 remains the base text and MUST be read together with this amendment.
**Baseline unchanged:** ADR-FEE-001 v1.2, ADR-FEE-002 v1.0, ADR-FEE-003 Freeze Candidate, Roadmap, `IMPLEMENTATION_BACKLOG.md`

---

## A. Purpose and scope of this amendment

Refundable student deposits — library, hostel caution, lab, transport security and institution-specific equivalents — were validated against the frozen v1.2 model. The workflow fits the frozen architecture with one structural change: the generalisation of the allocation source.

This amendment introduces no new bounded context and no new aggregate root. It reopens no frozen decision. `StudentDeposit` is an entity within the already-frozen `StudentAccount` aggregate (v1.2 §2.4); `DepositPolicy` is a configuration entity. All other content clarifies the application of existing frozen decisions — principally `C-1`, `C-2`, `C-8`, `C-9`, `C-10` and `D-3` — to this workflow.

New identifiers continue the provisional series established in v1.2: clarifications `C-11`…`C-15`, refinement `R-10`, invariants 16–19. Per `IMPLEMENTATION_RULES.md` §9, real `AUTH-`/`IMM-` identifiers MUST be assigned only when these are folded into a named ADR.

---

## B. Amendment text to insert into Finance v1.2

### B.1 Insert into §2 (Accepted Clarifications), after §2.5

---

#### 2.6 (C-11) Refundable deposits are liabilities, not revenue

A refundable student deposit **MUST** be treated as a liability of the institution from the moment it is collected. Collecting a deposit **MUST NOT** be recognised as revenue. Refunding a deposit **MUST NOT** be recognised as a reduction of revenue; it discharges a liability.

A deposit becomes revenue only on forfeiture, which **MUST** be an explicit, approved and audited action and **MUST NOT** occur automatically.

Deposits are outside the scope of the GST posture frozen in `D-8`. A deposit is not a supply.

#### 2.7 (C-12) A deposit refund is not a Payment Refund

`Refund` resides within the `Payment` aggregate (v1.2 §3.1) and is bounded by the amount of the payment it reverses. A deposit refund reverses no payment; it discharges a held balance.

A deposit refund **MUST NOT** be modelled as a `Refund`. It **MUST** be a debit movement on `StudentAccount`, dated in the current open period.

This is required for correctness, not preference: a deposit collected in a prior academic session may be refunded years later, and routing that through `Refund` would require writing against a payment in a locked period, violating invariant 15 (v1.2 §3.6). Because a deposit refund is a current-period liability settlement, no write enters a closed period.

#### 2.8 (C-13) `FeeHead` remains the single charge catalog; `accountingNature` classifies

`FeeHead` remains the sole charge catalog, per `C-2`. No parallel deposit-type catalog **SHALL** be introduced.

`FeeHead` **MUST** carry an `accountingNature` attribute valued `REVENUE` or `LIABILITY`. This attribute classifies the charge; it does not confer behaviour on `FeeHead`. `FeeHead` remains a catalog entry without lifecycle.

`accountingNature` is the correct name and is retained. It states the accounting fact directly, is neutral with respect to the deposit workflow (a future liability-nature charge that is not a deposit requires no renaming), and maps directly onto the account class used by general-ledger export. `depositFlag`, `isRefundable` and equivalent names were rejected: each encodes a specific workflow rather than the accounting classification, and each would require replacement when a second liability-nature charge type appears.

`accountingNature` **MUST** be immutable once the `FeeHead` has been referenced by any issued invoice. Reclassification would retroactively restate settled history. To change treatment, a new `FeeHead` **MUST** be created and the existing one deactivated — the same reasoning that made fee structures versioned rather than editable under `C-3`.

Deposit types — library, hostel caution, lab, transport security and institution-specific equivalents — **MUST** be represented as `FeeHead` entries of `LIABILITY` nature. They are billed on the invoice, paid by ordinary payment, receipted and settled by allocation exactly as revenue charges are.

#### 2.9 (C-14) Liability-nature allocation credits `StudentAccount`

The charge lifecycle is identical for both natures up to and including settlement by allocation. Divergence occurs once, after settlement.

Where an allocation settles a charge whose `FeeHead` is of `LIABILITY` nature, the settlement **MUST** additionally create or credit a `StudentDeposit` on the student's `StudentAccount`, within the same transaction. Where the nature is `REVENUE`, it **MUST NOT`.

Deposit-specific behaviour — held balance, refund policy, adjustment history, forfeiture and the settlement lifecycle — **MUST** reside on `StudentDeposit` and `StudentAccount`. It **MUST NOT** reside on `FeeHead`. The lifecycle belongs to the instance, not to the catalog entry.

Deposit configuration — default refund policy, adjustment rules, forfeiture window, treatment on branch transfer — **MUST** be represented by a `DepositPolicy` configuration entity that references a `FeeHead`. `FeeHead` **MUST NOT** hold a reference back to `DepositPolicy`. Institutions collecting no deposits hold no `DepositPolicy` records.

#### 2.10 (C-15) Allocation source is generalised to `FundingSource`

`C-10` generalised the allocation *target* from `Invoice` to a charge. The allocation *source* **MUST** be generalised symmetrically.

`PaymentAllocation`'s source **MUST** be a funding source, which is either a `Payment` or a held balance on `StudentAccount`. The allocation's owning aggregate follows its source: payment-sourced allocations are owned by `Payment`; account-sourced allocations are owned by `StudentAccount`. Each source aggregate **MUST** enforce its own ceiling — the payment amount, or the held balance.

Allocation remains the single mechanism by which money is applied to any charge, unqualified by the origin of the funds.

Adjusting a deposit against outstanding dues **MUST** be performed as an account-sourced allocation. A synthetic `Payment` **MUST NOT** be created to represent an internal transfer. Doing so would overstate collection reporting and the day book with funds not received, and would require a permanent exclusion clause in every collection query.

---

### B.2 Insert into §3 (Accepted DDD Refinements), after §3.9

---

#### 3.10 (R-10) Student exit settlement is an application service

Student exit, transfer certificate issuance and withdrawal settlement **MUST** be implemented as an application service. It **MUST NOT** be an aggregate root and **MUST NOT** introduce one.

The service orchestrates operations that already exist: reading outstanding position from the `AUTH-021` projection, reading held balances from `StudentAccount`, and executing account-sourced allocations and deposit refunds.

Per deposit, the operator **MUST** be able to select: refund in full; adjust against outstanding dues and refund the remainder; adjust only; or leave held. Institution policy **MUST** supply the default per deposit type from the applicable `DepositPolicy`. Operator override of a policy default **MUST** be audited with actor and reason.

All adjustments and refunds selected within one exit settlement **MUST** commit or fail together. Partial settlement of an exit is not a valid state.

Leaving a deposit refund pending requires no state change and no additional status. The balance remains held and continues to appear on the student's account after exit.

Adjustment **MUST** be capped at the lesser of the held balance and the outstanding dues. Refund **MUST** be capped at the held balance after adjustment. Both are enforced by invariant 8.

---

## C. Updated aggregate ownership table

### C.1 Replaces the aggregate roster in §3.1

| Aggregate root | Contains | Basis for the boundary |
|---|---|---|
| `Invoice` | `InvoiceItem` | Items have no meaning outside their invoice; the totals invariant is internal |
| `Payment` | `PaymentTender`, `PaymentAllocation` (payment-sourced), `Refund` | All three are constrained by the payment's amount; the invariants are internal |
| `Receipt` | — | Independent lifecycle and its own number series (§2.2) |
| `CreditNote` | — | Cannot reside within `Invoice`, which is immutable after issue |
| `LateFee` | — | Owns its own assessment, waiver and reversal lifecycle |
| `StudentAccount` | balance movements, `StudentDeposit`, `PaymentAllocation` (account-sourced) | Held balances with enforceable invariants (§2.4, §2.10) |
| `Discount` | `DiscountApproval` | Existing model, unchanged |
| `FeeStructure` | `FeeItem`, `FeeTerm` | Configuration aggregate |

`StudentDeposit` is an entity within `StudentAccount`. It is **not** an aggregate root. It exists because a student may hold several deposits simultaneously, and may hold two of the same type across separate enrolments, so the `FeeHead` reference alone cannot group movements unambiguously.

`DepositPolicy` is a configuration entity referencing `FeeHead`. It holds no student-specific state and participates in no financial transaction.

### C.2 Replaces the per-entity ownership table in §3.1

| Entity | Owner aggregate | Lifecycle owner | Invariants owner |
|---|---|---|---|
| `InvoiceItem` | `Invoice` | `Invoice` | `Invoice` |
| `PaymentTender` | `Payment` | `Payment` | `Payment` |
| `PaymentAllocation` (payment-sourced) | `Payment` | `Payment` | `Payment` and the targeted charge |
| `PaymentAllocation` (account-sourced) | `StudentAccount` | `StudentAccount` | `StudentAccount` and the targeted charge |
| `Refund` | `Payment` | `Payment` | `Payment` |
| `Receipt` | `Receipt` | `Receipt` | `Receipt` |
| `CreditNote` | `CreditNote` | `CreditNote` | `Invoice` (cumulative limit) |
| `LateFee` | `LateFee` | `LateFee` | `LateFee` |
| Balance movement | `StudentAccount` | `StudentAccount` | `StudentAccount` |
| `StudentDeposit` | `StudentAccount` | `StudentAccount` | `StudentAccount` |
| `DiscountApproval` | `Discount` | `Discount` | `Discount` |
| Ledger entry | — | Writing aggregate | None (immutable on write) |

`StudentAccount` owns institution-held balances only: advance, refundable deposits and refund credits. It **MUST NOT** own invoices, outstanding fee position, or payment history. Wallet and loyalty concepts are outside the finance domain and **MUST NOT** be introduced into this aggregate.

### C.3 Addition to the multi-aggregate transaction list in §3.1

The list of deliberate multi-aggregate transactions permitted under `C-8` is extended from two to three:

3. **Exit settlement** spans `StudentAccount` and the targeted charges within one transaction, protecting the invariant that an exit settles completely or not at all (§3.10).

---

## D. Updated transaction boundary section

### D.1 Insert into §3.2, after the T1 / T2 / T2′ sequence

**T3 — deposit collection.** Where an allocation settles a `LIABILITY`-nature charge, the `StudentDeposit` creation or credit **MUST** occur within the same transaction as that allocation. There is no separate deposit-collection transaction.

**T4 — deposit adjustment.** One debit movement on `StudentAccount`, one account-sourced `PaymentAllocation` against the targeted charge, the targeted charge's cached balance update, the Ledger entry and the audit entry **MUST** occur within a single transaction.

**T5 — deposit refund.** One debit movement on `StudentAccount`, the outbound payment record, the Ledger entry and the audit entry **MUST** occur within a single transaction. The transaction **MUST** be dated in the current open period regardless of when the deposit was collected.

**T6 — deposit forfeiture.** One debit movement on `StudentAccount`, the Ledger entry recording recognition of revenue, the approval record and the audit entry **MUST** occur within a single transaction.

**T7 — exit settlement.** All adjustments and refunds selected within one exit **MUST** occur within a single transaction, per §3.10.

The requirement in §3.2 that every transaction writes its audit entry within the same transaction applies unchanged to T3 through T7.

---

## E. Updated invariants

### E.1 Additions to the invariant list in §3.6

The following are appended. Invariants 1–15 are unchanged.

16. A deposit's held balance never exceeds the amount collected for that deposit.
17. A deposit's held balance is never negative.
18. Every deposit adjustment has exactly one corresponding account-sourced allocation of equal amount.
19. A `FeeHead`'s `accountingNature` never changes after the head has been referenced by an issued invoice.

Invariants 16, 17 and 19 **MUST** be enforced by database constraint or in-aggregate check. Invariant 18 **MUST** be enforced by automated test.

Invariant 8 — a `StudentAccount` balance is never negative — applies to deposit balances and is not restated.

### E.2 Addition to the derived-state rules in §3.7

Deposit status **MUST** be derived from movements and **MUST NOT** be stored, per `D-3`:

```
HELD ──► PARTIALLY_SETTLED ──► SETTLED
  │                              ▲
  └──────────► FORFEITED ────────┘
```

- `HELD` — held balance equals the amount collected.
- `PARTIALLY_SETTLED` — partially adjusted or refunded; balance above zero.
- `SETTLED` — balance reduced to zero by adjustment, refund, or both.
- `FORFEITED` — closed by an explicit forfeiture movement under policy.

`FORFEITED` is required. Without it an unclaimed deposit remains a liability indefinitely with no legitimate means of closure.

Movement types are `COLLECTED` (credit), `ADJUSTED` (debit), `REFUNDED` (debit) and `FORFEITED` (debit). Movements are append-only. A movement is never edited; a correcting movement is appended.

---

## F. Updated implementation order

### F.1 Replaces steps 6 and 7 of the implementation sequence in §6

Steps 1 through 5 are unchanged. Steps 8 through 12 are unchanged and retain their numbering.

6. `PaymentAllocation` with charge targeting (`C-10`) **and `FundingSource` source generalisation (`C-15`)**, `D-1` payer reference, `C-4` allocation rule, and `D-5` `PaymentTender`.
7. `StudentAccount` aggregate (`C-9`), **including `StudentDeposit`, `FeeHead.accountingNature` (`C-13`), liability-nature settlement (`C-14`), `DepositPolicy` configuration, and the exit settlement application service (`R-10`)**.

`C-15` **MUST** be implemented within step 6, not deferred. Building allocation with a payment-only source and generalising afterwards would require migrating every allocation row already written.

The refundable deposit workflow adds no step to the sequence and does not alter its dependency order.

---

## G. Changelog

### G.1 Insert into §7 (Changelog) of v1.2

**Amendment v1.2.1 — refundable deposits.**

*Clarifications added.* `C-11` deposits are liabilities, not revenue; `C-12` a deposit refund is not a Payment Refund; `C-13` `FeeHead` remains the single charge catalog and gains an immutable `accountingNature`; `C-14` liability-nature allocation credits `StudentAccount`, with deposit behaviour owned by `StudentDeposit` and `StudentAccount` and configuration by `DepositPolicy`; `C-15` allocation source generalised to `FundingSource`.

*Refinement added.* `R-10` student exit settlement is an application service, not an aggregate.

*Aggregate ownership updated.* `StudentAccount` extended to contain `StudentDeposit` and account-sourced allocations. Allocation ownership follows its funding source. Exit settlement recorded as the third deliberate multi-aggregate transaction under `C-8`.

*Transaction boundaries extended.* T3 deposit collection, T4 adjustment, T5 refund, T6 forfeiture, T7 exit settlement.

*Invariants added.* 16 through 19.

*Derived state added.* Deposit status derived from movements, never stored.

*Implementation order updated.* `C-15` folded into step 6; deposit scope folded into step 7. No step added; dependency order unchanged.

*Entities added.* `StudentDeposit` (entity within `StudentAccount`), `DepositPolicy` (configuration). `FeeHead` gains `accountingNature`; `PaymentAllocation` gains the funding source generalisation.

*No aggregate root added. No bounded context added. No frozen decision reopened.*

### G.2 Version status

`FINANCE_ARCHITECTURE_DELTA_v1.2.md` together with this amendment constitutes the final frozen finance architecture. Implementation proceeds against both documents read as one.

---

## H. Frozen decisions added by this amendment

Appended to the list in v1.2 §6. Items 1 through 26 are unchanged.

27. Refundable deposits are liabilities, not revenue; forfeiture is the only path to revenue recognition (`C-11`).
28. A deposit refund is a `StudentAccount` debit in the current period, never a `Refund` (`C-12`).
29. `FeeHead` is the single charge catalog; no parallel deposit-type catalog (`C-13`).
30. `FeeHead.accountingNature` is immutable once referenced by an issued invoice (`C-13`).
31. Liability-nature allocation credits `StudentAccount`; deposit behaviour is owned by `StudentDeposit` and `StudentAccount`, configuration by `DepositPolicy` (`C-14`).
32. Allocation source is a `FundingSource` — `Payment` or `StudentAccount`; ownership follows the source (`C-15`).
33. Exit settlement is an application service and is the third documented multi-aggregate transaction (`R-10`).
34. Deposit status is derived from movements, never stored (`C-14`, `D-3`).
35. `StudentAccount` owns institution-held balances only; it owns no invoice, outstanding position, payment history, wallet or loyalty concept (§C.2).

---

## I. References

Unchanged from v1.2 §8, with the addition of:

- `FINANCE_ARCHITECTURE_DELTA_v1.2.md` — the base text this document amends
