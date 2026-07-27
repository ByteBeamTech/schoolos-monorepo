# IMPLEMENTATION_STATE.md — Library (ADR-LIB-001)

*Tracks what's actually landed against the frozen roadmap in `LIBRARY_DOMAIN_ARCHITECTURE_FREEZE.md` §19. No architecture content here — that document is authoritative and is not modified by implementation work.*

---

## Phase 1 — Foundation (schema + config) — **DONE**

**Landed this commit:**
- `BookCategory` (named to avoid a real collision with the pre-existing `enum Category` used by `Student.category` — see Implementation Note below), `Author`, `Publisher`, `BookAuthor` (join), `Rack`, `Shelf`, `LibraryBranchSettings` — all new, all additive.
- `Book.categoryId` / `Book.publisherId` (nullable) + `Book.category` / `Book.publisherRecord` / `Book.authors` relations — additive only.
- `Branch` back-relations (`libraryRacks`, `libraryBranchSettings`) added per this repo's existing "back-relations mandatory for validation" convention on that model.
- Migration: `backend/prisma/migrations/20260726120000_library_phase1_catalog_taxonomy/`.

**Deliberately NOT done in this phase** (roadmap explicitly scopes Phase 1 as "no functional behavior change yet, pure schema + config" — §19):
- No new controllers, services, or DTOs. These tables are inert until a later phase's service layer consumes them.
- No cutover of `Book.author`/`Book.publisher` (free text) to the new `Author`/`Publisher`/`BookAuthor` relations, and no backfill script yet. The old free-text columns are untouched and still fully load-bearing for the existing `library.controller.ts`/`library.service.ts` — **zero behavior change to the running module.**
- `LibraryBranchSettings` rows are not seeded/provisioned — the design is "create on demand with sane defaults," not eager-provisioned per branch; a provisioning path belongs to whichever phase first reads these settings (Phase 2's issue/return duration lookups, most likely).

### Implementation note (sequencing decision, not an architecture change)

The frozen roadmap's Phase 1 description says Book is "redefined, catalog-only... migrate existing Book rows to drop `totalCopies`/`availableCopies`/free-text `author`/`location`." That drop is **deferred to Phase 2** in this implementation, for one reason: dropping those columns now, before `BookCopy` exists to replace what they do, would break the currently-running `createBook`/`issueBook`/`returnBook` code path in this same commit with no replacement — a straight regression, not a phased rollout. Per implementation rule 4 ("keep backward compatibility whenever possible") and rule 3 ("do not modify future phases" — i.e. don't reach into Phase 2's `BookCopy` work to make Phase 1's drop safe), the correct sequencing is: add the new relations now (this commit), cut the service layer over to `BookCopy` in Phase 2, drop the now-dead free-text/counter columns in that same Phase 2 migration once nothing reads them. This does not change any aggregate, boundary, or ownership rule in the frozen ADR — it only reorders *within* Phase 1 vs. Phase 2 which migration removes the deprecated columns. Flagging explicitly per implementation rule set, not silently deviating.

A second, unplanned deviation was also required: the ADR's Phase 1 listing names the taxonomy aggregate "Category." The schema already has an `enum Category` (`Student.category` — GENERAL/OBC/SC/ST reservation category, `enums.prisma`). Naming the new model `Category` would have been a hard Prisma namespace collision (models and enums share one namespace) and would not have compiled. Implemented as `BookCategory` instead — same aggregate, same fields, same relations the ADR describes, name only.

## Phase 2 — Physical inventory core — **DONE**

