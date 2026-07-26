# SchoolOS — Library Module: FINAL Domain Architecture Review (Freeze)

**Status:** Proposed for freeze — pending your sign-off per §20.
**Supersedes:** nothing yet (Library has no prior ADR; this is ADR-LIB-001).
**Builds on, does not repeat:** `LIBRARY_MODULE_AUDIT.md` (branch isolation, IDOR, races, missing entities — all accepted, referenced only where they shape a design decision).
**Grounded against actual repo conventions** (not generic ERP theory): `student.prisma`, `staff.prisma`, `EventOutbox`, `student-billing/sequences.prisma`, `StudentBillingAccessService`, and the FEE-1 advisory-lock convention.

---

## 1. Domain Model — Aggregates

Verifying the proposed list against what the domain actually needs, no more:

| Aggregate | Verdict | Reasoning |
|---|---|---|
| **Library** | ❌ **Remove as an entity.** | "Library" is not a bounded aggregate — it's the *name of the module*. What the spec actually needs from "Library" is branch-level configuration (loan duration defaults, fine rate, max books per borrower). That belongs in a small `LibraryBranchSettings` config row keyed `(tenantId, branchId)`, not an entity with its own lifecycle. Modeling a `Library` aggregate would just be a second, redundant place to hang tenant/branch — `Branch` already exists in this platform. |
| **Book** | ✅ Keep, redefined as **catalog record** (title-level metadata), not a physical-inventory row. | Today's `Book` conflates title and stock count — that's the root cause of the C1/C2 races in the accepted audit. Splitting fixes it structurally, not just with locks. |
| **BookCopy** | ✅ **New, required.** | This is the aggregate that actually owns physical state (branch, barcode, condition, status). Everything the audit flagged as "can't do Lost/Damaged/Rack/Shelf" traces back to this being absent. |
| **BookIssue** | ✅ Keep, re-pointed to `BookCopy` instead of `Book`. | See §3. |
| **Reservation** | ✅ New, required. Scoped to `(Book, branch)`, not `(BookCopy, branch)` — see §8 for why. |
| **Fine** | ⚠️ Keep, but **redefined as a charge-request record, not a money-holder.** | See §9 — this is the most important boundary decision in this document. |
| **Author** | ✅ New — but as a **lightweight lookup table**, not a heavy person-record aggregate. `Author(id, tenantId, name)` with a join table `BookAuthor(bookId, authorId)` for co-authorship. No biography/photo/etc. unless a real requirement shows up — resist scope creep here. |
| **Publisher** | ✅ New, same shape as `Author`: `Publisher(id, tenantId, name)`, referenced by `Book.publisherId`. |
| **Category** | ✅ New. Tenant-scoped, **flat-with-optional-parent** (`parentId` self-relation) rather than a full nested-set tree — a 2-level category system (e.g. "Fiction → Sci-Fi") covers real K-12 library taxonomies without the complexity of a general hierarchy engine. |
| **Rack** | ✅ New, **branch-scoped**. `Rack(id, tenantId, branchId, code, name)`. |
| **Shelf** | ✅ New, **branch-scoped**, child of `Rack`. `Shelf(id, rackId, code)`. `BookCopy.shelfId` is the actual location pointer; `Book.location` (free text) is deleted. |
| **InventoryAudit** | ✅ New. Header/line-item pair: `InventoryAudit` (branch, date range, status, conductedBy) + `InventoryAuditItem` (copyId, expectedStatus, scannedStatus, discrepancy flag). See §6. |
| **Barcode** | ❌ **Not a separate aggregate.** | Barcode is a *field* (`BookCopy.barcode`, unique) plus a *generation sequence* (`BarcodeSequence`, modeled exactly like the existing `InvoiceSequence`/`ReceiptSequence` pattern in `student-billing/sequences.prisma`). Making "Barcode" its own aggregate would be over-modeling a value object. |
| **DigitalAsset** | ✅ New, required for §11. `DigitalAsset(id, tenantId, bookId, type, storageRef, ...)`. |

**Net additions to the frozen list:** `BookCopy`, `Author`, `Publisher`, `BookAuthor` (join), `Category`, `Rack`, `Shelf`, `InventoryAudit`, `InventoryAuditItem`, `Reservation`, `DigitalAsset`, `BarcodeSequence`, `LibraryBranchSettings`.
**Net removals from the spec's list:** `Library` (folded into `LibraryBranchSettings` config), `Barcode` (folded into `BookCopy.barcode` + `BarcodeSequence`).

This is now a **13-aggregate module** (down from a naive 14-entity reading of the spec, but structurally complete — every gap the audit found has exactly one aggregate responsible for closing it).

---

## 2. Member Model — Borrower Architecture

**Confirmed: no `LibraryMember` aggregate.** Rationale beyond the instruction — a duplicate member table is exactly the kind of drift that caused the audit's F1 finding (frontend expecting a `Student` relation that doesn't exist). One more parallel identity table would make that worse, not better.

### Design: `BorrowerType` + `borrowerId` (polymorphic, no FK)

```
enum BorrowerType {
  STUDENT
  STAFF
}
```

