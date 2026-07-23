# DOCUMENT_INDEX.md

*Every finalized document in the finance-architecture handoff package. Status is quoted exactly as written in each document's own header — not paraphrased.*

| Filename | Purpose | Status (as written in the document) | Dependencies |
|---|---|---|---|
| `ADR-FEE-001-Financial-Data-Visibility-v1.2.md` | Normative authorization model for all financial data (tenant/branch/role/ownership, field classification, SFA vs. raw Ledger) | `Accepted (v1.2)` | None (foundational) |
| `ADR-FEE-002-Branch-Isolation-v1.0.md` | Normative branch-scoping model; authoritative home for `AUTH-002`/`AUTH-012` | `Accepted (v1.0)` | ADR-FEE-001 |
| `ADR-FEE-003-Financial-Immutability-FREEZE-CANDIDATE.md` | Normative model for state transitions, corrections vs. reversals, no-hard-delete, period freeze, concurrency, idempotency, retention, audit | `Freeze Candidate (pending final review → v1.0)` | ADR-FEE-001, ADR-FEE-002 |
| `SchoolOS-Target-Financial-Architecture-ROADMAP.md` | Non-normative directional roadmap: bounded contexts, Architectural Invariants, dependency-ordered `ADR-FIN-0xx` slots, measurable Evolution Phases 1–5, glossary, decision index | `architectural roadmap, directional commitment, revisable on evidence` (not an ADR; no RFC-2119 weight of its own) | ADR-FEE-001/002/003 (does not supersede any of their decisions) |
| `student-billing-audit.md` | Original production-readiness audit of the `student-billing` module — source of every concrete bug cited by the ADRs and backlog | Reference / historical record (audit findings, not a living document — current-state deltas are tracked in `IMPLEMENTATION_HANDOFF.md` §2 instead) | None (input to everything else) |
| `IMPLEMENTATION_HANDOFF.md` | This package's top-level status/orientation document | Finalized | All documents in this table |
| `DOCUMENT_INDEX.md` | This file | Finalized | — |
| `ARCHITECTURE_STATE.md` | Condensed (<5 page) architecture summary — bounded contexts, Financial Engine, billing, Ledger, projections, payment flow, invariants | Finalized | ADR-FEE-001/002/003, Roadmap |
| `IMPLEMENTATION_BACKLOG.md` | Roadmap converted into Epics with objectives, dependencies, order, complexity, acceptance criteria — including the reconstructed `FEE-0`…`FEE-8` definitions | Finalized | `student-billing-audit.md`, all 3 ADRs, Roadmap |
| `ADR_INDEX.md` | Every ADR (accepted, in-progress, and reserved) with status, summary, implementation impact, related modules | Finalized | All ADR files |
| `PROJECT_CONTEXT.md` | Full project-orientation document for a new AI session — vision, stack, repo structure, conventions, business rules, current state | Finalized | All documents in this table |
| `IMPLEMENTATION_RULES.md` | Engineering playbook / system-prompt-style ruleset for implementation sessions | Finalized | `IMPLEMENTATION_HANDOFF.md`, all 3 ADRs |

## Notes on Status Vocabulary

Quoted directly from the Roadmap document's own status table (`SchoolOS-Target-Financial-Architecture-ROADMAP.md`), since it is the single place status vocabulary is defined for this package: `Accepted` / `In Progress` / `Reserved (Not Started)` / `Superseded`. `ADR-FEE-003` is `In Progress` at the roadmap level and `Freeze Candidate` at its own document level — both are accurate simultaneously; `Freeze Candidate` is the more precise state within `In Progress`.

## Explicitly Not Included

Per the instruction to include only finalized information: earlier draft/superseded versions of ADR-FEE-001 (`-DRAFT.md`, `-FREEZE-CANDIDATE.md` — both superseded by `-v1.2.md`) are not part of this package. They remain on disk as historical record but are not referenced by any document above except where an ADR's own changelog cites them (e.g. ADR-FEE-001's "Supersedes" line).
