# SESSION-HANDOFF-FEE-0-FEE-1.md

*Written across two implementation sessions: the one that completed Epics
FEE-0 and FEE-1, and a short follow-up that hardened AuditService. Purpose:
let a new session resume without access to either conversation.
The REPOSITORY is the source of truth — every claim below is verifiable with
`git log`, and commit messages were written to carry the reasoning, not just the
change.*

---

## 1. Where the work stands

- **FEE-0 (Security Hardening): complete**, except `INV-12` (late-fee cron is
  still an unscoped global sweep), which the backlog itself assigns to
  FEE-2/FEE-7. It is marked `it.todo` in
  `backend/src/modules/student-billing/student-billing.invariants.spec.ts` —
  deliberately not silently passing.
- **FEE-1 (Money Path Integrity): complete.** 12 commits.
- **AuditService hardening: first commit complete** (typed `action` + optional
  transaction support). See §8 — this is a small, deliberately scoped
  side-track, not part of FEE-1 or FEE-2, and it is NOT finished: ~12 call
  sites elsewhere in the codebase still cast `action` to `any`, left for a
  separate mechanical follow-up on purpose (do not fold that into this commit).
- **FEE-2 onwards: not started.**
- Test suite: 16 suites, 189 passing, 1 todo, 0 failing in `student-billing` +
  `common` (`npx jest src/modules/student-billing src/common`); see §9 for the
  full-backend numbers, which became knowable only after the Prisma-stub fix.
  For reference, before FEE-0 the module had 1 spec file and 6 tests.

## 2. The FEE-1 commits, in order

```
26fd2b4  DiscountCategoryProvisioningService + default category templates
a7f26a2  provision default discount categories on branch creation
b0d73a4  one-time backfill script for existing branches' discount categories
0294f3c  resolve DiscountCategory FK in create(), reject when unconfigured
9e6309e  restore over-refund protection and refund audit trail
6e24bd5  transactional, concurrency-safe refund initiation
7f9807a  no-hard-delete / no-soft-delete tripwire (IMM-009/010)
417a439  atomic, concurrency-safe payment confirmation
2f48bee  migration removing InvoiceStatus.EXPIRED (prerequisite)
3a75a8e  one receipt per payment, not per invoice
424d9e8  compare-and-swap state transitions (IMM-014..016)
ab8444f  stable idempotency key for offline payments (IMM-017/018)
```

Then, as a separate side-track (not a FEE-1 commit, not FEE-2):

```
0468647  refactor(audit): type AuditAction and accept a caller transaction
```

(SHAs are from the authoring environment; the server's differ because the
patches were applied with `git am` onto a different parent chain. Match by
subject line. `git log --format='%H %s'` on the server gives the real ones.)

Read the full message of any of these with `git show -s <sha>` — each records
what was broken, what was fixed, what was deliberately NOT changed and why, and
what remains open.

## 3. Decisions taken that later work must not silently reverse

These were explicit reviewed decisions, not implementation defaults.

1. **Concurrency: compare-and-swap, not `version` columns.** ADR-FEE-003 is
   mechanism-agnostic ("a version column is expected but not mandated"). Every
   remaining guarded mutation is a STATE TRANSITION, for which the swap
   predicate encodes the real business rule and is stricter than "nothing
   changed". Two aggregates (refund initiation, payment settlement) are already
   protected pessimistically with `pg_advisory_xact_lock`; a version column
   there would be a redundant second mechanism.
   **Version columns become necessary only when a mutable FIELD can be edited
   concurrently** (a lost update), which no path in `student-billing` does
   today. That is the trigger to revisit — e.g. when DRAFT-invoice editing is
   built.

2. **`DiscountCategory` is branch-managed configuration, never transactional
   data.** It is provisioned at branch creation and backfilled; it is NEVER
   created as a side effect of creating a discount. `DiscountService.create()`
   resolves `(branchId, code)` and rejects when absent.

3. **A `DiscountCategory` must BOTH exist AND be active** for a discount to be
   created against it. Documented in-code at the check. Do not relax to a bare
   existence check when category administration is built — otherwise `isActive`
   becomes a misleading no-op. The rule governs creation only; discounts
   already issued are never retroactively invalidated (`IMM-001`).