`BookIssue` and `Reservation` carry `borrowerType: BorrowerType` + `borrowerId: String` (no Prisma relation — Prisma can't do a polymorphic FK across `Student`/`Staff` cleanly, and forcing it with two nullable relation columns, `studentId?`/`staffId?`, just reintroduces a null-checking mess at every call site). The polymorphic pair is resolved at the **service layer** via a single `BorrowerResolver` that takes `(tenantId, borrowerType, borrowerId)` and returns a normalized `{ displayName, branchId, status, admissionOrEmployeeId }` shape regardless of which table it hit. This resolver is the *one* place that knows about `Student` vs `Staff` — every other Library service codes against the normalized shape, not against two tables.

**Historical-integrity requirement (this is the part that matters):** a `BookIssue` row must remain readable and meaningful years after a student goes ALUMNI and their name/branch may have changed or their row is soft-archived. So `BookIssue` **denormalizes a snapshot** at issue time: `borrowerNameSnapshot`, `borrowerBranchIdSnapshot` (see §5), `borrowerDisplayIdSnapshot` (admission/employee number). This mirrors the same principle the Finance module already applies with `TenantSubscription.planSnapshot` (snapshot-first billing) — the platform already has this convention, Library should follow it rather than inventing a live-join-only history that breaks the moment upstream data changes.

### Lifecycle rules (this is the actual architectural content of §2, not the aggregate shape)

| Event | Rule |
|---|---|
| **Student admission** | No Library action required — a `Student` becomes a valid borrower automatically the moment `BorrowerResolver` can resolve them (status `ENROLLED`/`ACTIVE`). No sync/provisioning step needed — this is the whole point of not duplicating the entity. |
| **Student transfer (branch change)** | `issueBook` must **re-check borrower branch at issue time**, not cache it — a transferred student borrows against their *current* branch's copies going forward. Existing open issues from the old branch remain valid (they're snapshotted) but **block a new transfer from completing administratively** if `hasOpenObligations(STUDENT, id)` returns true — Library exposes this as a query, but enforcement of "can this transfer proceed" is the *Students* module's job to call, not Library's job to intercept. |
| **Student TC (leaving/transfer certificate)** | Same integration point: TC issuance workflow (owned by Students/Admissions) must call `libraryService.hasOpenObligations(STUDENT, id)` before finalizing. Library does not know what a TC is and should not — it only answers "does this borrower have unreturned copies or unbilled/unpaid fines." |
| **Student inactive** | `BorrowerResolver` still resolves them (so their history stays visible in reports), but `issueBook`/`renewBook` must **reject new issues/renewals** for any borrower whose resolved status is not in the active set (`ENROLLED`, `ACTIVE`). Existing issues are unaffected — an inactive student can still be chased for a return. |
| **Student alumni / dropped / transferred / archived** | Same as inactive: block new activity, never block visibility of past history. Alumni-with-an-outstanding-book is a real, expected state, not an error state. |
| **Staff onboarding** | Same as student admission — automatic via `BorrowerResolver`, no provisioning. |
| **Staff resignation** | Same shape as TC — `hasOpenObligations(STAFF, id)` should be a checklist item in the (existing, out-of-Library-scope) HR offboarding flow. |
| **Staff inactive / suspended** | Same block-new-activity rule as student inactive. |

**Architectural invariant:** Library never writes to `Student` or `Staff`, never listens for their lifecycle events to mutate its own data, and never needs a migration when HR/Admissions adds a new status value — it only needs its "active enough to borrow" predicate updated, which lives in `BorrowerResolver`, one function, one place.

---

## 3. Book Architecture — Catalog vs. Physical Copy

Confirming the chain, corrected to the real domain shape:

```
Book (catalog/title — tenant-scoped, branch-agnostic)
   │
   └── BookCopy (physical item — branch-scoped)
          │
          ├── status: AVAILABLE ⇄ ISSUED ⇄ RETURNED(→AVAILABLE)
          ├──          AVAILABLE → RESERVED_HOLD → ISSUED
          ├──          (AVAILABLE | ISSUED) → LOST
          ├──          (AVAILABLE | ISSUED-on-return) → DAMAGED
          ├──          DAMAGED → REPAIR → AVAILABLE
          └──          (LOST | DAMAGED) → DISPOSED   [terminal]
```

**Ownership decisions:**
- **`Book` is tenant-scoped, NOT branch-scoped.** A title's catalog metadata (title, ISBN, author, category) is the same fact regardless of which branch happens to own a physical copy — cataloging the same ISBN separately per branch is exactly the duplicate-ISBN defect the audit flagged (§1 of the prior audit). One catalog row per tenant per title; branches differ only in which `BookCopy` rows they hold.
- **`BookCopy` is branch-scoped (`branchId` required, not nullable).** This is where physical custody actually lives, and it's the entity the audit's B1/B2 findings were really asking for — putting `branchId` on `Book` (title) would have been the wrong fix; putting it on `BookCopy` is the correct one.
- **`BookIssue` references `copyId`, not `bookId`.** This is a structural fix, not just a field rename — it's what makes "which physical copy is out with which student" answerable at all (impossible today per the audit's Book Copy finding), and it's what makes the C1/C2 races closable with a single-row conditional update instead of an aggregate-counter race (see §17).

