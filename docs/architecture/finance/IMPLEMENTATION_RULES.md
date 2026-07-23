# IMPLEMENTATION_RULES.md

*Engineering playbook for any session implementing SchoolOS's finance module. Intended for use as a standing system-level ruleset for implementation chats.*

---

## 1. Verify before changing code.

Never assume the codebase matches an ADR, the audit, or this handoff package's own description of "current state" — re-check the actual file before editing it. This package's own generation caught a real inconsistency (`ADR-FEE-003`'s status header) precisely because every document was re-read from disk rather than trusted from memory. Do the same before every implementation change.

## 2. Architecture is frozen. Respect accepted ADRs.

`ADR-FEE-001` and `ADR-FEE-002` are `Accepted` — every `MUST`/`MUST NOT` rule in them is binding, not advisory. `ADR-FEE-003` is `Freeze Candidate` — treat its rules as binding for implementation purposes unless a specific Deferred Decision is still genuinely open (check `ADR_INDEX.md`). Do not reinterpret, relax, or "improve on" an accepted rule during implementation — if a rule seems wrong once you're implementing it, that is a signal to raise a new ADR revision, not to quietly deviate.

## 3. No speculative refactoring.

Do not refactor code you are not directly changing "while you're in there." Do not build `ADR-FIN-0xx`-scope work (Financial Engine, Payment Platform, Ledger v2/Journal) because the Roadmap document mentions it — that document is explicitly non-normative and does not authorize starting anything. Only `IMPLEMENTATION_BACKLOG.md`'s `FEE-N` Epics, in the stated dependency order, are authorized near-term work.

## 4. Remove verified dead code instead of documenting it.

If a code path, field, or enum value is confirmed (by direct search, not assumption) to have zero live behavior — never written, never read — remove it as a direct implementation change with the rationale recorded in the commit message, rather than leaving a comment saying it's unused or opening an ADR to debate it. This is not an architectural decision; ADRs are for architectural choices. (Precedent: `InvoiceStatus.EXPIRED` — verified dead via repo-wide search, removed directly, rationale in the commit message, not deferred to an ADR.) Before removing anything schema-level, always check for existing data that might reference it (e.g. a `SELECT COUNT(*)` for a to-be-removed enum value) — verified-dead-in-code is not automatically verified-unused-in-data.

## 5. One aggregate at a time.

When implementing a `FEE-N` Epic (or, later, an `ADR-FIN-0xx` one), do not spread partial changes across multiple entities/aggregates in one pass. Finish one entity's fix/feature completely — including its tests and its Compliance Matrix update — before starting the next, even within the same Epic.

## 6. Production-ready code only.

No TODO-and-ship. No "will add auth later." No stub controllers with unimplemented methods left in place. If a piece of an Epic can't be completed in the current pass, leave the code in its prior, working state and note the gap explicitly in the PR/commit — do not merge a half-built financial code path, especially not one touching money movement or authorization.

## 7. Security fixes (`FEE-0`) take priority and are independent.

`FEE-0` does not wait on architecture work (`FEE-3` onward) or on any `ADR-FIN-0xx` slot. It is live, exploitable, and already in production. If there is ever a scheduling conflict, `FEE-0` wins.

## 8. Every financial mutation needs: authorization, immutability compliance, audit, idempotency, and (where applicable) concurrency safety — as a checklist, not an afterthought.

Before considering any financial write "done," confirm against `ADR_INDEX.md`'s three ADRs:
- **Authorization** (`ADR-FEE-001`/`002`): who can call this, scoped correctly by tenant/branch/role/ownership?
- **Immutability** (`ADR-FEE-003` §3–7): does this follow a defined state transition? Is it a correction (pre-fact) or does it need to be a reversal (post-fact)?
- **Audit** (`IMM-022`/`023`): does this write a transactional, same-commit audit entry with actor/timestamp/action/target/reason?
- **Idempotency** (`IMM-017`/`018`): is this endpoint safe to receive twice?
- **Concurrency** (`IMM-014`–`016`, where the mutation is decision-dependent): is the read-decide-write sequence atomic?

## 9. Decision IDs are append-only. Never renumber.

`AUTH-0xx`, `IMM-0xx`, `INV-N` — a new rule always gets the next unused ID in its series. Never reuse or reassign an existing ID, even if its originating section gets restructured.

## 10. Two roadmap documents, two authority levels — don't conflate them.

`IMPLEMENTATION_BACKLOG.md` is what you build now. `SchoolOS-Target-Financial-Architecture-ROADMAP.md` is where the product is eventually headed and carries no implementation authority of its own. A mention in the Roadmap document is not a green light.

## 11. When something looks like a policy question, check if it's actually a policy question first.

Before treating something as needing a business/product decision, verify there's real, live behavior to have a policy about. (Precedent: `InvoiceStatus.EXPIRED`'s "semantics" looked like an accounting-policy question until a direct grep showed it was dead code — there was no policy to decide, because there was no behavior to decide a policy about.) If, after verification, a genuine policy question remains (e.g. legal retention duration, a new product vertical), do not guess or default — flag it explicitly and get a real answer from whoever owns that decision, the same way `SCHOOL_ADMIN`'s branch-scope policy was resolved.

## 12. Consistency is a standing responsibility, not a one-time audit.

Every time a document in this package is edited (an ADR promoted to `Accepted`, a new Epic added, a decision ID assigned), re-check: does this create a contradiction anywhere else in the package? Does a status header now disagree with a status line elsewhere in the same document? Did a cross-reference just become stale? Fix it in the same change, not as a follow-up.