4. **One receipt per PAYMENT, many per invoice.** `Receipt.paymentId @unique` is
   the ownership key and must be preserved (`IMPLEMENTATION_HANDOFF.md` §10);
   `Receipt.invoiceId` must not be unique. `generateReceipt()` uses
   `findUnique({ paymentId })` deliberately — it fails to COMPILE if that
   `@unique` is ever removed.

5. **Offline payment idempotency is keyed on `gatewayPaymentId`**, backed by
   `UNIQUE (tenantId, invoiceId, gatewayPaymentId)`, with P2002 handled as the
   idempotent retry path (returns the already-recorded payment). A supplied
   cashier reference wins; otherwise the key is derived deterministically from
   the payment's business content. There is no timestamp fallback — one existed
   and made duplicates undetectable by construction.
   *Accepted trade-off:* two genuinely distinct payments with identical invoice,
   amount, method and date, submitted with NO reference, collapse into one
   record. Recording both requires a reference number.

6. **Backfills are scripts that bootstrap the Nest app context, not SQL data
   migrations.** Precedent: `src/scripts/backfill-licenses.ts`. Reasons: the
   provisioning service must stay the only writer of its entity, and IDs are
   `@default(cuid())`, which raw SQL cannot generate. UUIDs were explicitly
   rejected as off-standard.

7. **No shared abstraction for a single implementation.** A
   `BranchDefaultsProvisioner` interface was written and then removed on review:
   one implementation, zero consumers, and TypeScript interfaces cannot serve as
   Nest DI tokens anyway. Reusability is documented as a copyable shape
   (defaults-as-data → one owning service → transaction-joined write →
   idempotent), not as a contract.

## 4. Open cross-cutting tasks

1. ~~`AuditLogParams.action` typed `any`~~ — **DONE**, commit `0468647`. See §8
   for what shipped and what is still explicitly deferred (the `as any` casts
   at other call sites).

2. ~~`AuditService` cannot join a caller's transaction~~ — **partially done**,
   same commit. The capability exists; nothing uses it yet, and `IMM-022/023`
   are therefore still not actually satisfied for any mutation. See §8 for why
   wiring it in was deliberately not done alongside the typing change (it leads
   straight into the payment/outbox question, which was scoped out on purpose).

3. **`RefundService.initiate()` sets `actorRole: 'ACCOUNTANT'` hardcoded**
   rather than the real actor's role. Not money-affecting; still open.

4. **`docs/BACKLOG-ADDENDUM.md`** holds four more findings (BA-1 impersonation
   audit attribution, BA-2 students-module PARENT ownership gap, BA-3 the
   `EXPIRED` "never read anywhere" correction, BA-4 absent saas-billing tests).

## 5. Known-broken things FEE-2 will walk into

- **`StandardDiscountService.applyDiscount()` is broken and unreachable.** It
  writes `category:` (a scalar) where the schema has `categoryId` + a `category`
  relation, and omits required `branchId`, `academicYearId` and `appliedAmount`.
  It has no controller and no caller. FEE-2 wires up the controller-less
  services — **do not wire this one up before fixing it.**
- **Five services still have no HTTP surface**: `ReceiptService`,
  `RefundService`, `ReconciliationService`, `LateFeeService`,
  `StandardDiscountService`.
- **`ledger.service.ts` is a 0-byte stub.**
- **`InvoiceSequence` / `ReceiptSequence` tables exist and are used by nothing.**
- **The late-fee cron does an unscoped `invoice.findMany`** with no `tenantId`
  (`INV-12`, above).
- **`academicYearId` is set to the literal `'default'`** in some paths. Verified
  it is a plain `String` column with no `@relation`, so it is not a referential
  integrity bug. Left alone deliberately; revisit only if academic-year-specific
  discounts are introduced.
- A stray committed vim swap file: `backend/prisma/schema/.enums.prisma.swp`.

## 6. Working practices this session used (worth keeping)

