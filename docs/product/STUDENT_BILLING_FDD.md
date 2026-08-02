# Student Billing — Functional Design Document (FDD)

**Status:** Draft v2, pending sign-off
**Owner:** Product / UX / Frontend / Backend (joint)
**Backend basis:** M1–M12, M6, MVP payment-method enforcement — feature frozen
**Document type:** Functional design only. No React, no API contracts, no schema, no folder structure. This document specifies *what* the module does and *how it behaves* — functional building blocks are named where useful; implementation choices are not.

**Once approved, this document becomes the frozen implementation contract.** The frontend implementation plan is derived directly from it. No further product or UX redesign occurs after approval unless a genuine blocker is discovered during implementation.

### How to read this document

Every statement about what the system does or must do is tagged with exactly one of the following, so the four categories are never blurred together:

| Tag | Meaning |
|---|---|
| **[Backend-Confirmed]** | Verified directly against the actual, frozen backend code — a fact, not an assumption. |
| **[UX Decision]** | A design choice made during this process. Changeable only through a deliberate redesign, not silently. |
| **[Constraint]** | Something the frozen backend does *not* support. The design works within it; it is not proposed to be fixed here. |
| **[Future]** | Named for the roadmap. Not designed around, not committed to, not blocking this document's approval. |

Every functional requirement introduced in Parts I and II carries an ID (`FR-xxx-nn`). Part III closes with a Requirements Traceability Matrix mapping every ID to its acceptance criteria and verification approach.

---

### Operational Philosophy

**Collect Fee is the operational home screen of this module.** Every other page — Students, Invoices, Discounts, Fee Structure, Reports — exists to *support* fee collection: configuring what can be collected, reviewing what already was, or reporting on it afterward. None of them are peers to Collect Fee in daily importance, and none should be designed as if they were. Where a design choice anywhere in this document trades a small amount of friction on a secondary page for speed or safety on Collect Fee, that trade is intentional (Section 7 states the full set of principles this follows from).

# PART I — PRODUCT & BUSINESS

## 1. Module Overview

### 1.1 Objective

Reduce the time and friction of daily fee collection to the point where a Cashier can complete a routine transaction — search, select, collect, print — without leaving a single screen, and without needing to think in terms of invoice numbers to do it.

### 1.2 Success Criteria

- A routine, single-period, cash collection completes in a small, fixed number of deliberate actions, with no dead ends or redundant navigation.
- A Cashier never needs to look up or reference an invoice number to complete a normal transaction.
- Zero silent financial errors: every action that could produce a wrong amount, a duplicate payment, or an unclear transaction outcome has an explicit, designed response — never an undefined behavior discovered in production.

### 1.3 Non-Goals

- No parent-facing portal or access of any kind.
- No cheque, DD, or other deferred-clearance instrument workflow. **[UX Decision]** — the MVP payment-method set (Section 8.2) excludes these entirely, and this is enforced, not merely assumed (Section 1.5).
- No offline mode or offline data sync.
- No mobile or responsive layout for this module. **[UX Decision]** — reaffirmed explicitly during this design process; see Section 7.

### 1.4 Assumptions

- Every user of this module authenticates as one of the roles defined in Section 4 — there is no anonymous or lightweight-guest access path.
- A school using this module has already completed basic setup (at least one Fee Plan, at least one enrolled student) before a Cashier's first session.
- The desktop workstation used for fee collection has a working printer connected, though the design does not depend on print succeeding (Section 15.3).

### 1.5 Dependencies

- This entire module depends on the Student Billing backend exactly as it stands at the stated basis versions above. **[Constraint]** No API, schema, or business-rule change is available to this design — every capability described here either already exists on the backend or is explicitly named as unavailable.
- Student identity and search data (name, admission number, guardian links) are owned by the Students module, outside Student Billing's own scope, and are consumed here as a dependency, not redesigned here.

---

## 2. Personas

Built from what this design process actually established as true, not invented biographical detail.

### Persona 1 — The Cashier
**[Backend-Confirmed]** Authenticates as `ACCOUNTANT` — there is no separate `CASHIER` role in the system (Section 4.1). Performs fee collection as a high-volume, repetitive task, potentially hundreds of times across a working day. Primary need is speed without sacrificing certainty about what was just collected. Works this screen continuously enough that fatigue and error-prevention over a full shift are real design constraints (Section 7), not edge cases.

### Persona 2 — The Accountant
Same authenticated role as the Cashier, broader scope of daily use: generates invoices, manages Fee Plans and Fee Heads, requests discounts on a parent's behalf, reviews (but does not decide) reports. Distinguished from the Cashier persona by *which* parts of the module they use in a given session, not by any difference in system permission.

### Persona 3 — The School Admin / Principal
Supervisory and configuration-focused. Owns the discount approval queue as a real, recurring daily responsibility. The only persona that can cancel an invoice. Branch visibility is scoped to their individual assignment, not automatically broader than an Accountant's (Section 4.2).

---

## 3. Navigation

### 3.1 Dashboard — Explicit Resolution

**This was ambiguous in the prior draft and is resolved here explicitly, not left implicit.**

The Dashboard is the school's **app-wide home**, outside Student Billing's own scope — the same landing surface every other module (Attendance, Admissions, Transport, etc.) surfaces a summary widget on. It is not one of Student Billing's own six pages (Section 3.2). **[UX Decision]** Student Billing's presence on that Dashboard is a single, prominent **"Collect Fee" CTA** — the module's one contribution to the app-wide home, consistent with Section 7's Operational Philosophy that Collect Fee is this module's center of gravity.

**FR-NAV-04:** For a user authenticated as `ACCOUNTANT`, login does **not** route through the Dashboard — it routes directly to Collect Fee (Section 12). The Dashboard remains reachable via the app's own top-level navigation for any user who wants the broader, all-modules overview; it is simply never a forced waypoint on the Cashier's daily path. This reconciles the app-wide Dashboard's existence with the module's own speed principle (Section 7) — the Dashboard is not removed, it is just not inserted between login and the counter workflow.

### 3.2 Student Billing's Own Navigation

**[UX Decision]** Six top-level items, deliberately minimal:

| Item | Purpose |
|---|---|
| **Collect Fee** | Default landing page for Cashier/Accountant (Section 3.1). The core daily workflow (Part II, Section 12). |
| **Students** | Search/directory entry into a student's full billing history. |
| **Invoices** | Cross-student list, filter, and generation. |
| **Discounts** | Approval queue plus browsable history. |
| **Fee Structure** | Fee Plans and Fee Heads, tabbed together. |
| **Reports** | Analytics, stats, and defaulters, tabbed together (Section 18). |

**FR-NAV-01:** Student Billing's own navigation contains exactly these six items and no others — the Dashboard (Section 3.1) is outside this count, since it belongs to the app shell, not this module.
**FR-NAV-02:** For a user authenticated as `ACCOUNTANT`, Collect Fee is the default landing page after login (see FR-NAV-04 for the Dashboard-bypass mechanism).
**FR-NAV-03:** The following actions are never given a standalone page or nav item: late-fee waiver, defaulters browsing, discount creation, invoice generation. Each lives inside the page where its subject is already displayed (detailed per-page in Part II).

---

## 4. Roles & Permissions

### 4.1 Role Reality

**[Backend-Confirmed]** The system's `UserRole` enumeration contains no `CASHIER` value. Every reference to "Cashier" anywhere in this document means **a user authenticated as `ACCOUNTANT`** — this is the only role permitted to call the fee-collection capability. This is not a documentation simplification; it is the literal extent of what the frozen backend allows. **[Future]** Whether front-desk staff should hold a narrower, dedicated role than full `ACCOUNTANT` access is an open product question, named in Section 26, not resolved here.

### 4.2 Permission Matrix

| Capability | Accountant (Cashier) | School Admin / Principal |
|---|---|---|
| Collect a fee | ✅ | ✅ |
| Search/view any student's billing profile | ✅ | ✅ |
| Generate invoices (individual + bulk) | ✅ | ✅ |
| Send an invoice (Draft → Sent) | ✅ | ✅ |
| Waive a late fee | ✅ | ✅ |
| Create/request a discount | ✅ | ✅ |
| **Approve or reject a discount** | ❌ | ✅ |
| **Cancel an invoice** | ❌ | ✅ |
| Create Fee Plans / Fee Heads | ✅ | ✅ |
| View Reports | ✅ (branch-scoped) | ✅ (branch-scoped) |

**FR-ROLE-01:** No UI anywhere in this module presents a `CASHIER`-labeled login or role selection — the Accountant role is the sole entry point for counter collection.
**FR-ROLE-02:** The Cancel Invoice control is never rendered for an Accountant-authenticated session — not shown-disabled, not present-then-rejected.
**FR-ROLE-03:** Discount approve/reject controls are never rendered for an Accountant-authenticated session.
**FR-ROLE-04:** **[Backend-Confirmed]** Branch visibility is resolved per individual user assignment (`resolveAuthorizedBranchIds`), not inferred from role — a branch-restricted School Admin sees the same data slice a same-branch Accountant sees.

---

## 5. Information Architecture

**Primary pages** (own nav item): Collect Fee, Students, Invoices, Discounts, Fee Structure, Reports.

**Secondary pages** (reached by navigation, no nav item of their own): Student Financial Profile, Receipt Detail, Invoice Detail.

**Contextual actions** (live inside another page, never their own screen): late-fee waiver, discount creation, invoice send/cancel, receipt print/download.

This structure is not repeated in Part II — each page chapter states its own navigation relationships in its **Navigation** subsection, referencing back to this section rather than restating it.

---

## 6. Complete User Journeys

