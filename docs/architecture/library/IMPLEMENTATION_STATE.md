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

## Phase 2 — Physical inventory core — **NOT STARTED**
`BookCopy`, `BarcodeSequence`, `BookIssue` re-pointed to `copyId` + borrower snapshot fields, partial unique index closing the issue/return race, issue/return service rewrite. Depends on Phase 1 (this commit) for `Rack`/`Shelf`/`BookCategory`/`Publisher` to exist as FK targets.

## Phase 3–6 — **NOT STARTED**
Per roadmap §19, unchanged.