- **Verify before changing.** Re-read the actual file at HEAD before editing it;
  do not trust any document's description of current state, including this one.
- **One logical commit at a time**, reviewed and approved before the next.
- Patches delivered as `git format-patch -1 HEAD --stdout`, applied with
  `git am`, and verified by applying onto a fresh clone and comparing trees.
- **Tripwire tests must be proven to fail.** Every structural/invariant test
  added here was confirmed failing against a deliberately injected violation
  before being accepted. A test that can only pass is worth nothing.
- **Environment limits were stated, not hidden.** `prisma validate` and
  `prisma migrate status` could not run in the authoring container
  (`binaries.prisma.sh` outside its network allowlist), and two module specs
  could not compile there (Prisma client generated without the query engine).
  Every commit message says so where it applies. **The reviewer's own run was
  the real verification** — and it caught a genuine schema error in `3a75a8e`
  (see §7).

## 7. Two things that went wrong, recorded so they are not repeated

1. **A one-to-one relation was broken from one side only.** Removing
   `@unique` from `Receipt.invoiceId` without changing `Invoice.receipt
   Receipt?` to `Receipt[]` is a P1012 schema validation error. It was invisible
   from the `Receipt` model alone, and the structural tests only read that model,
   so they passed while the schema was invalid. `prisma validate` caught it.
   The tripwire now asserts BOTH sides
   (`receipt-ownership.invariant.spec.ts`).
   **Lesson: when changing relation arity, always read both models.**

2. **Unauthored code appeared in the working tree three times** during the
   session (in `branch-context.middleware.ts`, and as complete draft
   implementations of two later commits). The first time it was mistakenly
   reported as pre-existing repository state — the claim "FEE-0 item 5 is
   already implemented" was false and was caught by a compile error on the
   reviewer's machine. After that, `git status` was checked before every commit
   and the later occurrences were caught and reverted.
   **Lesson: check `git status` is clean before trusting any inspection, and
   never adopt code you did not write.**

## 8. AuditService hardening — status and explicit boundary

This was scoped narrowly and deliberately, in response to a review question
about payment/audit transactional consistency. Read the full reasoning in
`git show -s 0468647` (or the equivalent commit on the server) before touching
this area again — it records a real architectural analysis, not just the code
change.