**Invariants to enforce (DB + service layer, not just convention):**
1. A `BookCopy` has exactly one status at a time from the enum above — no dual-state.
2. A `BookCopy` can have **at most one open (`status IN (ISSUED)`) `BookIssue`** at any time — enforced by a **partial unique index** (`@@unique([copyId], where: status = 'ISSUED' ...)` via a raw SQL partial index, since Prisma doesn't express partial uniqueness declaratively — add via a migration-level `CREATE UNIQUE INDEX ... WHERE status = 'ISSUED'`). This single constraint is what makes C1 (double-issue race) **impossible at the database level**, independent of any application-level lock — the right kind of fix, since app-level locks can be bypassed by a bug but a DB constraint can't.
3. `DISPOSED` is terminal — no transition out. Enforced in the service's transition-table (§7), not just by convention.
4. `Book.availableCount`/`Book.totalCount` (if kept for fast display) are **derived, cached rollups**, never the source of truth — `BookCopy` rows are the source of truth; the rollup is refreshed transactionally alongside any `BookCopy.status` write (same transaction, not a background job) to avoid the exact kind of drift the current single-counter design suffers from.

---

## 4. Multi-Tenant Ownership

Every aggregate in the frozen list carries `tenantId` — no exceptions, no aggregate inherits tenant scope only transitively through a parent FK (that was the original module's practice via `Book`→`BookIssue`, and it's fine as a *join convenience* but `tenantId` must still be a **direct column** on every table for query-planner and RLS-readiness reasons):

`Book`, `BookCopy`, `BookIssue`, `Reservation`, `Fine` (charge-request record), `Author`, `Publisher`, `Category`, `Rack`, `Shelf`, `InventoryAudit`, `InventoryAuditItem`, `DigitalAsset`, `BarcodeSequence`, `LibraryBranchSettings` — **all 15 tables, `tenantId` direct column, no exceptions.**

No missing tenant ownership found in this design — this was already the one thing the prior audit confirmed the *existing* code got right (§2 of the audit); the new aggregates simply need to inherit that same discipline, which this table makes explicit and reviewable.

---

## 5. Multi-Branch Ownership — Exact Decision Per Entity

This is the section that most needed a real decision instead of "add branchId everywhere":

| Entity | `branchId`? | Reasoning |
|---|---|---|
| Library (config) | Required | `LibraryBranchSettings` is *defined* as per-branch config — loan duration, fine rate, and max-books-per-borrower plausibly differ by campus. |
| Book (catalog) | **No.** | Deliberate — see §3. Catalog is shared; only physical copies are branch-owned. A tenant with 5 branches catalogs "Harry Potter" once, holds copies at whichever branches actually stock it. |
| BookCopy | **Required.** | The actual custody boundary. |
| Rack / Shelf | **Required.** | Physical furniture is inherently branch-local. |
| Issue (`BookIssue`) | **Required — denormalized from the copy at issue time**, not a live join. | A copy could theoretically be re-assigned to a different branch later (inter-branch transfer of stock, a real operational need for a school group); if `BookIssue.branchId` were a live join through `copyId → BookCopy.branchId`, historical issue records would silently "move" branches when a copy is transferred. Snapshotting `branchId` on `BookIssue` at creation time keeps history accurate no matter what happens to the copy afterward — same principle as the borrower snapshot in §2. |
| Inventory (`InventoryAudit`) | **Required.** | A stocktake is inherently a per-branch physical event — you audit the shelves in front of you, not the tenant's global catalog. |
| Reservation | **Required.** | A reservation is a claim against a branch's copy pool (see §8) — reserving "any copy of this title, anywhere in the tenant" is a different, more complex feature (inter-branch fulfillment/courier) that is explicitly **out of scope** for this freeze; flag as a future extension point, don't build it now. |
| Fine (charge-request) | **Required — inherited from the `BookIssue` it's generated against**, snapshotted for the same reason as Issue. | Needed so branch-level fine reports (spec §13) don't require a join through Issue for something that's fundamentally a branch-attributable fact. |
| Reports | **Filterable, not owned.** | Reports aren't an aggregate — every report query must accept an optional branch filter and, per the existing `StudentBillingAccessService` convention, **default to the caller's resolved branch-access set** (`null` = tenant-wide for owner/admin roles, `string[]` = restricted set for branch staff) rather than defaulting to "everything." Reuse that service's pattern directly rather than inventing a second branch-resolution convention for Library. |

**Branch isolation is complete under this design** — every entity that represents a physical or branch-attributable fact carries `branchId`; the one entity that deliberately doesn't (`Book`) is a considered exception with a stated reason, not an oversight.

---

## 6. Inventory Architecture

- **Stock = count of `BookCopy` rows per `(tenantId, branchId, bookId, status)`.** No separate "stock" table — it would be a second source of truth for the same fact `BookCopy` already holds. Where a fast count is needed for UI (catalog browse showing "3 available at this branch"), use the cached rollup from §3 (`Book`-per-branch materialized count, or a lightweight `BookBranchAvailability(bookId, branchId, availableCount)` rollup row maintained transactionally), never a `COUNT(*)` on `BookCopy` at request time for high-traffic paths.
- **Lost / Repair / Disposed** are `BookCopy.status` values (§3's state machine), not separate tables — they're states of the same physical item, not new kinds of entity.
- **Stock adjustment** (a librarian correcting a miscount, marking a copy found/lost outside the formal audit flow) is a **service operation**, not a new aggregate — it's `BookCopy.status` transition + a required reason code + `AuditService` entry (closing the audit's S5 finding structurally: every status transition, not just issue/return, must go through the audit-logged transition function).
- **Stock verification / Inventory audit / Reconciliation** = `InventoryAudit` (header: branch, date range, conductedBy, status `IN_PROGRESS`/`COMPLETED`) + `InventoryAuditItem` (one row per copy scanned: `expectedStatus` at audit start vs `scannedStatus`, `discrepancy: Boolean`). Reconciliation is the act of resolving each flagged discrepancy into a real `BookCopy.status` transition (found → back to `AVAILABLE`; missing → `LOST`) — the audit doesn't directly mutate `BookCopy`, it *proposes* transitions that go through the same transition function as everything else, so no shortcut bypasses the invariant checks in §3.
- **Approval workflow:** write-offs (`DAMAGED`/`LOST` → `DISPOSED`) and fine waivers (§9) require a role above the actor who flagged them — `LIBRARIAN` can flag/request, `SCHOOL_ADMIN`/`PRINCIPAL` must approve. Model this as a `status: PENDING_APPROVAL/APPROVED/REJECTED` on the transition request itself (reuse the same shape as the Finance module's existing approval patterns rather than inventing a new one) — do not let `LIBRARIAN` alone dispose of stock, that's an unaudited asset-write-off path otherwise.

---

## 7. Issue / Return — Full Lifecycle & Legal Transitions

**`BookIssue.status` enum:** `ISSUED, RETURNED, LOST, WRITTEN_OFF` (dropping `OVERDUE` as a persisted value — per the audit's §8 finding, this stays a **computed predicate** exactly like the Finance module's `OVERDUE` convention; persisting it was always going to drift out of sync with `dueDate`).

**`BookCopy.status` enum:** `AVAILABLE, RESERVED_HOLD, ISSUED, LOST, DAMAGED, IN_REPAIR, DISPOSED`.

### Legal transition table (enforced centrally in one `transitionCopyStatus()` function — no direct `prisma.bookCopy.update({status: ...})` call anywhere else in the codebase)

| From | To | Trigger |
|---|---|---|
| `AVAILABLE` | `RESERVED_HOLD` | Reservation auto-allocation (§8) |
| `AVAILABLE` / `RESERVED_HOLD` | `ISSUED` | `issueBook` |
| `ISSUED` | `AVAILABLE` | `returnBook` (copy in good condition) |
| `ISSUED` | `DAMAGED` | `returnBook` (copy flagged damaged at return) |
| `ISSUED` | `LOST` | `markLost` (borrower fails to return / reports loss) |
| `RESERVED_HOLD` | `AVAILABLE` | Hold expiry (§8) or cancellation |
| `DAMAGED` | `IN_REPAIR` | `sendToRepair` |
| `IN_REPAIR` | `AVAILABLE` | `repairComplete` |
| `IN_REPAIR` / `DAMAGED` / `LOST` | `DISPOSED` | Approved write-off (§6) |
| *(anything)* | *(anything not listed above)* | **Rejected** — the function throws, no silent no-op |

**Renewal** is not a `BookCopy` transition at all — it only touches `BookIssue.dueDate` (+`renewalCount`), and must check two things before allowing it: (a) `renewalCount < maxRenewals` (from `LibraryBranchSettings`), and (b) **no pending `Reservation` exists for this `Book` at this branch from a different borrower** (§8) — renewing past someone else's queued reservation is the concrete "illegal transition" a naive renewal implementation would allow.

**Replacement** (borrower pays to replace a lost/damaged copy) is a **Fine-side concern** (§9), not a Library-side status branch — Library's role ends at `LOST`/`DISPOSED`; whether the borrower is charged a replacement cost is resolved by the charge-request going to Billing, same as an overdue fine.

**Write-off** = the approved terminal transition to `DISPOSED` (§6) — not a separate aggregate.

---

## 8. Reservation — Workflow Design

**Scope decision:** a `Reservation` is a claim on `(tenantId, branchId, bookId)` — "next available copy of this title at this branch" — not on a specific `BookCopy`. Reserving a specific copy makes no sense to a borrower (they don't know or care which physical copy they get) and would make the queue brittle (a copy going `DAMAGED` shouldn't cancel someone's place in line).

- **Queue / FIFO:** `Reservation.queuePosition` derived from `createdAt` ordering within `(tenantId, branchId, bookId, status='QUEUED')` — no manual priority field. Spec asked to "review priority rules": **decision is strict FIFO, no role-based priority** (a `TEACHER` does not jump a `STUDENT`'s queue) — this is a fairness/trust call for a school library, flag as a product decision if leadership wants to override, but the default should not silently favor staff.
- **Auto-allocation:** triggered off the same event that fires on `returnBook` (and on new-copy `createBookCopy` for a title with an open queue) — via `EventOutbox` (`BookCopyBecameAvailable` event), not a synchronous check inside `returnBook` itself. This keeps `returnBook`'s transaction small and reuses the platform's existing outbox pattern instead of inventing an inline side-effect chain. The outbox consumer: finds the oldest `QUEUED` reservation for that `(branchId, bookId)`, transitions the copy `AVAILABLE → RESERVED_HOLD`, sets `Reservation.status = READY_FOR_PICKUP`, sets `holdExpiresAt = now + holdWindow` (from `LibraryBranchSettings`), and enqueues a notification (§15).
- **Expiry:** a scheduled job (or lazy check on next relevant read, consistent with how `OVERDUE` is computed lazily elsewhere) flips `READY_FOR_PICKUP` past `holdExpiresAt` back to `AVAILABLE` on the copy and re-triggers allocation for the next-in-queue — same outbox event, same consumer, no special-cased code path.
- **Cancellation:** borrower- or staff-initiated, allowed any time before `ISSUED`; if cancelled while in `READY_FOR_PICKUP`, must also release the copy hold and re-trigger allocation (same path as expiry).
- **Notification:** "reservation available" fires from the outbox consumer, not from the request handler — see §15, this keeps notification delivery from blocking the transactional part of allocation.
- **Renewal interaction:** covered in §7 — a queued reservation blocks renewal for the current holder, one direction only (a reservation never *interrupts* an already-issued loan early; it only blocks extending it).

---

## 9. Fine Architecture — Library Does Not Hold Money

**This is the load-bearing decision of the whole document, stated precisely:**

Library **generates charge requests**. It never stores a payable balance, never records a payment, never issues a receipt, never processes a refund, and never maintains a ledger. All of that is Student Billing's job, unconditionally.

### What Library owns
`Fine` (better named `LibraryChargeRequest` — keeping "Fine" as the label since that's the domain term, but architecturally it is a **charge-request record**, not a financial instrument):

```
LibraryChargeRequest {
  id, tenantId, branchId
  issueId               // the BookIssue this arose from
  borrowerType, borrowerId
  reason                // OVERDUE | LOST | DAMAGED
  computedAmount         // Library's own computation — see below
  billingStatus          // PENDING | SENT_TO_BILLING | BILLED | WAIVED | CANCELLED
  billingReferenceId     // the Invoice/InvoiceItem id once Billing accepts it — opaque to Library
  createdAt
}
```

### What Library does NOT own (explicitly, to prevent duplication)
Receipts, refunds, payment history, ledger entries, accounting postings, `amountPaid`, `finePaid` (today's field is a Library-side write-only flag that should never have existed — it's exactly the kind of duplicate state this design removes) — all of it lives only in Student Billing's `Invoice`/`InvoiceItem` (and, per the frozen Finance architecture in this repo, eventually the `StudentAccount`/`Charge` abstraction once that lands).

### The integration, concretely
1. Fine amount is **computed by Library** (overdue days × per-day rate, or a flat lost/damaged replacement cost) from `LibraryBranchSettings` — Library needs to know the *rule* to know when to raise a charge at all, but that computed number is a **proposal**, not a debt.
2. Library emits a domain event (`EventOutbox`, same pattern as everywhere else in this repo) — `LibraryChargeRequested { tenantId, branchId, borrowerType, borrowerId, amount, reason, sourceIssueId }`.

   **This event is the entire integration contract, and it is one-directional by design:** Library publishes `LibraryChargeRequested` to its own `EventOutbox` and stops — it does not call into Student Billing, does not know Billing's internal models (`Invoice`, `InvoiceItem`, or the in-progress `Charge`/`StudentAccount` abstraction), and does not block or fail if Billing is slow or temporarily down (the outbox retry/backoff already handles that, same as every other producer in this repo). Student Billing owns writing its own consumer for this event, on its own schedule — that consumer is Billing's responsibility to build, not something Library's roadmap depends on landing first. The only thing Library expects back, asynchronously and optionally, is a `billingReferenceId` correlated by `sourceIssueId`/the event's own id, used solely to populate `LibraryChargeRequest.billingStatus` for Library's own operational tracking (§9 rule 4) — if that correlation never arrives, Library's own state simply stays `SENT_TO_BILLING`, which is a legitimate, non-blocking state, not an error.
3. Student Billing consumes that event and creates the actual billable line item on its side (an `InvoiceItem`, or the future `Charge` against `StudentAccount`) — **Billing decides** how that surfaces to the payer (bundled into the next invoice, a standalone charge, whatever Billing's own rules say); Library has no opinion and no visibility into that decision beyond the `billingReferenceId` it gets back.
4. `LibraryChargeRequest.billingStatus` becomes a **read-only projection** of what Billing reports back (via a corresponding inbound event or a query call) — `BILLED` once Billing confirms, nothing more granular than that on the Library side (no "partially paid," no "overdue on the fine itself" — that's Billing's own overdue-invoice logic, already built).
5. **Waivers**: if a request hasn't been sent to Billing yet (`PENDING`), Library can simply cancel it locally (`WAIVED`, staff-approved per §6's approval-workflow shape). If it's already `BILLED`, Library **cannot** waive it directly — it must ask Billing to issue a credit note / waiver through Billing's own existing waiver mechanism (reuse whatever `student-billing`'s `refund.service.ts`/discount mechanism already does for this exact case — do not build a second waiver path in Library that writes to `Invoice`).
6. **Borrower-facing fine status** shown in Student/Parent Portal (§14) is **fetched from Billing**, not from Library's own `billingStatus` field, for anything post-`SENT_TO_BILLING` — Library's field exists for Library's own operational tracking ("did we already ask Billing for this"), not as the source of truth a portal should read for "how much do I owe."

This closes the loop the spec asked about cleanly: Library is the **fact source** ("this book was overdue by 4 days, here's the rule-computed amount"), Billing is the **money owner** end to end. No duplicated payment/receipt/refund/ledger logic anywhere in Library.

---

## 10. Search Architecture

- **Primary search surface** is `Book` (catalog) joined to a **maintained availability rollup** (§3/§6) for the "available near me" facet — never a live `COUNT` on `BookCopy` per search result row.
- **Text fields** (title, author name via `BookAuthor` join, publisher name): Postgres full-text (`tsvector` generated column + GIN index) or trigram (`pg_trgm` + GIN) for partial/typo-tolerant match — either is a real improvement over the audit's finding (in-memory filter over the full tenant catalog); trigram is the simpler operational choice if the team hasn't stood up `tsvector` maintenance elsewhere in the repo yet — check before choosing, don't introduce a second full-text strategy if one already exists in this platform.
- **Structured filters** (ISBN, barcode, category, rack, shelf, branch, availability, language): plain B-tree indexes, composite where they're commonly combined — at minimum `(tenantId, branchId, categoryId)` and `(tenantId, barcode)` (unique) on `BookCopy`.
- **Barcode lookup** (scan → resolve copy) is a **single indexed point lookup** (`BookCopy.barcode` unique index), never a search-ranked query — treat it as a different code path from free-text search entirely, since it has a completely different performance profile (must be near-instant for a physical scan-and-issue workflow, §17).
- **Keywords**: fold into the same `tsvector`/trigram field as title/author rather than a separate keyword table, unless a real tagging requirement (librarian-curated tags, not auto-extracted) shows up — don't build a tag system speculatively.

---

## 11. Digital Library

`DigitalAsset(id, tenantId, bookId, branchId?, type, storageRef, sizeBytes, durationSeconds?, accessMode, createdAt)`:
- `type`: `PDF | EBOOK | AUDIO | VIDEO | ATTACHMENT`.
- `branchId` **nullable** — a digital asset is naturally tenant-wide (no physical custody constraint), unless the school explicitly licenses content per-campus, which is a real but secondary case — keep nullable so tenant-wide is the default and branch-restriction is opt-in, not the reverse.
- `storageRef`: opaque pointer to wherever the platform already stores binary assets (documents module already exists — `Document` relation is visible on `Staff`; **reuse that existing document-storage infrastructure rather than building a second file-storage path for Library**).
- **Download permissions**: role + borrower-relationship gated (a student can access assets for books they're currently issued *or* that are tenant-wide "open" reference material — model as `accessMode: OPEN | ISSUE_REQUIRED`), enforced server-side at the signed-URL-issuance endpoint, never by hiding a direct storage URL client-side.
- **Expiry**: signed URLs are short-lived (minutes), independent of any `Reservation`/`BookIssue` expiry — a digital "loan" window (if the product wants time-boxed ebook access) is a separate `DigitalAssetGrant(assetId, borrowerType, borrowerId, expiresAt)` join, not reuse of the physical `BookIssue` model — physical and digital lending have different lifecycles and shouldn't share a state machine.
- **Streaming**: for `AUDIO`/`VIDEO`, issue range-request-capable signed URLs from storage rather than proxying bytes through the API server.
- **DRM readiness**: don't build DRM now — but keep the architecture DRM-*compatible* by never exposing a permanent public URL (always signed/short-lived), and by keeping `storageRef` opaque so a future DRM-wrapping layer can sit between `DigitalAsset` and the actual file without a schema change.

---

## 12. Barcode / RFID

- **Generation**: `BarcodeSequence(tenantId, branchId, year, lastNumber)` — identical shape to the existing `InvoiceSequence`/`ReceiptSequence` pattern (§1) — same atomic-increment discipline (advisory lock or `UPDATE ... RETURNING` in one statement) applies, since this is the exact same "generate a gapless-enough sequential human-readable number safely under concurrency" problem Finance already solved.
- **Format**: tenant/branch-prefixed human-readable code (e.g. `BR01-2026-000123`) encoded into a standard barcode symbology (Code128) for printing — the printed barcode encodes the same string stored in `BookCopy.barcode`, no separate internal-vs-printed mapping table needed.
- **Printing**: a stateless render/export concern (label PDF generation) — not a persisted entity; no `BarcodeLabel` model needed.
- **Scanning**: resolves via the single indexed point-lookup described in §10 — the scan endpoint's whole job is `barcode → copyId → current status`, must stay a single indexed query, no joins beyond what's needed to render the issue/return screen.
- **RFID readiness**: model as **an additional optional identifier**, not a barcode replacement — `BookCopy.rfidTag: String? @unique`. When RFID hardware arrives, the same resolution service just tries `rfidTag` first / `barcode` fallback; no schema change needed then, which is the actual meaning of "RFID readiness" — the readiness is in the field being reserved now, not in any RFID logic being built now.
- **Bulk scanning / inventory scanning**: batches of `(barcode/rfid, scannedAt)` pairs submitted as a batch to the `InventoryAuditItem` creation endpoint (§6) — no separate bulk-scan aggregate, it's a bulk-insert into the audit's line items.

---

## 13. Reporting

All reports are **query surfaces over the aggregates above**, not separate stored entities — listing what's needed, not modeling anything new:

Books catalog · Inventory by status/branch · Issues (active/historical) · Returns · Reservations (queue depth, fulfillment time) · Lost/Damaged register · Popular books (derived: issue-count over a window, per book) · Never-issued (derived: `Book`s with zero `BookIssue` history — a genuinely useful acquisition-review report) · Fine reports (Library's own `billingStatus` view, cross-referenced to Billing's real amounts via `billingReferenceId`, not duplicated) · Branch reports (every report above, filtered per §5's branch-access convention) · Class/Teacher/Student reports (join through `BorrowerResolver`, not a stored denormalization, except where a snapshot already exists on `BookIssue`/`LibraryChargeRequest` for historical accuracy) · Exports (CSV, generated from the same query paths, not a separate export-specific data model).

**Architectural requirement, not a new entity:** every list-shaped query above must support cursor pagination and a bounded default page size — this closes the audit's P-b/§10 "silent truncation" finding structurally, by making pagination part of the query contract for every report from day one rather than retrofitted per-endpoint later.

---

## 14. Portals — Data-Shape Requirements (not new entities)

- **Student Portal**: `borrowerType=STUDENT, borrowerId=self` view over `BookIssue` (current + history), `Reservation` (own queue position), `LibraryChargeRequest.billingStatus` **plus a live pass-through to Billing** for the actual owed amount (§9's rule 6) — never Library's own stale/partial number as the headline figure.
- **Parent Portal**: same shape as Student Portal but `borrowerId` resolved through the existing `GuardianStudent` link (reuse `StudentBillingAccessService`'s guardian-ownership resolution pattern directly — do not write a second ownership-check implementation for Library; this is precisely the IDOR class of bug the prior audit's R3 finding flagged, and the fix is "use the pattern that already exists," not "invent a Library-specific one").
- **Teacher Portal**: `borrowerType=STAFF, borrowerId=self` — borrowed books, renewals. No visibility into student borrowing unless the teacher is also acting in an explicit staff-administrative capacity (that's a `LIBRARIAN`/`SCHOOL_ADMIN` role concern per RBAC, not a Teacher-portal concern) — a homeroom teacher does not get a students'-fines view through the Teacher Portal by default.

---

## 15. Notification Architecture

Reuse the existing `notifications` module (`Notification` model, `NotificationChannel`, dispatcher/preferences/history services already in this repo) — **no new notification infrastructure**. Library's job is only to be a correct **event producer**:

| Trigger | Event → Notification |
|---|---|
| Issue | `BookIssued` |
| Due reminder | scheduled job scanning `dueDate` window (T-2 days, configurable via `LibraryBranchSettings`), not a persisted "reminder" entity |
| Overdue | first-crossing of `dueDate` (computed predicate, §7) triggers one notification, not a repeating one per day unless explicitly configured |
| Reservation available | fired from the outbox consumer in §8, not the request handler |
| Lost | on `markLost` transition |
| Fine generated | on `LibraryChargeRequested` emission (§9) — content should say "a charge request was raised," and once `billingStatus` becomes `BILLED`, the *amount-owed* notification should come from **Billing's own notification path** (it already sends payment-related notifications) — Library should not send a second, potentially-inconsistent "you owe ₹X" message. |
| Channel (Email/SMS/WhatsApp/Push) | Delegated entirely to existing `NotificationPreferencesService`/`NotificationDispatcherService` — Library never picks a channel itself, it only decides *that* and *what* to notify. |

All of the above are `EventOutbox` entries consumed by the existing notification pipeline — consistent with how every other module in this repo triggers notifications, and it's what keeps Library's own transactions small (issue/return/mark-lost don't block on notification delivery).

---

## 16. Security — Architecture-Level Only

(Not repeating the prior audit's specific findings — only the ownership shape a correct architecture must guarantee, which the prior audit couldn't fully evaluate because these aggregates didn't exist yet.)

- **Tenant ownership**: direct `tenantId` column on all 15 tables (§4) — no aggregate relies on a transitive join to establish tenant scope.
- **Branch ownership**: explicit, entity-by-entity decision table (§5) rather than a blanket "add branchId everywhere" — this is what makes it *auditable* going forward: a reviewer can check this table against the schema, not guess at intent.
- **Borrower ownership**: resolved through the single `BorrowerResolver` (§2) and, for parent access specifically, through the **existing** `GuardianStudent`-based ownership pattern (§14) — one ownership-resolution mechanism, reused, not reinvented per portal.
- **Staff ownership**: `BookIssue`/`Reservation` with `borrowerType=STAFF` follow the same resolver and the same active/inactive gating (§2) — staff are not a security-exempt path just because they're not "students."

---

## 17. Performance

- **Indexes**: `BookCopy(tenantId, branchId, status)` composite (drives the availability/inventory views), `BookCopy.barcode` unique, `BookCopy.rfidTag` unique-nullable, `BookIssue(tenantId, branchId, status, dueDate)` composite (drives overdue + branch reports in one index instead of the current single-column `tenantId` index), `Reservation(tenantId, branchId, bookId, status, createdAt)` composite (drives FIFO queue resolution directly from an index scan, no sort step).
- **Pagination**: cursor-based, mandatory on every list endpoint per §13.
- **Search**: per §10 — pushed into SQL with proper indexes, not in-memory filtering (structurally fixes the prior audit's T1/P-a finding, since the new `Book`/`BookCopy` split also makes "available copies at branch X" a direct indexed rollup lookup instead of the old aggregate-count field).
- **Barcode scan performance**: single point lookup on a unique index (§10/§12) — should be sub-10ms regardless of catalog size; this is the one path in the whole module with a hard latency expectation (a librarian standing at a desk scanning books), worth calling out explicitly as a perf SLO to test against, not just an implicit assumption.
- **Large inventory support**: the `Book`/`BookCopy` split itself is the scalability fix — a tenant with 50,000 physical copies across 5 branches no longer means 50,000 rows each independently racing on one counter (today's design); it means 50,000 independently-locked rows, which is exactly the concurrency profile Postgres handles well.
- **High concurrency**: closed structurally by the partial unique index in §3 (invariant 2) for issue/return, plus the same advisory-lock discipline the Finance module already established for anything that still needs read-then-decide-then-write (barcode-sequence generation, §12; reservation allocation, §8).

---

## 18. Final Prisma Architecture Review

- **Relations**: `BookCopy.bookId → Book`, `BookIssue.copyId → BookCopy`, `BookAuthor` join table (`bookId`+`authorId` composite PK), `Shelf.rackId → Rack`, `DigitalAsset.bookId → Book`, `InventoryAuditItem.auditId → InventoryAudit` + `InventoryAuditItem.copyId → BookCopy`. `BookIssue`/`Reservation`/`LibraryChargeRequest` have **no FK relation** to `Student`/`Staff` (by design, §2) — `borrowerType`/`borrowerId` stay as plain columns, resolved at the service layer, not the DB layer.
- **Cascade**: `BookCopy → Book` should be `RESTRICT` (can't delete a catalog title with copies still in circulation — mirrors the existing `BookIssue → Book` `RESTRICT` the audit found and confirmed correct). `Shelf → Rack` `RESTRICT` similarly. Everything referencing `BookCopy`/`Book` for historical record (`BookIssue`, `LibraryChargeRequest`) should never cascade-delete — history is append-only, matching the soft-delete convention below.
- **Indexes**: per §17.
- **Unique constraints**: `BookCopy.barcode` (per tenant — `@@unique([tenantId, barcode])`), `BookCopy.rfidTag` nullable-unique, `Book(tenantId, isbn)` **not unique** (deliberately — different editions legitimately share nothing but an ISBN prefix in some cataloging practices; dedupe is a librarian curation action, not a DB constraint) but indexed for search, and the **partial unique index** from §3 invariant 2 (`copyId` unique where `status='ISSUED'`) — this one is not optional, it's the structural fix for the audit's C1 finding.
- **Composite indexes**: covered in §17.
- **Soft delete**: `deletedAt` on `Book`, `BookCopy`, `Rack`, `Shelf`, `Author`, `Publisher`, `Category` (catalog/config-shaped entities that can be "removed" from active use) — but **never** on `BookIssue`, `Reservation`, `LibraryChargeRequest`, `InventoryAudit`/`Item` (event/history-shaped entities are append-only by nature; "deleting" a historical issue record is a data-integrity bug waiting to happen, not a feature).
- **Enums**: `BorrowerType`, `BookCopyStatus`, `BookIssueStatus` (trimmed per §7), `ReservationStatus` (`QUEUED, READY_FOR_PICKUP, FULFILLED, CANCELLED, EXPIRED`), `ChargeReason` (`OVERDUE, LOST, DAMAGED`), `BillingStatus` (`PENDING, SENT_TO_BILLING, BILLED, WAIVED, CANCELLED`), `DigitalAssetType`, `AccessMode`. Every enum's dead-value discipline from §7 applies here too — no value gets added to an enum until a real transition writes it.

---

## 19. Implementation Roadmap — Ordered by Dependency

**Phase 1 — Foundation (no functional behavior change yet, pure schema + config)**
1. `Category`, `Author`, `Publisher`, `Rack`, `Shelf`, `LibraryBranchSettings` — no dependencies on anything else, can land first and in parallel.
2. `Book` (redefined, catalog-only) — depends on `Category`/`Author`/`Publisher` existing (FKs), migrate existing `Book` rows to drop `totalCopies`/`availableCopies`/free-text `author`/`location`.

**Phase 2 — Physical inventory core (the load-bearing phase)**
3. `BookCopy` + `BarcodeSequence` — depends on `Book` (Phase 1) and `Shelf`/`Rack`. Backfill: one `BookCopy` per unit of `totalCopies` on every existing `Book` row, migration script required (this is the highest-risk single migration in the roadmap — needs a dry-run/verification step against the current `availableCopies` counts before cutover).
4. `BookIssue` re-pointed to `copyId` (was `bookId`) + `BorrowerType`/borrower snapshot fields + the partial unique index (§3 invariant 2) — depends on 3. This is where C1/C2 from the prior audit actually get closed, not before.
5. Issue/return service rewrite against the new transition function (§7) — depends on 4.

**Phase 3 — Extended lifecycle (depends on Phase 2 being live and stable)**
6. `Reservation` + the `EventOutbox`-driven auto-allocation consumer (§8) — depends on 3/4/5 (needs real copy-status transitions to hook into).
7. `InventoryAudit` + `InventoryAuditItem` — depends on 3 (needs copies to audit against).
8. Renewal logic (extends 5) — depends on 6 (needs reservation-blocking check to be meaningful).

**Phase 4 — Money boundary (can start in parallel with Phase 3 once Phase 2 is stable)**
9. `LibraryChargeRequest` + the `LibraryChargeRequested` outbox event + Student Billing's consumer-side handling — depends on 4/5 (needs real `BookIssue` overdue/lost states to compute against) and requires **Student Billing team/session coordination**, since half of this integration lives outside the Library module's own codebase.

**Phase 5 — Digital & discovery (independently deployable, lowest coupling to the rest)**
10. `DigitalAsset` (+ `DigitalAssetGrant` if time-boxed lending is in scope) — depends only on `Book` (Phase 1), can be built any time after Phase 1 with no dependency on Phase 2/3/4 at all.
11. Search indexing (`tsvector`/trigram, composite indexes from §17) — depends on Phase 1/2 schema being final, since adding generated columns/indexes mid-migration is wasted work.

**Phase 6 — Surfaces**
12. Reporting endpoints (§13) — depends on everything they report on; build incrementally per report as its underlying data lands, not as one big-bang deliverable.
13. Portal views (§14) — depends on the `BorrowerResolver` (build alongside Phase 2, it's needed by issue/return itself) and, for Parent Portal specifically, the reused `StudentBillingAccessService`-pattern ownership check.
14. Notification wiring (§15) — thin, can be added incrementally per event as each phase's events start firing; not a phase-blocking dependency for anything else.

**Test coverage** (per the accepted audit's P0 finding) is not a separate phase — every phase above ships with its own tenant/branch/concurrency/ownership test coverage as a merge requirement, following the `late-fee.service.spec.ts`/`invoice.service.authz.spec.ts` pattern already established in this repo, not retrofitted afterward.

---

## 20. Freeze Review

**A) APPROVED FOR IMPLEMENTATION**

Disposition of the three items raised in the previous review round:

1. **`ASSISTANT_LIBRARIAN`** — reclassified from blocker to **platform enhancement**. Library's RBAC (§16) is implemented against the roles that exist today (`LIBRARIAN` and above); if/when `ASSISTANT_LIBRARIAN` is added to `UserRole` at the platform level, it slots into the same `@Roles()` grants `LIBRARIAN` already has — no Library schema or service change required when it lands. Tracked as a follow-up, does not gate any phase in §19.
2. **Student Billing integration** — resolved as an **explicit, one-directional contract**, not a dependency on Billing's internals: Library publishes `LibraryChargeRequested` to `EventOutbox` and considers its own job done (§9, rule 2). Student Billing consumes it on its own timeline. Phase 4 (§19) can proceed on schedule regardless of where Billing's own `Charge`/`StudentAccount` work stands — Library's producer-side contract is complete and self-contained either way.
3. **Reservation branch scope** — confirmed **single-branch only**, as designed in §8. Inter-branch reservation/fulfillment is explicitly out of scope and deferred to a future extension; it does not block Phase 3 or any other phase in §19.

This document is the final implementation blueprint for the SchoolOS Library module.