**Landed this commit:**
- Schema: `BookCopyStatus`, `BorrowerType` enums added; `BookIssueStatus` trimmed to `ISSUED/RETURNED/LOST/WRITTEN_OFF` (`OVERDUE` stays a computed predicate per ADR §7/§8, never persisted; `DAMAGED` moved to `BookCopy.status`). `BookCopy`, `BarcodeSequence` models added. `Book` stripped of `author`/`publisher`/`subject`/`totalCopies`/`availableCopies`/`location` (all fully superseded now). `BookIssue` re-pointed to `copyId`, polymorphic `borrowerType`/`borrowerId` with point-in-time snapshot fields (`borrowerNameSnapshot`/`borrowerBranchIdSnapshot`/`borrowerDisplayIdSnapshot`), `renewalCount`, `returnedBy`.
- Migration `20260727090000_library_phase2_bookcopy_core`: full cutover in one pass (this app is pre-production, see the migration's own header note) — enum swap, new tables, backfill of `BookCopy` from `Book.totalCopies`, backfill of `Author`/`Publisher`/`BookCategory` from the legacy free-text columns (deferred here from Phase 1 as planned), two-step copy-to-issue matching (open issues get a unique copy first, closed history issues cycle through the book's copies afterward), a `RAISE EXCEPTION` guard against any row the backfill couldn't match, and finally the **partial unique index** `BookIssue_copyId_open_issue_key` (`WHERE status = 'ISSUED'`) — the structural, DB-level fix for the audit's C1 double-issue race. This index cannot be expressed in `schema.prisma` (Prisma has no partial-index attribute); it is documented with a NOTE on the `BookCopy` model so it isn't lost to a future `prisma db pull`/`migrate dev`.
- `BorrowerResolverService` (`services/borrower-resolver.service.ts`) — the single place that resolves `(tenantId, borrowerType, borrowerId)` against `Student`/`Staff`, per ADR §2. No `LibraryMember`.
- `BookCopyService` (`services/book-copy.service.ts`) — the single `transitionCopyStatus()` gate (enforces the ADR §7 legal-transition table, writes an `AuditService` entry on every transition per ADR §6) and `generateBarcode()` (reuses the `InvoiceSequence`/`ReceiptSequence` advisory-lock-sequence pattern).
- `LibraryService`/`LibraryController`/DTOs rewritten: `createBook` (catalog-only, with legacy-shaped convenience fields — see note below), `addBookCopy`, `issueBook`/`returnBook`/`markLost` against `BookCopy` with advisory-lock + partial-unique-index defense in depth, `listBooks`/`stats`/`overdueList`/`listIssues`/`borrowerHistory` adapted to the new schema.
- Frontend `page.tsx` patched to match the new API contract (`borrowerNameSnapshot`, `copy.book`, catalog-only book form) — otherwise this phase would have shipped a backend the existing frontend couldn't talk to at all.

**Implementation decisions worth flagging explicitly (none change the frozen architecture):**

1. **Branch context reuse, not reinvention.** ADR §5/§16 call for branch-scoped write authorization on every mutation. Rather than building a second `resolveAuthorizedBranchIds`-style resolver (the Finance-module pattern the ADR's §14 cites, reserved for Phase 6's portal ownership work), Phase 2 uses `actor.branchId` directly — which `BranchContextMiddleware` has *already* resolved and authorized (from the `x-branch-id` header the frontend's `api-branch-interceptor.ts` sends automatically, validated against `AUTH-051/052/058`) before any Library code runs. Reusing that is `implementation rule 13` ("reuse existing infrastructure"), not a scope decision that needs revisiting later.
2. **`ReturnBookDto.fine` removed, not carried forward.** The pre-Phase-2 code let the caller directly set a fine amount on return (audit finding S7). Fine computation is explicit Phase 4 scope (`LibraryChargeRequest`) and doesn't exist yet, so there is nothing correct to compute in Phase 2 — carrying the old client-settable field forward would have re-shipped a known security/business-logic gap for no reason. Removed instead of stubbed.
3. **`CreateBookDto` keeps legacy-shaped convenience fields** (`authorName`/`publisherName`/`categoryName`/`initialCopies`) alongside the ADR-preferred `*Id` fields, so the existing "Add book" frontend form keeps working without a new picker UI (that UI is Phase 6 scope). `LibraryService.createBook()` resolves-or-creates the matching `Author`/`Publisher`/`BookCategory` row from the free text rather than storing it as a string — same "one row per distinct name" rule the migration's own backfill used.
4. **`studentHistory`'s IDOR (audit R3/S1) is still open.** The endpoint was adapted to the new `borrowerType`/`borrowerId` shape so it keeps working, but no ownership check was added — that's explicit Phase 6 scope (reuses the `StudentBillingAccessService`-style guardian-ownership pattern per ADR §14) and doing it piecemeal here would mean building it twice.
5. **Advisory lock form:** found an explicit TODO in `late-fee.service.ts` warning that this codebase's `pg_advisory_xact_lock` call sites all use the **single-argument** form today (not the two-argument namespaced form the FEE-1 record apparently aspired to), and that mixing forms silently creates non-conflicting lock spaces. `BookCopyService.lockKeyForCopy()` matches the single-argument form / rolling-hash key derivation used by `RefundService`/`LateFeeService`, deliberately, per that TODO's own warning.

## Phase 3–6 — **NOT STARTED**
Per roadmap §19, unchanged.