**What was decided and built:**
- `AuditLogParams.action` is now typed `AuditAction` (was `any`). This is the
  root cause of a recurring silent-failure bug class: an invalid action string
  is rejected by Prisma and swallowed by `AuditService.log()`'s own try/catch,
  so the audit row is silently never written. Fixed at least twice already
  (`RefundService`'s `REFUND_INITIATED`, FEE-1 commit `9e6309e`).
- `log()` and its four helpers (`logCreate`/`logUpdate`/`logDelete`/
  `logPayment`) now accept an optional transaction client, so a caller CAN
  write an audit row through its own transaction.
- **Behaviour is unchanged**: a write failure is still caught and logged, never
  rethrown, whether or not a transaction is supplied.
- `PrismaTransactionClient` moved from
  `discount-category-provisioning.service.ts` to
  `@infra/database/prisma-transaction.type.ts` now that it has a second
  consumer (re-exported from the old location for compatibility).
- 11 new tests; `AuditService` had none before.

**What was explicitly investigated and rejected for THIS commit — do not
silently reintroduce:**
- **Outbox-backed audit** was analyzed in depth (the repo already has a working
  `EventOutbox` + `OutboxWorker` pattern, used correctly by
  `saas-payment.service.ts`, and NOT used anywhere in `student-billing`). It
  would be the correct way to make `IMM-022/023` (transactional audit) fully
  true without risking payment data. It was NOT implemented here. Reason:
  `student-billing` payment settlement is synchronous, client-driven
  (`PARENT`-callable `verify-razorpay`), with no webhook, no gateway
  reconciliation and no retry path — so rolling back a DB transaction because
  an audit write failed would discard an already-captured payment with no
  recovery mechanism. That is a bigger, separate architectural problem
  (payment provider integration, reserved as `ADR-FIN-004`), and it should not
  be half-solved inside an AuditService change.
- **Throwing on audit failure inside a transaction** was considered and
  rejected for the reason above.
- **Wiring `tx` into any `student-billing` service** was explicitly NOT done.
  Nothing calls `AuditService.log(params, tx)` yet anywhere in the codebase.

**Immediate follow-up, explicitly deferred, NOT started:** roughly a dozen call
sites outside `AuditService` still write `action: 'X' as any`, which suppresses
the new type check at that site. All were verified valid against the enum at
the time of the audit commit. Removing the casts is mechanical but touches ~8
modules. **Keep it a separate commit** — the person explicitly asked for this
so the diff stays reviewable, regressions are easy to isolate, and `git
bisect` remains useful. Do not fold it into anything else.

## 9. A serious environment finding from the audit session — check this early

This container's generated Prisma client was, for the entire FEE-0/FEE-1
session, **a 3,989-byte placeholder stub** — not a real generated client.
Its entire content was `export declare const PrismaClient: any`, with zero
enums and zero models exported. `prisma generate` had always failed because
`binaries.prisma.sh` is outside the container's network allowlist
(`x-deny-reason: host_not_allowed`), and every attempt during the earlier
session silently produced/left that stub in place. This is why dozens of
commits in this session carried a note like "could not verify typecheck / this
suite could not compile here" — that caveat was accurate at the time it was
written, and should NOT be read as pointing to a real code problem in those
commits.

**It is fixable, and was fixed, with this workaround** (needs no network
access, and does not need a real database):
```bash
touch /tmp/fake_engine.so.node
printf '#!/bin/sh\nexit 0\n' > /tmp/fake_schema_engine && chmod +x /tmp/fake_schema_engine
export PRISMA_QUERY_ENGINE_LIBRARY=/tmp/fake_engine.so.node
export PRISMA_SCHEMA_ENGINE_BINARY=/tmp/fake_schema_engine
export PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
npx prisma generate
```
This makes the CLI stop trying to download the engine binaries; the client
GENERATOR does not actually need them to emit types and the runtime enum
consts. After this, `node_modules/.pnpm/@prisma+client@.../\.prisma/client/index.d.ts`
grows from ~4 KB to ~12.8 MB and exports every real enum and model type.

**Do this near the start of any new session that will touch typed Prisma
imports, migrations-adjacent code, or wants to run the full backend suite.**
After running it:
- `pnpm typecheck` on the whole backend goes from **159 errors to 0**.
- Suites that could never compile before now run: confirmed for
  `onboarding.service.spec.ts` and `school-management.service.spec.ts`
  (12/12 passing — this retroactively verifies FEE-1 commit `a7f26a2`, which
  had to be shipped with an unverified caveat).
- Full backend suite becomes runnable: 29 of 30 suites pass, 265 tests. The one
  failing suite, `feature-flags.service.spec.ts`, is **pre-existing and
  unrelated** — confirmed failing identically against pristine `origin/main`,
  last touched by an unrelated commit (`eda039d`). Do not attribute it to
  FEE-0/FEE-1/audit work, and do not "fix" it as a drive-by.

This does NOT give you a real database. `prisma migrate status`,
`prisma migrate deploy`, and anything touching actual data still needs the
reviewer's server, as before. It only fixes TYPE and CLIENT generation.

## 10. What a new session should do first

1. Confirm the repository state itself: `git log --oneline -15` and
   `git status`.
2. Run the Prisma-stub workaround in §9 if you'll touch typed Prisma imports,
   migrations, or want the full test suite runnable. Cheap, no network needed,
   large payoff.
3. Read the last few commit messages in full (`git show -s <sha>`) — they carry
   more reasoning than this summary.
4. Re-read `IMPLEMENTATION_RULES.md` and `IMPLEMENTATION_BACKLOG.md` (FEE-2)
   before writing code.
5. Decide the next unit of work: the deferred `as any` audit-cast cleanup
   (§8, mechanical, small, self-contained), or FEE-2. If FEE-2 comes first,
   remember it will itself add new `action:` call sites — worth doing the
   cleanup first so new code is written against the typed signature from day
   one, but this is the person's call, not a default to assume.