### 6.1 Cashier
```
Login
  │
  ▼
Collect Fee (default landing — FR-NAV-02)
  │
  ▼
Search student ────────────► Section 10
  │
  ▼
Student card + Due/Upcoming/Paid render
  │
  ▼
Select periods (none pre-selected — FR-COLLECT-04)
  │
  ▼
Review Allocation Preview (if applicable) ──► Section 12.5
  │
  ▼
Confirm payer / method / amount ───────────► Section 12 (Payment Panel)
  │
  ▼
Collect
  │
  ▼
Receipt Detail (one or more receipts) ─────► Section 13
  │
  ▼
Print (independent of collection success — FR-RECEIPT-03)
  │
  ▼
Search auto-refocuses ──────────────────────┐
  │                                          │
  └──────────────► next transaction ◄────────┘
```
Secondary, lower-frequency actions from the same login: reprint a past receipt (student search → Receipts tab), request a discount (create only), waive a disputed late fee. **Cannot:** cancel an invoice, approve/reject a discount (FR-ROLE-02, FR-ROLE-03).

### 6.2 Accountant
All of 6.1, plus: generate invoices individually and in bulk (Section 15), send invoices, create Fee Plans/Fee Heads (Section 17), browse (not approve) discount requests (Section 16). **Cannot:** cancel invoices — identical restriction to the Cashier journey, since it is the same role.

### 6.3 School Admin / Principal
```
Students / Invoices / Discounts / Fee Structure / Reports
  │
  ▼
Everything Accountant can do
  │
  ▼
PLUS: Cancel Invoice (Invoice Detail, Section 19)
  │
  ▼
PLUS: Discount approval queue (Section 16.1) — a real, recurring daily task
```

---

## 7. Design Principles

These direct every decision in Part II. Where a specific choice and a principle appear to conflict, the principle wins unless a Backend Constraint forces otherwise.

1. **Fast** — the routine case costs the fewest possible deliberate actions. Speed is never achieved by removing a decision the user should be making (see Principle 3).
2. **Safe** — nothing that moves money happens by accident. Bulk actions have clear, deterministic boundaries (FR-COLLECT-05). Irreversible actions get a final, reactive confirmation (FR-PANEL-06).
3. **Deliberate, not implicit** — no default selection of anything that costs money (FR-COLLECT-04). The fast path is the safe path by construction, not the accidental one.
4. **Operational language, not database language** — business language first (FR-COLLECT-03), invoice numbers and raw statuses available but demoted.
5. **Honest, not simplified** — where the underlying system genuinely produces two receipts, the UI says two receipts (FR-RECEIPT-04). Where a label is a best-effort guess, it is designed knowing that, not presented as more certain than it is (Section 8.3).
6. **Desktop-first, by decision** — this module is built for a fixed counter workstation. Mobile is out of scope, deliberately (Section 1.3), not by oversight.

---

## 8. Fee Collection Policy

**[Backend-Confirmed]** facts and **[UX Decision]** policies this module operates by, gathered into one place. Every policy below is stated in two parts, deliberately kept visually distinct: **Policy** (the rule itself, independent of any screen) and **UI** (where and how it manifests). This separation exists so that if a school's policy changes in the future — a different allocation order, advance payment newly permitted — the policy statement here is what changes, and the UI section it points to can be re-examined on its own terms rather than requiring a redesign discovered by grepping through page chapters for scattered mentions of the old rule. Sections 8.1–8.7 were present in the prior draft as "Business Rules" and keep their numbering unchanged; 8.8 onward centralizes policy that was previously stated only inline within individual page chapters.

### 8.1 Payer Identity
**Policy:** Exactly one of a linked guardian or a free-text name is required per payment — never both, never neither. **[Backend-Confirmed]**
**UI:** Payment Panel's Paid By field (Section 12.6, FR-PANEL-05).

### 8.2 MVP Payment Methods
**Policy:** Cash, UPI, Card, Instant Bank Transfer — exactly these four. Any other value, including Cheque, DD, or NEFT-style transfer, is rejected by the backend outright via an enforced allowlist, not merely discouraged by the UI. **[Backend-Confirmed]**
**UI:** Payment Panel's Method selector (Section 12.6, FR-PANEL-03).

### 8.3 Business-Language Labels Are Best-Effort
**Policy:** No backend field represents a billing period or frequency. A fee period's display label is derived from fee-item/fee-plan naming, falling back to a due-date-derived label when the source naming is generic. Label quality depends on how a school named its fee plans at setup time — a real, named limitation, never hidden behind a confident-looking label. **[Constraint]**
**UI:** Fee Period Card's primary label (Section 12.4.1, FR-COLLECT-03).

### 8.4 Overpayment Is Rejected
**Policy:** The backend refuses an amount exceeding what is currently due. **[Backend-Confirmed]**
**UI:** Payment Panel's Amount field prevents this proactively at input, rather than relying on the rejection to teach the rule (Section 12.6, FR-PANEL-02).

### 8.5 Same-Day, Same-Amount, No-Reference Collision
**Policy:** Absent a supplied reference number, the payment idempotency key derives from tenant + invoice + amount + method + calendar day. Two genuinely separate same-amount payments against the same invoice on the same day, both without a reference, collide — the second silently returns the first's receipt. **[Backend-Confirmed]**
**UI:** Recognized specifically as an "already collected" state, not a generic error (Section 20.1, FR-ERR-02).

### 8.6 Fee Plans Are Not Editable
**Policy:** No update or delete route exists for a Fee Plan once created. **[Constraint]**
**UI:** Fee Structure presents plan management as create-new / supersede, never as editing an existing plan (Section 17, FR-INV-04).

### 8.7 Fee Head Accounting Nature Locks
**Policy:** A Fee Head's accounting nature becomes immutable once referenced by an issued invoice. **[Backend-Confirmed]**
**UI:** Fee Structure reflects this as a locked field under that condition, not a silent server-side rejection (Section 17, FR-FEE-02).

### 8.8 Allocation Order
**Policy:** When a collected amount covers more than one selected period, or only partially covers what is selected, application is always oldest-period-first. **[UX Decision]**
**UI:** Allocation Preview (Section 12.5, FR-ALLOC-02).

### 8.9 Allocation Mechanism
**Policy:** The split across periods is always computed by the system — a Cashier never manually types a per-period amount. **[UX Decision]**
**UI:** Allocation Preview recalculates automatically as the Amount field changes (Section 12.5).

### 8.10 Advance Payment
**Policy:** Whether a period not yet due can be collected against ahead of time is a school-level setting. Where permitted, it is selectable one period at a time, never in bulk. **[UX Decision, mechanism unverified — Section 24, item 7]**
**UI:** Upcoming section (Section 12.4, FR-COLLECT-06).

### 8.11 Partial Payment
**Policy:** A collected amount may be less than the full total of what is selected, across any number of selected periods — there is no restriction to a single period. **[UX Decision]**
**UI:** Allocation Preview (Section 12.5, FR-ALLOC-01/03).

### 8.12 Multi-Period Payment
**Policy:** A single Collect action may cover more than one fee period at once, selected individually or via Select All Due. **[UX Decision]**
**UI:** Due section's multi-select (Section 12.4, FR-COLLECT-05).

### 8.13 Multiple Receipts
**Policy:** A single Collect action spanning periods on more than one invoice produces one receipt per invoice, never artificially merged into one. **[Backend-Confirmed]** — a direct mechanical consequence of offline payment recording accepting exactly one invoice per call, not a UI choice.
**UI:** Receipt Detail's multi-receipt presentation (Section 13.4, FR-RECEIPT-04).

### 8.14 Late Fee Behavior
**Policy:** Late fee assessment is automatic — a backend process evaluates overdue periods and adds the assessed amount directly into that period's due amount. The Collect Fee screen never manages late-fee assessment as a separate action; collecting a period's due amount already includes any late fee folded into it. Waiving a late fee is the one late-fee action available to staff, and is performed from the period's detail view, not from Collect Fee's primary flow. **[Backend-Confirmed]**
**UI:** Reflected in the Fee Period Card's amount (Section 12.4.1) and, where applicable, the Late Fee waive action inside Invoice Detail (Section 19).

---

## 9. Glossary

| Term | Meaning in this module |
|---|---|
| **Due** | A fee period currently owed, past or at its due date. |
| **Upcoming** | A fee period not yet due. Visible always; selectable only if advance payment is permitted. |
| **Paid** | A fee period fully settled. |
| **Invoice** | The backend financial record underlying a fee period. Audit-facing, not the primary language of this module (FR-COLLECT-03). |
| **Receipt** | The proof-of-payment record generated per payment. One Collect action may generate more than one receipt (FR-RECEIPT-04). |
| **Allocation** | How a collected amount is applied across the periods it was collected against, oldest period first. |
| **Fee Head** | The accounting category a charge belongs to (e.g., Academic, Transport). |
| **Fee Plan** | The configured structure of charges a student is billed from. |
| **Outstanding** | The total currently due across all of a student's unpaid periods. |
| **Defaulter** | A student with one or more overdue periods. |
| **Paid By** | The payer of record for a given payment — a linked guardian or a free-text name (Section 8.1). |

### 9.1 Receipt Numbering Philosophy

Four terms are easy to conflate; this module treats them as distinct, with different audiences:

| Identifier | Audience | Where it appears |
|---|---|---|
| **Receipt Number** | **User-facing.** The primary identifier shown to a parent, printed on the physical receipt, the one number a parent should ever need to reference. | Receipt Detail (Section 13), prominently. |
| **Invoice Number** | **Audit/staff-facing only.** Never the primary label anywhere in this module (Section 8.3, FR-COLLECT-03). | "View Details" only (Section 12.4.1, Section 19). |
| **Payment Reference** | **User-provided, not system-generated.** The UTR/transaction ID a parent's own bank or UPI app already gave them, entered by the Cashier for non-cash methods (Section 12.6, FR-PANEL-04). Shown on the receipt as supporting detail, so a parent can cross-check it against their own bank record — not a number this system invents. | Receipt Detail, Payment Panel. |
| **"Transaction Number"** | **Not a separate concept in this system.** Named here only to close the question, not to introduce a fourth identifier: there is no backend-exposed number beyond the three above. An internal payment identifier exists but is never shown to any user, staff or parent — it is not a "transaction number" in the sense a school would recognize. | Not surfaced anywhere. |

This table exists so implementation never invents a display for an identifier that isn't real, and never shows an audit-only number where a user-facing one belongs.

---

# PART II — UX & INTERACTION

## 10. Search

### 10.1 Purpose
The universal entry point into any student's billing activity — the first action in nearly every session.

### 10.2 Supported Fields
**[UX Decision]** Admission number, student name, father's name, parent mobile number, roll number — one input, all fields searched simultaneously; the user never selects which field they are searching by.

### 10.3 Behavior
- **FR-SEARCH-02:** Type-ahead, debounced. Not Enter-to-search — results begin appearing as the user types, after a short pause to avoid firing on every keystroke.
- **FR-SEARCH-01:** A single query matches across all supported fields at once.
- **FR-SEARCH-05:** The search input auto-refocuses the instant a transaction completes or "Collect for another" is chosen (Section 13.5) — no click required to begin the next search.

### 10.4 Multiple Matches
**FR-SEARCH-03:** When a query (typically father's name or mobile number) matches more than one student, a distinct intermediate results list is shown before any student card renders — never an ambiguous single result silently picked for the user. Each row shows name, class/section, and admission number, sufficient to disambiguate siblings or common names without opening any one of them first.

### 10.5 Zero Results
**FR-SEARCH-04:** A calm, explicit state — "No student found — check spelling or admission number" — never an indistinguishable blank list (Section 22.2).

### 10.6 Keyboard Behavior
Search is the first stop in the module's overall tab order (Section 12.7). Arrow keys navigate a visible results list; Enter selects the highlighted result.

### 10.7 Performance Target
Results begin appearing within the debounce window of the user pausing input — no perceptible delay beyond that pause for a typical query.

### 10.8 Recent Searches (Optional)

**[UX Decision, optional — not required for freeze.]** On an empty search box, before any query is typed, a short list of the session's most recently viewed students may appear as one-click shortcuts. **FR-SEARCH-06 (optional).** Named here as a genuine speed opportunity for a Cashier serving the same family across several transactions in a row, and marked optional deliberately — omitting it does not block implementation, and it should not be built at the expense of anything in Section 12.

---

## 11. Student Summary Card

### 11.1 Purpose
Establishes unambiguous student identity **and** enough operational context to act confidently, the moment a search result is chosen — appears identically whether reached from Collect Fee or the Student Financial Profile.

### 11.2 Fields

**Identity fields:**

| Field | Grounding |
|---|---|
| Name, admission number, class/section | **FR-SUMMARY-01. [Backend-Confirmed]** Core student identity. |
| Father's Name | **FR-SUMMARY-04. [Backend-Confirmed]** Sourced from the linked Guardian record — the same data already used to disambiguate multi-match search results (Section 10.4). |
| Mobile | **FR-SUMMARY-05. [Backend-Confirmed]** Guardian's linked phone number. |
| Transport | **FR-SUMMARY-07. [Constraint — needs confirmation before implementation]** Whether this student is assigned a transport route is owned by a separate module (Transport), not Student Billing. This document does not verify that cross-module data is reliably available to this card and does not commit to it being simple to add. Included here as a stated requirement; its feasibility must be confirmed against the Transport module before implementation, not assumed. |

**Financial snapshot** — the operational block a Cashier should register before a parent finishes speaking:

| Field | Grounding |
|---|---|
| Outstanding | **FR-SUMMARY-09. [Backend-Confirmed]** A single compact total (see Section 12.3.1's Outstanding Summary for the full breakdown by Current/Overdue/Total) — a glance figure, not a duplicate of that region's detail. |
| Overdue | **FR-SUMMARY-10. [Backend-Confirmed]** Shown alongside Outstanding when non-zero — the specific figure most likely to change how a Cashier greets the transaction. |
| Fee Relaxation | **FR-SUMMARY-06. [Backend-Confirmed]** Whether this student has an active, approved discount, and its category — derivable directly from existing discount records for the student. Shown as a compact indicator (e.g., "Sibling Discount active"), not a full breakdown; the full discount history remains in the Student Financial Profile. |
| Last Payment | **FR-SUMMARY-08. [Backend-Confirmed]** Most recent payment date and amount, derivable from the student's existing payment history. |
| Current Fee Plan | **FR-SUMMARY-11. [Backend-Confirmed]** The active Fee Plan this student is assigned to. |
| Advance Balance | **[Constraint — deliberately absent.]** Consistent with Section 12.3.1 / FR-OUTSTANDING-05: no held-balance concept exists in the backend for student fees. Not shown here for the same reason it is not shown in the Outstanding Summary — a permanent "₹0" would misrepresent a capability gap as a checked, real figure. |

This card intentionally carries more than pure identity now — Fee Relaxation and Outstanding in particular are operational signals a Cashier should register before a parent even finishes speaking, not facts they discover deeper in the flow.

### 11.3 Clickable / Expandable
**FR-SUMMARY-03:** "View full profile" — a persistent link to the Student Financial Profile (Section 14), available wherever this card appears.
**FR-SUMMARY-02:** A sibling chip appears when the matched student has linked siblings, enabling a one-click switch to a sibling's own card without a fresh search.

### 11.4 Hidden
Invoice numbers, raw statuses, and any other audit-facing detail never appear on this card — consistent with FR-COLLECT-03.

---

## 12. Collect Fee — Complete Workflow

**This is the most detailed chapter in this document**, matching its status as the module's primary operational workflow. Every other page chapter is held to a lighter bar.

### 12.1 Purpose
Enable a Cashier to collect a payment against one or more of a student's currently due (or, where permitted, upcoming) fee periods, and reach a printed receipt, without leaving this screen.

### 12.2 Entry Points
- Default landing page after login for an Accountant-authenticated session (FR-NAV-02).
- "Collect Fee" link from a Student Financial Profile, pre-loaded with that student (Section 14.2).
- Direct navigation via the top-level nav item.

### 12.3 Layout — Full Wireframe

```
┌───────────────────────────────────────────────────────────────────────────┐
│ 🔍 [Search: name, admission no, father name, mobile...]      (type-ahead) │  Section 10
├───────────────────────────────────────────────────────────────────────────┤
│ Aarav Shah · ADM2024-0042 · Class 8-B        Siblings: [Riya Shah ›]       │  Section 11
│ Father: Rajesh Shah · 98765-xxxxx     Transport: Route 4    🏷 Sibling Disc.│
├───────────────────────────────────────────────────────────────────────────┤
│ Current Due ₹12,300   Overdue ₹6,200   Total Outstanding ₹18,500            │  Section 12.3.1
│ Last Payment: ₹4,500 on 2 Jul 2026                                          │
├───────────────────────────────────────────────────────────────────────────┤
│ DUE                                    [ Select All Due ]      [ Clear ]  │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ ☐  May Fee                              Tuition                ₹4,500 │ │
│ │ ☐  June Fee                             Tuition                ₹4,500 │ │
│ │ ☐  ⚠ July Fee                Tuition · Overdue                 ₹4,500 │ │
│ │ ☐  August Fee                           Tuition                ₹4,500 │ │
│ └─────────────────────────────────────────────────────────────────────┘ │  ← internal scroll cap
│ Selected: 0 periods                                  No periods selected │
├───────────────────────────────────────────────────────────────────────────┤
│ ▸ Upcoming (4)                          ▸ Paid (4) — view                  │  collapsed by default
├───────────────────────────────────────────────────────────────────────────┤
│ ▾ FEE HEAD BREAKDOWN (selected period)                                     │  inline, not hidden
│      Tuition                                    ₹10,000                   │
│      Lab Fee                                      ₹2,300                   │
├───────────────────────────────────────────────────────────────────────────┤
│ PAYMENT PANEL                                            (dimmed at ₹0)   │  Section 12.6
│ Amount   [ — ]           Method  ( Cash ) (UPI) (Card) (Bank)             │
│ Paid By  [ Priyanka Shah (auto-filled) ▾/✎ ]                               │
│                                        [ Collect ]  ← disabled at ₹0       │
└───────────────────────────────────────────────────────────────────────────┘
```

### 12.3.1 Outstanding Summary — Detailed Definition

**[UX Decision]** Replaces the earlier draft's flat "Total Due / Overdue" pair with a fuller, precisely-defined breakdown:

```
┌─────────────────────────────────────────────────────────────┐
│  Current Due            ₹12,300                                │
│  Overdue                 ₹6,200                                │
│  ───────────────────────────────                               │
│  Total Outstanding      ₹18,500                                │
│                                                                    │
│  Last Payment           ₹4,500 on 2 Jul 2026                    │
└─────────────────────────────────────────────────────────────┘
```

| Field | Definition | Grounding |
|---|---|---|
| **Current Due** | **FR-OUTSTANDING-01.** Sum of Due-section periods not yet past their due date. | **[Backend-Confirmed]** Derivable from existing invoice due-amount and due-date data. |
| **Overdue** | **FR-OUTSTANDING-02.** Sum of Due-section periods past their due date. | **[Backend-Confirmed]** Same source, using the already-established overdue derivation (Section 8.3's sibling concept for invoices — overdue-ness is a read-time computed condition, not a stored one). |
| **Total Outstanding** | **FR-OUTSTANDING-03.** Current Due + Overdue. | Computed, not a separate data source. |
| **Last Payment** | **FR-OUTSTANDING-04.** Most recent payment's date and amount for this student. | **[Backend-Confirmed]** |
| **Advance Balance** | **FR-OUTSTANDING-05. [Constraint — not available.]** No held-balance or advance-payment concept exists anywhere in the current backend for student fees. This is not a display bug or an oversight — the underlying capability (a `StudentAccount` aggregate) does not exist yet. It is named in Section 27 (Future Roadmap) and is **not shown on this card in this document's scope.** A field for it is not included in the wireframe above, deliberately, rather than shown as a permanent "₹0" that would misrepresent a capability gap as a real, checked figure. |

This same breakdown appears identically on the Student Financial Profile's Overview tab (Section 14.4) — defined once here, referenced there, per Section 5's no-duplication rule.

### 12.4 Due / Upcoming / Paid — Selection Behavior

**FR-COLLECT-02:** Three visually distinct sections. Due is expanded by default; Upcoming and Paid are collapsed by default.

**FR-COLLECT-09:** Due is internally scrollable beyond roughly 4–5 visible rows, so the Payment Panel is never pushed below the viewport regardless of how many periods are outstanding.

**FR-COLLECT-03:** Each row's primary label is business language — "April Fee," "Transport Fee" — never an invoice number (Section 8.3 governs label derivation and its honest limits). Invoice number, issue date, and raw status are reachable only via "View Details."

**FR-COLLECT-07:** The entire row is clickable to toggle selection; "View Details" has its own carved-out click zone, explicitly excluded from the row's selection toggle — clicking one never triggers the other.

**FR-COLLECT-08:** An overdue period is marked with an icon, a color, and a text label together — never color alone (accessibility; Section 21).

**FR-COLLECT-04:** No row is selected when the screen loads or when a new student is chosen. Selected count reads "0," total reads "₹0," Collect is disabled.

**FR-COLLECT-05:** "Select All Due" always means "every Due row, full stop." It performs a full, deterministic reset of selection to the complete Due set — it is never additive to an existing partial selection, and it never touches Upcoming rows under any configuration.

**FR-COLLECT-06:** Upcoming rows are always visible, never hidden. Each is individually selectable if the school permits advance payment; each is visibly disabled with an inline explanatory note if not. There is no bulk "select all upcoming" under any configuration. Selecting an individual Upcoming row produces a distinct, visible confirmation on that row — deliberately different from the visual treatment of selecting a Due row, so adding future money to a collection is never an accidental-feeling action.

### 12.4.1 Fee Period Card — Component Specification

The row rendered for every period in Due, Upcoming, and Paid, specified once here rather than redrawn per state throughout Section 12.

```
┌──────────────────────────────────────────────────────────┐
│ ☐  July Fee                    Tuition · ⚠ Overdue          │  Header + Status
│                                                                │
│    Amount           ₹4,500                                    │  Amount
│    Late Fee          +₹50                                     │  Late Fee (only if assessed)
│    Discount          −₹200                                    │  Discount (only if applied)
│    ─────────────────────                                       │
│    Remaining         ₹4,350                                    │  Remaining
│                                              [ View Details ]  │  Actions
└──────────────────────────────────────────────────────────┘
```

| Element | Specification |
|---|---|
| **Header** | Business-language label (Section 8.3) plus category tag (FR-COLLECT-03). |
| **Status** | An icon + text badge — Overdue, Upcoming, or Paid — never color alone (Section 21). Absent entirely for a normal, on-time Due row; a status badge only appears when there is something to flag. |
| **Amount** | The period's base charge. |
| **Late Fee** | **FR-CARD-01.** Shown as a distinct line, additive to Amount, only when a late fee has actually been assessed (Section 8.14) — never a permanent zero line on every row. |
| **Discount** | Shown as a distinct line, subtractive, only when a discount actually applies to this period — same "only when real" rule as Late Fee (FR-CARD-01). |
| **Remaining** | **FR-CARD-02.** Amount + Late Fee − Discount − any amount already paid toward this period. This is the figure that feeds the running selection total (Section 12.6). |
| **Actions** | "View Details" (Section 19), the row's one carved-out click zone (FR-COLLECT-07). |
| **Selection** | The checkbox plus the row's own click-to-toggle behavior (FR-COLLECT-04 through 07). |
| **Hover** | A subtle visual lift, signaling the row is clickable, without implying selection has occurred. |
| **Expanded (Fee Head Breakdown)** | When a Due row is selected, its Fee Head Breakdown (Section 12.3's wireframe) renders inline below the Due list, not inside the row itself — keeping every row's own height consistent regardless of selection state. |
| **Collapsed** | The default state for every row in the Upcoming and Paid sections (Section 12.4) — Header, Status, and Remaining only, no Late Fee/Discount breakdown shown until the row is opened via View Details. |

### 12.5 Allocation Preview

**FR-ALLOC-01:** Appears once two or more periods are selected. **FR-ALLOC-03:** Multi-period partial payment is permitted — there is no restriction to a single selected period, and no policy setting gates this, since no such backend setting exists to gate on (Section 8, Constraint).

**FR-ALLOC-02:** The preview shows, oldest period first, exactly how the entered amount is applied:
```
Allocation Preview
  May Fee      ₹4,500 of ₹4,500   (paid in full)
  June Fee     ₹2,500 of ₹4,500   (partial — ₹2,000 remaining)
```
If the amount field is edited after two or more periods are already selected, this preview recalculates and its visible state updates (Section 7, Principle 2) so the change is never silent.

### 12.6 Payment Panel — Complete Specification

**FR-PANEL-01:** Always rendered. Visibly dimmed and inert while zero periods are selected; becomes fully active the instant one is checked.

| Field | Behavior |
|---|---|
| **Amount** | **FR-PANEL-02.** Defaults to the sum of selected periods. Editable. Overpayment beyond what is due is prevented at input (Section 8.4). |
| **Method** | **FR-PANEL-03.** Exactly Cash / UPI / Card / Instant Bank Transfer (Section 8.2) — a segmented choice, not a dropdown offering more than these four. Cash is pre-selected by default, reflecting the dominant real-world case. |
| **Reference** | **FR-PANEL-04.** Appears only for methods that meaningfully use one — UPI, Card, Instant Bank Transfer. Never shown for Cash. Optional at the backend level (Section 8.5), but its presence is what allows a same-day, same-amount repeat collection to be distinguished. |
| **Paid By** | **FR-PANEL-05.** Auto-filled from the student's primary linked guardian. Editable — the moment it is edited, its underlying identity switches from the guardian link to a free-text name (Section 8.1); this switch is invisible to the user but real. |
| **Remarks** | Optional free text, not required for any transaction. |
| **Confirmation line** | **FR-PANEL-06.** Immediately above Collect. Reads, e.g., *"Collecting ₹18,000 · 4 periods · Cash · Paid by Priyanka Shah."* Re-renders on **any** field change — amount, period count, method, or payer — not only on selection change. This is the last thing read before an irreversible action; it must never display stale information. |
| **Collect** | **FR-PANEL-07.** Disables immediately on click. **FR-PANEL-08.** The entire selection area — checkboxes, Select All Due, Clear — locks alongside it for the duration of the request, not the button alone. |

### 12.7 Keyboard Behavior
Defined tab order: Search → results list (if shown) → Due rows, in display order → Select All Due → Upcoming rows (if enabled) → Amount → Method → Paid By → Collect. Enter within the Amount field moves focus to Method; it never submits the transaction directly. `Alt+A` as a Select-All-Due shortcut is named for the roadmap (Section 25), not required for this document's approval.

### 12.8 UI States
Loading (student card and Due/Upcoming/Paid during the post-search fetch — FR-STATE-01), zero-search-result (FR-SEARCH-04), zero-pending-dues (FR-STATE-03), in-flight submission (FR-PANEL-07/08), success (transitions to Receipt Detail, Section 13), validation error, unanticipated error (Section 20).

### 12.9 Navigation
Default landing for Accountant (FR-NAV-02). On success, transitions to Receipt Detail (Section 13); "Collect for another" returns here with search refocused (FR-SEARCH-05), never a full page reload.

### 12.10 Permissions
Available to Accountant and School Admin/Principal identically — collection itself carries no role distinction (Section 4.2). What differs by role is only which *other* actions are available alongside it (e.g., Cancel Invoice, reachable only via Invoice Detail, Section 19, never from this screen for an Accountant).

### 12.11 State Diagram — Payment Lifecycle

```
   No Selection
        │  (check a Due or Upcoming row)
        ▼
    Selected  ──────────────────────┐
        │  (2+ periods, partial amt) │ (single period, or full amt)
        ▼                            │
      Review                         │
   (Allocation Preview)              │
        │                            │
        └─────────────┬──────────────┘
                       ▼
                  Submitting
              (locked — FR-PANEL-07/08)
                       │
           ┌───────────┴───────────┐
           ▼                       ▼
        Success                  Error
   (→ Receipt Detail)      (Section 20 — recognized
           │                specifically, never generic)
           ▼
    Collect Another
   (→ No Selection, same screen)
```

### 12.12 Acceptance Criteria
- AC-COLLECT-01: A Cashier can search, select every currently-due period in one action, and reach a printed receipt without navigating away from this screen at any point.
- AC-COLLECT-02: No period is ever selected without an explicit user action.
- AC-COLLECT-03: A partial payment across multiple periods always displays an Allocation Preview before submission, and the amount actually collected always equals the sum shown in that preview.
- AC-COLLECT-04: Submitting with an invalid method, a missing payer, or an amount exceeding what is due is prevented or clearly explained before the request is sent.
- AC-COLLECT-05: The confirmation line always reflects the current state of every field at the moment Collect is pressed.
- AC-COLLECT-06: The module functions correctly at 1366×768 with no horizontal scroll, and the Payment Panel is never pushed off-screen by a long Due list.

---

## 13. Receipt & Receipt Detail

### 13.1 Purpose
Confirm a completed transaction and provide printing/download, independent of whatever happens with the physical printer.

### 13.2 Entry Points
Automatic transition on a successful Collect action (Section 12.11); Receipts tab of the Student Financial Profile (Section 14.4, reprint case).

### 13.3 Wireframe — Single Receipt
```
┌─────────────────────────────────────────────────────┐
│  ‹ Previous Receipt              Next Receipt ›        │  FR-RECEIPT-07
├─────────────────────────────────────────────────────┤
│  Payment Completed                                      │
│  Receipt Created                                        │
│                                                            │
│  Aarav Shah · ADM2024-0042 · Class 8-B                   │  Student Info
│                                                            │
│  Receipt RCP-2026-00891                                  │
│  ₹12,300 · Cash · 1 Aug 2026, 11:42 AM                    │
│  Paid by: Priyanka Shah                                  │
│  For: May Fee  ›  View Invoice (INV-2026-00142)          │  Invoice Link
│                                                            │
│  Created  1 Aug 2026, 11:42 AM                            │  Receipt Event History
│                                                            │  (see FR-RECEIPT-08 — created
│                                                            │   only; print events are not
│                                                            │   tracked by the backend today)
│                                                            │
│  [ View Receipt ]   [ Print ]   [ Download ]             │
│                                                            │
│  [ Collect for another ]                                 │
└─────────────────────────────────────────────────────┘
```

**FR-RECEIPT-07.** Previous/Next navigation steps through the student's other receipts in date order — assembled from the same receipt list already available on the Profile's Receipts tab (Section 14.4), not a new backend capability.

**FR-RECEIPT-08. [Constraint]** The event history shown here is limited to what the backend actually records: a receipt's creation timestamp. Print and reprint actions are client-side (FR-RECEIPT-02/03) and are **not** logged server-side today — this document does not show a "Printed at [time]" line, since it would not be a real, verifiable fact. If print/reprint tracking is added in the future (Section 27), this history can be extended without changing this page's structure.

### 13.4 Wireframe — Multiple Receipts
**FR-RECEIPT-04:** **[Backend-Confirmed]** A single Collect action spanning periods on more than one invoice produces more than one receipt record underneath — a verified mechanical fact (offline payment recording accepts exactly one invoice per call), not a UI choice. This is stated honestly, never disguised as one receipt.
```
┌─────────────────────────────────────────────────────┐
│  Payment Completed                                      │
│  2 Receipts Created                                     │
│                                                            │
│  Aarav Shah · ADM2024-0042 · Class 8-B                   │  Student Info
│                                                            │
│  Receipt RCP-2026-00891 · ₹12,300 · May Fee               │
│    › View Invoice (INV-2026-00142)                       │  Invoice Link, per receipt
│  Receipt RCP-2026-00892 · ₹4,500  · June Fee              │
│    › View Invoice (INV-2026-00143)                       │
│                                                            │
│  [ View Receipts ]   [ Print All ]   [ Download ]        │
│                                                            │
│  [ Collect for another ]                                 │
└─────────────────────────────────────────────────────┘
```
**FR-RECEIPT-05:** "Print All" produces one combined physical printout — never sequential browser print dialogs, one per receipt.

### 13.5 Behavior
**FR-RECEIPT-01:** Always a Receipt Detail *page* first — never a directly-generated PDF as the immediate result of Collect.
**FR-RECEIPT-02:** A PDF is generated only on an explicit Print or Download click.
**FR-RECEIPT-03:** Payment success is independent of print success. The receipt record exists the moment collection succeeds; a cancelled print dialog or a disconnected printer is never interpreted as a failed transaction. If print fails, the page's success state is unaffected, and a manual reprint path remains available indefinitely.
**FR-RECEIPT-06:** "Collect for another" is a persistent action on this page itself, never requiring a prior navigation to reach it, and returns to Collect Fee with search refocused (FR-SEARCH-05).

### 13.6 Header, Student, Invoice Links, Timeline
The receipt header identifies the student and links to both the underlying invoice's audit detail (Section 19) and, when reached from the Financial Profile, back to that profile. The event history shown here (FR-RECEIPT-08) is scoped to this one receipt's own lifecycle, not the student's broader financial history — the Profile's Timeline tab (Section 14.4) remains the canonical chronological view across all of a student's activity; this page's history is narrower by design, not a smaller duplicate of it.

### 13.7 Navigation
Reached from Collect Fee on success, or from a Profile's Receipts tab for reprinting. Never a top-level nav item (Section 5).

### 13.8 Permissions
Identical to Collect Fee (Section 12.10) — no additional role distinction on this page.

### 13.9 Acceptance Criteria
- AC-RECEIPT-01: Payment success is never contingent on print success, in any visible state or underlying record.
- AC-RECEIPT-02: A multi-invoice collection is always presented as the correct number of receipts, never claimed to be fewer.
- AC-RECEIPT-03: A PDF is never generated automatically — only on explicit user action.

---

## 14. Student Financial Profile

### 14.1 Purpose
The complete billing history for one student — the research and audit view, distinct from Collect Fee's transaction-focused workspace.

### 14.2 Entry Points
Students page search result; "View full profile" from the Student Summary Card (Section 11.3) wherever it appears.

### 14.3 Wireframe
```
┌───────────────────────────────────────────────────────────┐
│ Aarav Shah · ADM2024-0042 · Class 8-B      [ Collect Fee ] │
├───────────────────────────────────────────────────────────┤
│ [Overview] [Invoices] [Payments] [Receipts] [Refunds] [Timeline] │
├───────────────────────────────────────────────────────────┤
│  (active tab content)                                        │
└───────────────────────────────────────────────────────────┘
```

### 14.4 Tabs
**FR-PROFILE-01:** Six tabs.

| Tab | Content |
|---|---|
| Overview | **FR-PROFILE-04.** Student identity (Section 11.2 fields, in full — not the compact card version); the same Outstanding Summary breakdown defined in Section 12.3.1 (Current Due, Overdue, Total Outstanding, Last Payment); active Fee Plan(s); a persistent "Collect Fee" action that jumps to Section 12 pre-loaded with this student. No new figures are introduced on this tab — everything here is defined once, in the sections referenced, and shown identically here. |
| Invoices | Full invoice list, all statuses, filterable, expandable to full detail including late-fee waiver (Section 19) |
| Payments | Every payment record — method, amount, date, payer, linked receipt |
| Receipts | Every receipt, with reprint (Section 13) |
| Refunds | **FR-PROFILE-02. [Constraint]** No dedicated refund data source exists on the backend — not even a read endpoint. This tab shows only refunds that surface incidentally through payment records already loaded for other tabs, and is labeled as such, never presented as a complete independent record. |
| Timeline | **FR-PROFILE-03.** A chronological merge of invoice/payment/discount/late-fee events, assembled from data already fetched for the other tabs. **[Constraint]** No backend timeline endpoint exists; this is the correct approach given that constraint, not a workaround pending a future fix. **FR-PROFILE-05.** Each event type carries a distinct icon, consistent with this module's icon+color+text rule (Section 21): Invoice — document icon; Receipt — receipt/check icon; Discount — tag icon; Waiver — a distinct icon from Discount, since a waiver and a discount are different facts (a waiver forgives a late fee already assessed; a discount reduces a charge before it is ever billed) and must never share a visual so a Cashier scanning history can't tell them apart; Late Fee — a warning-adjacent icon, visually related to but distinct from the Overdue icon already used in Section 12.4.1, since a late-fee-assessed event and a currently-overdue period are different facts shown in different places. |

### 14.5 Permissions
Cancel Invoice, visible only to School Admin/Principal, lives inside the Invoices tab's expanded detail (Section 4.2, Section 19) — never rendered for an Accountant session.

### 14.6 Navigation
Reached from Students search or from Collect Fee; the "Collect Fee" action in the header returns to Section 12 pre-loaded with this student.

### 14.7 Acceptance Criteria
- AC-PROFILE-01: The Refunds tab never implies completeness it cannot back up.
- AC-PROFILE-02: Every figure shown on the Overview tab matches what Collect Fee would show for the same student at the same moment.

---

## 15. Invoices

### 15.1 Purpose
Cross-student invoice list, filtering, and generation — the management view, distinct from any single student's Profile.

### 15.2 Entry Points
Top-level navigation.

### 15.3 Wireframe
```
┌───────────────────────────────────────────────────────────┐
│  Invoices                      [ Generate ]  [ Bulk Generate ] │
├───────────────────────────────────────────────────────────┤
│  Filters: [ Status ▾ ] [ Academic Year ▾ ] [ Search ]         │
├───────────────────────────────────────────────────────────┤
│  Invoice #      Student        Period      Status    Amount │
│  ...                                                          │
└───────────────────────────────────────────────────────────┘
```

### 15.4 Behavior
**FR-INV-01:** Filterable, paginated list across all students.
**FR-INV-02:** Generation is available both individually and in bulk.
**FR-INV-03:** **[Backend-Confirmed]** Bulk generation runs synchronously; verified directly that it degrades safely — a per-student failure does not abort the batch, and the existing duplicate-invoice guard makes retrying after a timeout safe rather than corrupting. The UI communicates "this may take a moment for large classes" rather than implying instant completion.
**FR-INV-04: [Constraint]** Fee Plan management is presented as create-new / supersede — there is no "edit" affordance for an existing plan, since no such backend route exists (Section 8.6).

### 15.5 Permissions
Generation and sending available to Accountant and above; cancellation (via Invoice Detail, Section 19) is School Admin/Principal only.

### 15.6 Acceptance Criteria
- AC-INV-01: A bulk generation that times out and is retried never produces duplicate invoices for a student already generated.

---

## 16. Discounts

### 16.1 Purpose
Two audiences, one page: the approval queue (decision-making) and browsable history (context).

### 16.2 Entry Points
Top-level navigation. Creation itself is **not** entered here — it is a contextual action from a Student Financial Profile.

### 16.3 Wireframe
```
┌───────────────────────────────────────────────────────────┐
│  Discounts        [ Pending Approval (3) ]  [ All Requests ] │
├───────────────────────────────────────────────────────────┤
│  Student        Category     Amount     Requested By        │
│  ...                                            [Approve][Reject] │
└───────────────────────────────────────────────────────────┘
```

### 16.4 Behavior
**FR-DISC-01:** The approval queue is visible and actionable only for School Admin/Principal.
**FR-DISC-02:** Discount creation happens on a student's Profile, never as a form on this page — this page is for review, not origination.

### 16.5 Permissions
Approve/reject: School Admin/Principal only (FR-ROLE-03). Browsing history: both roles.

### 16.6 Acceptance Criteria
- AC-DISC-01: An Accountant viewing this page never sees an Approve or Reject control, anywhere.

---

## 17. Fee Structure

### 17.1 Purpose
Configuration of Fee Plans and Fee Heads — low-frequency, setup-time work, distinct from daily operations.

### 17.2 Entry Points
Top-level navigation.

### 17.3 Wireframe
```
┌───────────────────────────────────────────────────────────┐
│  Fee Structure          [ Fee Plans ]  [ Fee Heads ]         │
├───────────────────────────────────────────────────────────┤
│  (active tab: list + Create New)                              │
└───────────────────────────────────────────────────────────┘
```

### 17.4 Behavior
**FR-FEE-01:** Two tabs, Fee Plans and Fee Heads.
**FR-FEE-02:** **[Backend-Confirmed]** A Fee Head's accounting-nature field is shown as locked/read-only the moment it has been referenced by an issued invoice — reflected in the UI directly, not discovered only when an edit attempt is rejected.

### 17.5 Permissions
Available to Accountant and School Admin/Principal identically.

### 17.6 Acceptance Criteria
- AC-FEE-01: A Fee Head whose accounting nature is locked shows that state visibly before any edit is attempted, not only after.

---

## 18. Reports

### 18.1 Purpose
Aggregate collection figures — genuinely secondary to the core collection flow, appropriate to ship after it.

### 18.2 Entry Points
Top-level navigation.

### 18.3 Report List

**[Backend-Confirmed]** verified directly against the three endpoints this page can draw from, each with a different — and differently limited — filter capability. Listed honestly rather than assumed uniform:

| Report | Status | Grounding |
|---|---|---|
| **Defaulters** | **FR-RPT-02. Fully supported**, including branch, class, and minimum-days-overdue filters. | The richest of the three sources — genuinely class-wise and threshold-configurable today. |
| **Outstanding (tenant-wide total)** | **FR-RPT-03. Supported** as a single aggregate figure (sum of due amounts). | Available via the existing overview aggregate; not filterable by date or class. |
| **Discount Total** | **FR-RPT-04. Supported** as a single aggregate figure (sum of active, approved discounts). | Same source as Outstanding. A detailed per-discount breakdown already exists on the Discounts page (Section 16) — this report is the total only, not a duplicate list. |
| **Today's / Daily / Monthly Collection** | **FR-RPT-05. [Constraint] Not supported by any confirmed endpoint.** | None of the three sources accept a date-range filter — verified directly, including confirming that date parameters some existing frontend code already sends are silently ignored server-side today. Achievable only by fetching raw payment records and filtering/summing them client-side — a real, workable, but honestly *assembled*, not backend-provided, report. Named here so it is scoped correctly during implementation, not assumed to be a simple filtered query. |
| **Class-Wise Collection** | **FR-RPT-06. [Constraint] Not supported for collection totals.** Class-wise **defaulters** specifically (FR-RPT-02) is supported; class-wise **collection amounts** are not. | Do not conflate the two — a "Class Wise" report in this module means the defaulters view, not a general collection breakdown by class. |
| **Payment Method Report** | **FR-RPT-07. [Constraint] Not supported.** | No endpoint breaks figures down by payment method. Same client-assembly caveat as the date-range reports above, at a larger data-volume cost. Named for the roadmap (Section 27) rather than committed to for this document's scope. |

### 18.3.1 Today's Snapshot (Summary Widget)

**[UX Decision]** A compact, always-visible strip above the report tabs, giving an at-a-glance daily read without requiring a tab click:

```
┌───────────────────────────────────────────────────────────┐
│  Today's Collection      Today's Receipts    Students Paid   │
│      ₹42,300                    18                   16      │
│                                             Outstanding: ₹2.1L │
└───────────────────────────────────────────────────────────┘
```

**FR-RPT-08.** Three of these four figures — Today's Collection, Today's Receipts, Students Paid Today — carry the **same constraint already stated for FR-RPT-05**: no confirmed endpoint filters by date, so each is computed by fetching the day's payment/receipt records and summarizing them client-side, not by a backend-provided "today" query. This is not a new, softer exception to that finding — it is the same gap, surfaced again because this widget makes it more visible than the tabbed reports below it did. **Outstanding** is the one figure here genuinely backend-provided as an aggregate (FR-RPT-03), included in the same strip because it belongs in a daily glance even though its source is different from its three neighbors.

### 18.4 Wireframe (Generic Report Layout)

```
┌───────────────────────────────────────────────────────────┐
│  Reports    [ Defaulters ] [ Outstanding ] [ Discounts ]     │
├───────────────────────────────────────────────────────────┤
│  Filters: [ Branch ▾ ] [ Class ▾ ] [ Min. Days Overdue ]      │  ← filters shown only where FR-RPT-02
│                                                                  applies; other tabs show the single
│                                                                  aggregate figure with no filter row
├───────────────────────────────────────────────────────────┤
│  Student        Class      Overdue Amount   Days Overdue    │
│  ...                                                           │
└───────────────────────────────────────────────────────────┘
```
Each report tab's filter row is present only when the underlying data genuinely supports it (Defaulters) — a tab backed by a single aggregate figure (Outstanding, Discount Total) does not show a filter row that would silently do nothing, consistent with this module's error-prevention principle (Section 7).

### 18.5 Behavior
**FR-RPT-01:** Report tabs are folded into one page rather than separate nav items — the exact set is the seven items in Section 18.3, not the six originally drafted, now corrected to reflect verified backend support rather than an assumed uniform capability.

### 18.6 Permissions
Available to Accountant and School Admin/Principal, branch-scoped per FR-ROLE-04.

### 18.7 Acceptance Criteria
- AC-RPT-01: Figures shown are always scoped to the viewing user's authorized branches, never broader.
- AC-RPT-02: A report tab never presents a filter control for a dimension (date range, class, payment method) the underlying data source does not actually honor.

---

## 19. Invoice Detail

### 19.1 Purpose
The audit-level view of a single invoice — where invoice numbers, raw statuses, and line-item detail (demoted from Collect Fee, FR-COLLECT-03) actually live.

### 19.2 Entry Points
"View Details" from any fee-period row in Collect Fee (Section 12.4) or the Invoices tab of a Student Financial Profile (Section 14.4); rows in the Invoices page (Section 15).

### 19.3 Wireframe
```
┌───────────────────────────────────────────────────────────┐
│  INV-2026-00142 · Term 2 Tuition          Status: SENT       │
│  Issued: 1 Jul 2026     Due: 15 Aug 2026                       │
├───────────────────────────────────────────────────────────┤
│  Tuition                                          ₹10,000    │
│  Lab Fee                                            ₹2,300    │
│  ─────────────────────────                                    │
│  Total ₹12,300   Paid ₹4,000   Due ₹8,300                       │
├───────────────────────────────────────────────────────────┤
│  Payment History                                                │  FR-INVDET-02
│    2 Jul 2026    ₹4,000   Cash   Receipt RCP-2026-00811          │
├───────────────────────────────────────────────────────────┤
│  Late Fees:  [ none / list with Waive action ]                 │
│  [ Send ]   [ Cancel ]  ← School Admin/Principal only           │
└───────────────────────────────────────────────────────────┘
```

**FR-INVDET-02.** Payment History lists every payment made against this specific invoice, each linking directly to its own Receipt Detail (Section 13) — this is the invoice's own settlement record, narrower in scope than the Student Financial Profile's Payments tab (Section 14.4), which spans every invoice a student has.

### 19.4 Permissions
Cancel: School Admin/Principal only (FR-ROLE-02). Send, waive: Accountant and above.

### 19.5 Acceptance Criteria
- AC-INVDET-01: Cancel is absent entirely, not disabled, for an Accountant-authenticated session.

---

## 20. Error, Loading, Empty, and Success States (Cross-Cutting Catalog)

This section consolidates states referenced throughout Part II rather than redefining them per page.

### 20.1 Errors
| Scenario | Required behavior | Reference |
|---|---|---|
| Validation error (overpayment, missing payer, invalid method) | Specific, human-readable message — never raw backend text, never a generic catch-all | FR-ERR-01, Section 8.4 |
| Same-day/same-amount/no-reference collision | Recognized specifically; shown as "already collected" with the existing receipt | FR-ERR-02, Section 8.5 |
| Two counters race on one invoice | Losing request shows a specific, non-alarming "already collected — see receipt [X]" | FR-ERR-03 |
| Print fails or is cancelled | Payment status unaffected; manual reprint remains available | FR-ERR-04, Section 13.5 |
| **Session expires mid-transaction** | **Open question — not yet decided.** See Section 26. | FR-ERR-05 |
| Genuinely unanticipated error | Distinct, calm fallback, explicit about whether payment may or may not have succeeded — never silence | FR-ERR-06 |

### 20.2 Empty States
- No search results (Section 10.5) — FR-SEARCH-04.
- **FR-STATE-02.** No data for a Reports filter selection — a distinct empty state, not an error.
- **FR-STATE-03.** No pending dues for a found student — a genuine positive state ("All fees paid"), never indistinguishable from a loading failure.

### 20.3 Loading States
- Student card and Due/Upcoming/Paid sections, during the post-selection fetch window — an explicit skeleton, never a flash of empty layout (FR-STATE-01).

### 20.4 Success States
- **FR-STATE-04.** Receipt Detail (Section 13) **is** the success state for Collect Fee — no separate toast-and-redirect layered on top of it.

---

## 21. Accessibility

- Status is always communicated by color, icon, and text label together — never color alone (FR-COLLECT-08 and throughout).
- Visible keyboard focus indicators throughout (Section 12.7).
- Row density sized for continuous, multi-hour use, not maximum visual compactness (Section 7, Principle 1 vs. 2 trade-off, resolved toward safety).
- State-change feedback (Section 12.5, 12.6) is specified as a "visible state update," deliberately not as a mandated animation, to avoid conflicting with reduced-motion accessibility preferences.

---

# PART III — ENGINEERING NOTES

## 22. Functional Component Inventory

Named as behavioral building blocks, not implementation artifacts — no framework, prop, or file-structure detail.

| Block | Behavior it owns |
|---|---|
| Search Input | Debounced, multi-field, keyboard-navigable results (Section 10) |
| Student Summary Card | Identity display, sibling switch, profile link (Section 11) |
| Fee Period Row | Business-language label, category tag, selection state, whole-row click with a carved-out detail zone (Section 12.4) |
| Section Container (Due/Upcoming/Paid) | Expand/collapse, internal scroll cap, distinct visual weighting per section (Section 12.4) |
| Allocation Preview | Oldest-first breakdown, reactive to amount changes (Section 12.5) |
| Payment Panel | Amount/Method/Reference/Paid-By/Confirmation composition, locking behavior during submission (Section 12.6) |
| Receipt Card | Single- and multi-receipt presentation, print/download actions (Section 13) |
| Tabbed Profile Shell | Six-tab structure reused by the Financial Profile (Section 14) |

## 23. Reuse Summary

Condensed from the full frontend audit conducted earlier in this design process. The complete audit remains the reference of record; this is a summary for engineering planning purposes.

- **Direct reuse, no changes needed:** button, input, checkbox, badge, card, label, tabs, empty-state, page-header, and the existing generic data-fetch hook pattern.
- **Reuse with a type/data update:** the existing invoice data hook — functionally sound, but its data shape predates several now-frozen backend additions (payment records, derived refund state, late fees, receipts) and needs extending to include them.
- **Reuse for list-style pages only, not Collect Fee:** the existing paginated-table and URL-parameter-driven filter components — the right fit for Invoices/Discounts, the wrong fit for Collect Fee's single-workspace, non-paginated interaction model.
- **New construction required, deliberately:** the Fee Period Row / Section Container (no existing equivalent — checkbox-driven, three-way visual differentiation, no mobile fallback needed) and the Payment Panel (no existing form matches its reactive, multi-field, cross-validated shape).
- **Do not build on:** one existing data hook was found to target a backend route that does not exist at all — confirmed dead, unused by any current page. Noted so it is not mistaken for a working reference during implementation.
- **Retire after this module ships:** two existing payment-recording entry points elsewhere in the codebase are, as of this document, non-functional against the current backend (they offer payment methods no longer accepted, and omit the payer field the backend now requires). They are not extended or referenced by this design and should be retired once this module replaces them.

## 24. Known Backend Constraints & Limitations

Consolidated list of every **[Constraint]** tag appearing in Parts I and II, gathered here for engineering visibility:

1. No structured billing-period or frequency concept exists — fee-period labels are best-effort (Section 8.3).
2. No refund read or write endpoint exists at all (Section 14.4, Refunds tab).
3. No backend timeline/history endpoint exists — the Timeline tab is client-assembled by necessity (Section 14.4).
4. Fee Plans cannot be edited or deleted once created (Section 8.6).
5. Offline payment recording accepts exactly one invoice per call — the direct cause of the multi-receipt behavior (Section 13.4).
6. No receipt-PDF-generation route is exposed over the network today, though the underlying capability exists (Section 25).
7. No per-school "advance payment allowed" setting is confirmed to exist as a formal toggle — the Upcoming-selectable behavior (Section 12.4) should be verified against whatever mechanism actually governs this before implementation.
8. No held-balance or advance-payment concept exists for student fees at all — "Advance Balance" cannot be shown on the Outstanding Summary (Section 12.3.1, FR-OUTSTANDING-05).
9. No date-range filtering exists on any of the three reporting sources (analytics overview, invoice stats, defaulters) — confirmed directly, including that date parameters some existing frontend code already sends are silently ignored server-side. Today's/Daily/Monthly Collection reports (Section 18.3, FR-RPT-05) are not backend-provided.
10. No payment-method breakdown exists on any reporting source (Section 18.3, FR-RPT-07).
11. Class-wise breakdown exists only for Defaulters, not for collection totals generally (Section 18.3, FR-RPT-06) — the two must not be conflated during implementation.
12. Transport-route assignment is owned by a separate module; its availability to the Student Summary Card (Section 11.2, FR-SUMMARY-07) is unverified and must be confirmed before implementation, not assumed.

## 25. Out of Scope (MVP)

- Mobile or responsive layout for any part of this module (Section 1.3).
- Any deferred-clearance payment instrument — cheque, DD (Section 8.2).
- Refund initiation from the frontend.
- A complete, independent Refunds record for a student.
- Editing an existing Fee Plan.
- Parent-facing access of any kind.
- Formal §269ST cash-control guidance, RTE category handling, GST-specific treatment, and day-close/cash-reconciliation reporting — real, previously-identified items, each conditional on a specific school's needs, none blocking this module.

## 26. Open Questions

These are named explicitly rather than silently resolved, and should be closed before or during implementation, not discovered after:

1. **Session-expiry mid-transaction** (FR-ERR-05): does an in-progress selection or entered amount survive a forced re-login, or is it lost? No decision has been made.
2. **Advance-payment permission mechanism**: confirm what actually governs whether Upcoming periods are selectable (Section 24, item 7) before implementation depends on it.
3. **Front-desk role scope**: whether counter staff should hold a narrower role than full Accountant access (Section 4.1) is a real product question, not resolved by this document.

## 27. Future Roadmap

Named for continuity, not committed to, not designed around in this document:

- A structured billing-period/frequency concept, removing the "best-effort label" limitation (Section 8.3) entirely.
- Completion of the fee-category data migration so every charge category, not only the two most common today, gets reliable categorization.
- A dedicated server-side "pending fees by period" projection, so period-grouping logic exists once rather than being reimplemented by every consumer of it.
- Verification of enrollment-date-aware period scoping — unverified, not confirmed broken, worth checking before a mid-year joiner could see periods predating their admission.
- A receipt-PDF network route, closing the gap noted in Section 24, item 6.
- A dedicated, narrower front-desk role, if Section 26's open question is resolved in that direction.
- Retirement of the two legacy payment-recording entry points named in Section 23.
- Date-range and payment-method-filterable reporting endpoints, closing the gaps in Section 24, items 9–10, without relying on client-side assembly of raw records.
- A `StudentAccount`/held-balance concept, enabling the "Advance Balance" figure named but not implementable in Section 12.3.1.

---

# 28. Requirements Traceability Matrix

Every functional requirement introduced in this document, mapped to its acceptance criteria and how it should be verified. Requirement IDs are stable references for QA and implementation planning.

| Req ID | Section | Summary | Acceptance Criteria | Verification Approach |
|---|---|---|---|---|
| FR-NAV-01 | 3 | Exactly six top-level nav items | Visual/manual check | Static review |
| FR-NAV-02 | 3, 6.1 | Collect Fee is default landing for Accountant | AC-COLLECT-01 | Login-flow test |
| FR-NAV-03 | 3 | No standalone pages for contextual actions | Static review | Navigation audit |
| FR-NAV-04 | 3.1 | Accountant login bypasses Dashboard, goes directly to Collect Fee | AC-COLLECT-01 | Login-flow test |
| FR-ROLE-01 | 4.1 | No CASHIER role/login path exists | AC-DISC-01 (by extension) | RBAC test |
| FR-ROLE-02 | 4.2, 19.4 | Cancel Invoice never rendered for Accountant | AC-INVDET-01 | Role-based UI test |
| FR-ROLE-03 | 4.2, 16.4 | Discount approve/reject never rendered for Accountant | AC-DISC-01 | Role-based UI test |
| FR-ROLE-04 | 4.2, 18.5 | Branch visibility scoped per user assignment | AC-RPT-01 | Multi-user data-scope test |
| FR-SEARCH-01 | 10.2 | Multi-field single-query search | Manual test across all five fields | Functional test |
| FR-SEARCH-02 | 10.3 | Debounced type-ahead, not Enter-to-search | Manual/automated interaction test | Functional test |
| FR-SEARCH-03 | 10.4 | Multi-match disambiguation state | Manual test with a seeded sibling case | Functional test |
| FR-SEARCH-04 | 10.5 | Zero-result empty state | Manual test | Functional test |
| FR-SEARCH-05 | 10.3, 13.5 | Auto-refocus after transaction | AC-COLLECT-01 | Functional test |
| FR-SEARCH-06 | 10.8 | Recent searches (optional) | Manual test | Functional test, marked optional in scope review |
| FR-SUMMARY-01 | 11.2 | Operational fields only on the card | Visual review | Static review |
| FR-SUMMARY-02 | 11.3 | Sibling switch chip | Manual test with a seeded sibling case | Functional test |
| FR-SUMMARY-03 | 11.3 | Link to full Profile | Manual test | Functional test |
| FR-SUMMARY-04 | 11.2 | Father's Name shown | Visual review | Static review |
| FR-SUMMARY-05 | 11.2 | Mobile shown | Visual review | Static review |
| FR-SUMMARY-06 | 11.2 | Fee Relaxation indicator | Manual test with an active discount | Functional test |
| FR-SUMMARY-07 | 11.2 | Transport indicator | **Unverified — cross-module dependency (Section 24, item 12)** | Confirm feasibility before test planning |
| FR-SUMMARY-08 | 11.2 | Last Payment shown | Manual test | Functional test |
| FR-SUMMARY-09 | 11.2 | Compact Outstanding total shown | Manual test, cross-check against FR-OUTSTANDING-03 | Functional test |
| FR-SUMMARY-10 | 11.2 | Overdue shown alongside Outstanding when non-zero | Manual test | Functional test |
| FR-SUMMARY-11 | 11.2 | Current Fee Plan shown | Manual test | Functional test |
| FR-COLLECT-02 | 12.4 | Three distinct Due/Upcoming/Paid sections | AC-COLLECT-01 | Visual + functional test |
| FR-COLLECT-03 | 12.4, 8.3 | Business-language primary label | AC-COLLECT-01 | Visual review |
| FR-COLLECT-04 | 12.4 | No default selection | AC-COLLECT-02 | Functional test |
| FR-COLLECT-05 | 12.4 | Select All Due — deterministic full reset | AC-COLLECT-02 | Functional test, incl. re-click after partial selection |
| FR-COLLECT-06 | 12.4 | Upcoming visible always, conditionally selectable | Manual test, both configurations | Functional test |
| FR-COLLECT-07 | 12.4 | Whole row clickable, detail zone excluded | Manual interaction test | Functional test |
| FR-COLLECT-08 | 12.4, 21 | Overdue: icon + color + text | Visual/accessibility review | Static + accessibility audit |
| FR-COLLECT-09 | 12.4 | Due section internal scroll cap | AC-COLLECT-06 | Visual test at 1366×768 with a long list |
| FR-CARD-01 | 12.4.1 | Late Fee/Discount lines shown only when real, never a permanent zero placeholder | Visual review | Static + functional review |
| FR-CARD-02 | 12.4.1 | Remaining = Amount + Late Fee − Discount − already paid | Manual test, verify arithmetic | Functional test |
| FR-OUTSTANDING-01 | 12.3.1 | Current Due defined and shown | Manual test | Functional test |
| FR-OUTSTANDING-02 | 12.3.1 | Overdue defined and shown | Manual test | Functional test |
| FR-OUTSTANDING-03 | 12.3.1 | Total Outstanding = Current Due + Overdue | Manual test, verify arithmetic | Functional test |
| FR-OUTSTANDING-04 | 12.3.1 | Last Payment date + amount shown | Manual test | Functional test |
| FR-OUTSTANDING-05 | 12.3.1 | Advance Balance NOT shown | Visual review — field absent, not a blank/zero placeholder | Static review |
| FR-PANEL-01 | 12.6 | Panel dimmed at zero, active on selection | Visual test | Functional test |
| FR-PANEL-02 | 12.6, 8.4 | Amount defaults to total, overpayment prevented | AC-COLLECT-04 | Functional test |
| FR-PANEL-03 | 12.6, 8.2 | Exactly four payment methods | AC-COLLECT-04 | Functional + backend contract test |
| FR-PANEL-04 | 12.6 | Reference field conditional on method | Manual test, each method | Functional test |
| FR-PANEL-05 | 12.6, 8.1 | Paid By auto-fill + edit switches identity mode | Manual test | Functional test |
| FR-PANEL-06 | 12.6 | Confirmation line reactive to all fields | AC-COLLECT-05 | Functional test, every field independently |
| FR-PANEL-07 | 12.6 | Collect disables immediately on click | Functional/regression test | Automated interaction test |
| FR-PANEL-08 | 12.6 | Selection area locks during submission | Functional/regression test | Automated interaction test |
| FR-ALLOC-01 | 12.5 | Preview shown at 2+ periods | Manual test | Functional test |
| FR-ALLOC-02 | 12.5 | Oldest-first application shown | AC-COLLECT-03 | Functional test |
| FR-ALLOC-03 | 12.5, 8 | No single-period restriction, no policy gate | AC-COLLECT-03 | Functional test |
| FR-RECEIPT-01 | 13.5 | Receipt Detail page, never direct PDF | AC-RECEIPT-03 | Functional test |
| FR-RECEIPT-02 | 13.5 | PDF only on explicit action | AC-RECEIPT-03 | Functional test |
| FR-RECEIPT-03 | 13.5 | Success independent of print outcome | AC-RECEIPT-01 | Functional test, simulated print failure |
| FR-RECEIPT-04 | 13.4 | Multi-receipt honesty | AC-RECEIPT-02 | Functional test, multi-invoice collection |
| FR-RECEIPT-05 | 13.4 | Print All = one combined output | Manual test | Functional test |
| FR-RECEIPT-06 | 13.5 | Collect for Another persists, refocuses search | AC-COLLECT-01 | Functional test |
| FR-RECEIPT-07 | 13.3 | Previous/Next receipt navigation | Manual test with a student with 2+ receipts | Functional test |
| FR-RECEIPT-08 | 13.3, 13.6 | Event history shows creation only, no fabricated print events | Visual review | Static review |
| FR-PROFILE-01 | 14.4 | Six-tab structure | Visual review | Static review |
| FR-PROFILE-02 | 14.4 | Refunds tab labeled as incomplete | AC-PROFILE-01 | Visual review |
| FR-PROFILE-03 | 14.4 | Timeline assembled client-side | AC-PROFILE-02 | Functional test |
| FR-PROFILE-04 | 14.4 | Overview tab fields, referencing Sections 11.2/12.3.1 | AC-PROFILE-02 | Functional test, cross-check against Collect Fee's own display |
| FR-PROFILE-05 | 14.4 | Timeline event icons — distinct per type, incl. Waiver ≠ Discount, Late Fee ≠ Overdue | Visual review | Static + accessibility review |
| FR-INV-01 | 15.4 | Cross-student filterable list | Functional test | Functional test |
| FR-INV-02 | 15.4 | Individual + bulk generation | Functional test | Functional test |
| FR-INV-03 | 15.4 | Bulk generation retry-safe | AC-INV-01 | Functional test, simulated timeout + retry |
| FR-INV-04 | 15.4, 8.6 | Fee Plan create-new only, never edit | Visual review | Static review |
| FR-DISC-01 | 16.4 | Approval queue role-restricted | AC-DISC-01 | Role-based UI test |
| FR-DISC-02 | 16.4 | Creation contextual, not on this page | Visual review | Static review |
| FR-FEE-01 | 17.4 | Two-tab structure | Visual review | Static review |
| FR-FEE-02 | 17.4, 8.7 | Accounting nature locks visibly | AC-FEE-01 | Functional test, referenced vs. unreferenced Fee Head |
| FR-RPT-01 | 18.5 | Report tabs folded into one page (seven items, Section 18.3) | Visual review | Static review |
| FR-RPT-02 | 18.3 | Defaulters — fully supported with branch/class/days filters | AC-RPT-02 | Functional test, each filter independently |
| FR-RPT-03 | 18.3 | Outstanding total — supported, unfiltered | AC-RPT-02 | Functional test |
| FR-RPT-04 | 18.3 | Discount total — supported, unfiltered | AC-RPT-02 | Functional test |
| FR-RPT-05 | 18.3 | Daily/Monthly Collection — client-assembled, not backend-filtered | AC-RPT-02 | Functional test, confirm no server-side date filter is silently ignored |
| FR-RPT-06 | 18.3 | Class-Wise — Defaulters only, not general collection | AC-RPT-02 | Static + functional review, confirm no conflation |
| FR-RPT-07 | 18.3 | Payment Method Report — not supported, named for roadmap | AC-RPT-02 | Static review — confirm absent from MVP scope |
| FR-RPT-08 | 18.3.1 | Today's Snapshot widget — 3 of 4 figures client-assembled, Outstanding backend-provided | AC-RPT-02 | Functional test, confirm no false "live" framing on the client-assembled figures |
| FR-INVDET-02 | 19.3 | Invoice-scoped Payment History, linking to Receipt Detail | AC-INVDET-01 | Functional test, multi-payment invoice |
| FR-ERR-01 | 20.1 | Human-readable validation errors | AC-COLLECT-04 | Functional test, each validation case |
| FR-ERR-02 | 20.1, 8.5 | Duplicate collision recognized specifically | Functional test | Functional test, seeded same-day/same-amount case |
| FR-ERR-03 | 20.1 | Race condition shown non-alarmingly | Functional test | Concurrency test |
| FR-ERR-04 | 20.1, 13.5 | Print failure doesn't imply payment failure | AC-RECEIPT-01 | Functional test |
| FR-ERR-05 | 20.1, 26 | Session-expiry behavior | **Open — see Section 26** | Pending decision |
| FR-ERR-06 | 20.1 | Unanticipated-error fallback | Functional test | Fault-injection test |
| FR-STATE-01 | 20.3 | Loading skeleton, student card + fee sections | Visual test | Functional test |
| FR-STATE-02 | 20.2 | Empty state for a Reports filter with no data | Visual test | Functional test |
| FR-STATE-03 | 20.2, 12.8 | Positive empty state for zero pending dues | Visual test | Functional test, student with no outstanding dues |
| FR-STATE-04 | 20.4 | Receipt Detail is the sole success state, no separate toast | AC-COLLECT-01 | Functional test |

---

*End of document. On approval, this FDD becomes the frozen implementation contract, and the next step is the frontend implementation plan derived directly from it.*
