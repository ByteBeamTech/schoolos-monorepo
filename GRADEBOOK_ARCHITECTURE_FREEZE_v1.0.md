```markdown
# GRADEBOOK ARCHITECTURE FREEZE v1.0

**Status:** FROZEN
**Applies to:** Gradebook, Examinations, Report Card, Promotion
**Repository:** ByteBeamTech/schoolos-monorepo
**Baseline commit:** 4bf41576d9cae1309608b85a7bdb8fa01d5557d3 (main)
**Supersedes:** All prior verbal/chat-based review discussion. This document is the sole authoritative reference from this point forward.

---

## 1. Executive Summary

The Gradebook, Examinations, Report Card, and Promotion domains SHALL be treated as one coherent subsystem with four bounded modules. The current implementation contains critical correctness, security, and data-integrity defects that MUST be corrected before production use. The current implementation also lacks structural support for assessment components, board-specific grading, and academic history, which MUST be added before the first real examination cycle runs on the platform, because these decisions become prohibitively expensive to retrofit once production data exists.

This document freezes all accepted architectural and domain decisions. No further review of these decisions SHALL occur. Implementation SHALL proceed strictly according to this document.

---

## 2. Domain Scope

This freeze governs the following bounded modules:

- **Examinations** — `Exam`, `ExamSchedule`, `Mark`, mark entry, exam lifecycle.
- **Gradebook** — `GradeBoundary` configuration and grade computation.
- **Report Card** — result composition, persistence, and rendering.
- **Promotion** — promotion/detention decisioning and student advancement.

Finance, staff, attendance (as a data source only), and all modules outside this scope are explicitly out of scope for this document.

---

## 3. Architectural Decisions (Frozen)

3.1. The four modules SHALL be structured as: `examinations` (owns `Exam`, `ExamSchedule`, `Mark`, and the single canonical results-aggregation service), `gradebook` (owns `GradeBoundary` and the single canonical grade-computation function only), `report-card` (owns report card composition, persistence, and rendering; depends on `examinations` and `gradebook`), and `promotion` (owns promotion decisioning; depends on `examinations` and `gradebook`).

3.2. `report-card` SHALL be extracted into its own module and SHALL NOT remain nested inside `gradebook`.

3.3. `promotion` SHALL be extracted into its own module and SHALL NOT remain nested inside `admissions`.

3.4. There SHALL be exactly one "class results" aggregation implementation, owned by `examinations`. The duplicate implementation in `gradebook` SHALL be removed.

3.5. There SHALL be exactly one grade-from-percentage computation function, owned by `gradebook`, consumed by `examinations`, `report-card`, and `promotion`. No module SHALL implement its own grading logic or hardcoded grade scale.

3.6. `report-card` SHALL obtain raw result totals from `examinations`' results-aggregation service rather than independently recomputing totals from `Mark` rows.

3.7. PDF rendering SHALL NOT depend on a headless-browser dependency (e.g., Puppeteer) inside the main API process. PDF rendering SHALL use the existing `pdf-lib`-based rendering pattern already established for invoices and certificates.

3.8. No module SHALL return HTML from an endpoint whose contract specifies PDF output.

---

## 4. Education Domain Decisions (CBSE/ICSE/State Board)

4.1. A structural `Board` field SHALL exist on the class/session scope. It SHALL be populated for every class even where only one board value is initially supported.

4.2. `GradeBoundary` configuration SHALL be capable of varying by board, not only by tenant and session.

4.3. The system SHALL support CBSE grade points as a grading output computed in parallel with percentage, not as a replacement for percentage.

4.4. ICSE/ISC-style separation of Internal Assessment marks from written-paper marks SHALL be representable through the Assessment Model (Section 10), not through separate unrelated `ExamSchedule` rows.

4.5. IB, IGCSE, and Cambridge grading models SHALL NOT be supported in this baseline. Support for these boards is explicitly out of scope and SHALL NOT influence schema or logic design.

4.6. State Board grading SHALL be supported through the same configurable `GradeBoundary` and `Board` mechanism used for CBSE/ICSE; no state-specific structural entities SHALL be introduced.

4.7. Relative/curve-based grading SHALL NOT be built.

4.8. A generic, fully abstract "rules engine" for grading or promotion SHALL NOT be built. Grading and promotion logic SHALL be modeled explicitly for CBSE, ICSE, and State Board policies with clean extension points, not through an abstracted policy engine.

---

## 5. Aggregate Boundaries

5.1. `Exam` is the aggregate root for one examination instance (e.g., one Unit Test, one Half Yearly). `ExamSchedule` and `Mark` are owned by `Exam` and SHALL NOT be modified outside the `examinations` module.

5.2. `GradeBoundary` is its own aggregate, owned by `gradebook`, scoped by tenant, session, and (per Section 4) board.

5.3. `ReportCard` (Section 8) is its own aggregate, owned by `report-card`, referencing `Exam` and `Student` by ID. It SHALL NOT be embedded inside `Exam` or `Mark`.

5.4. `StudentPromotion` and `PromotionRule` are owned by `promotion`. `promotion` SHALL read from `examinations`' results-aggregation service and SHALL NOT write to `Mark`, `Exam`, or `ExamSchedule`.

5.5. Academic placement history (Section 15.6) is owned by the student/academics domain and is consumed, not owned, by `promotion`.

---

## 6. Entity Ownership

| Entity | Owning Module | Consumers |
|---|---|---|
| `Exam`, `ExamSchedule`, `Mark` | `examinations` | `report-card`, `promotion` (read-only) |
| `GradeBoundary` | `gradebook` | `examinations`, `report-card`, `promotion` (read-only) |
| `ReportCard` (new) | `report-card` | `promotion` (read-only, once persisted) |
| `StudentPromotion`, `PromotionRule` | `promotion` | none |
| `AssessmentComponent` (new, Section 10) | `examinations` | `report-card` |
| Academic placement history (new, Section 15.6) | students/academics domain | `promotion`, `report-card` |

No module other than the owning module SHALL write to another module's entities.

---

## 7. State Machines

### 7.1 Exam / Result Publication State Machine

The exam result lifecycle SHALL follow exactly these states and transitions:

```
DRAFT → TEACHER_ENTRY → SUBMITTED_FOR_VERIFICATION → VERIFIED → MODERATED → LOCKED → PUBLISHED
```

- **DRAFT**: Exam and schedules configured, no marks entered. Only `SCHOOL_ADMIN`/`PRINCIPAL` MAY act.
- **TEACHER_ENTRY**: Marks entry in progress. Only `TEACHER` (scoped to assigned class/subject) and `SCHOOL_ADMIN` MAY act.
- **SUBMITTED_FOR_VERIFICATION**: Entry marked complete by the entering teacher. `CLASS_TEACHER`/`PRINCIPAL` review for completeness and validity.
- **VERIFIED**: Data confirmed internally consistent. MAY transition backward to `TEACHER_ENTRY` if corrections are required.
- **MODERATED**: Grace marks and moderation adjustments (Section 9.4/9.5, deferred) applied where applicable.
- **LOCKED**: Marks are frozen. `ReportCard` snapshot generation (Section 8) SHALL occur only at this transition.
- **PUBLISHED**: Visible to `STUDENT`/`PARENT` subject to ownership and publish checks (Section 11).

7.2. For the MVP baseline (Section 13), the full seven-state machine is NOT required. The MVP SHALL implement, at minimum, a binary `isPublished` gate that is correctly enforced (Section 11.4). The full state machine is deferred per Section 14 but MUST NOT be contradicted by the MVP implementation — the binary gate SHALL be implementable as a reduction of this state machine, not a divergent model.

7.3. A student's `StudentStatus` and academic placement (Section 15.6) SHALL be modeled as an append-only timeline, not as mutable current-state overwrite, effective from the first commit of this baseline.

---

## 8. Report Card Architecture

8.1. Report cards SHALL use a hybrid generation model: computed on-demand prior to `Exam` publish, and persisted as an immutable snapshot at the moment of publish (state transition `LOCKED → PUBLISHED`, Section 7).

8.2. A new `ReportCard` entity SHALL be introduced with, at minimum: `id`, `tenantId`, `studentId`, `examId`, `version`, a JSON result snapshot, `publishedAt`, `publishedBy`, and `supersedes` (nullable self-reference).

8.3. The JSON snapshot, not a rendered PDF/HTML blob, SHALL be the source of truth. PDF/HTML rendering SHALL be derived from the snapshot on request and MAY be cached.

8.4. Any correction to a published report card SHALL create a new `ReportCard` version referencing the version it supersedes. Published report cards SHALL NOT be overwritten in place.

8.5. Report cards SHALL include, at minimum: subject-wise marks, subject-wise grade, overall percentage, overall grade, rank (where applicable), and attendance percentage. Teacher remarks and principal remarks fields SHALL exist on the `ReportCard` entity.

8.6. Report card generation SHALL compute schedules, grade boundaries, and the full mark set for a class exactly once per class-level generation request, and SHALL NOT recompute this data per student within the same request.

---

## 9. Promotion Architecture

9.1. `promotionPreview` and `promoteStudent`/`bulkPromote` SHALL compute PROMOTE/DETAIN decisions from actual aggregated student results read from `examinations`, evaluated against `PromotionRule.passingMarks` and `PromotionRule.requireAllPass`. Promotion decisions SHALL NOT be hardcoded or assumed.

9.2. Promotion decisioning SHALL occur against the Annual/Aggregate Result (Section 10.5) where one has been defined for the session, and SHALL NOT be based on a single arbitrary exam unless only one exam exists for that session's promotion determination.

9.3. `promoteStudent` SHALL continue to execute as a single atomic transaction, consistent with the existing `Serializable`-isolation implementation.

9.4. Grace marks, moderation, and scaling are deferred (Section 14) but, when implemented, SHALL be represented as explicit, audited deltas layered on top of raw marks — never as in-place overwrites of the raw mark.

9.5. Compartment and supplementary/improvement exams are deferred (Section 14). When implemented, a supplementary exam SHALL be modeled as an `Exam` with an explicit self-referential link to the original exam it re-attempts, and `PromotionType` SHALL be extended with a corresponding value.

9.6. Attendance-based promotion eligibility is deferred (Section 14). When implemented, `PromotionRule` SHALL carry an explicit minimum-attendance-percentage field, evaluated against attendance data already computed by `report-card`.

---

## 10. Assessment Model

10.1. A `Mark` SHALL NOT remain a single number per subject per exam as the terminal model. A new `AssessmentComponent` concept SHALL be introduced between `ExamSchedule` and `Mark`, minimally covering: Theory, Practical, Project, Oral, Notebook, Internal, Viva, Lab.

10.2. Each `AssessmentComponent` SHALL carry its own max marks and SHALL be independently enterable and independently validated (`marksObtained ≤ componentMaxMarks`).

10.3. A subject's final grade on the report card SHALL be computed as an aggregation (sum or weighted sum, as configured) of its assessment components, using the single canonical grading function (Section 3.5).

10.4. Subject-wise pass/fail determination SHALL account for per-component pass rules where a board or school configuration requires them (e.g., a subject requiring a separate practical pass threshold), and SHALL NOT assume a single undifferentiated number determines pass/fail once components exist.

10.5. An Annual/Aggregate Result concept SHALL exist, capable of combining results from multiple `Exam` instances within a session, to support promotion decisioning (Section 9.2) and Transfer Certificate result reporting.

10.6. Co-scholastic, behavior, and activity grading SHALL be modeled as a separate, non-numeric structure attached to `ReportCard`, and SHALL NOT be forced into the `Mark`/`AssessmentComponent` numeric structure.

10.7. Subject Groups (Best-of-N, elective groups, stream groupings such as Science/Commerce/Arts) are deferred (Section 14). When implemented, they SHALL be modeled as an explicit, named, reusable `SubjectGroup` entity, and SHALL NOT be inferred from ad hoc per-student configuration.

---

## 11. Security & Authorization Rules

11.1. Every endpoint that returns exam results, marks, rank, or report card data MUST declare an explicit role restriction. No such endpoint SHALL rely on the guard's default-allow behavior in the absence of a role declaration.

11.2. For `STUDENT` and `PARENT` roles, every such endpoint MUST enforce an ownership check: a `STUDENT` MUST only access their own data; a `PARENT` MUST only access data for students linked to them through the existing `Guardian`/`GuardianStudent`/`userId` relationships. This check SHALL be implemented at the service layer using the existing `Student.userId` and `Guardian.userId` links. No schema change is required for this check.

11.3. For `TEACHER` role, mark-entry and result-access endpoints MUST verify the teacher holds an active `TeacherAssignment` for the specific class and subject being accessed. A `TEACHER` MUST NOT be able to enter or view marks for a class/subject they are not assigned to.

11.4. For `STUDENT` and `PARENT` roles, result and report card visibility MUST additionally require `Exam.isPublished = true` (or the equivalent state per Section 7). Staff roles (`TEACHER`, `PRINCIPAL`, `SCHOOL_ADMIN`) MAY view unpublished results.

11.5. `SCHOOL_ADMIN` and `PRINCIPAL` roles remain scoped to tenant only; no per-student ownership check applies to these roles.

11.6. Roles with no legitimate access requirement to academic results (e.g., `ACCOUNTANT`) MUST be excluded by the role declarations in 11.1 and MUST NOT gain access through absence of a role check.

11.7. All user-controlled input rendered into HTML or PDF output (including but not limited to school name, student name, and remarks) MUST be escaped before rendering. No endpoint SHALL interpolate unescaped user-controlled or database-sourced text into HTML output.

11.8. Full authenticated-user objects MUST NOT be logged in request-scoped guard/middleware logging.

---

## 12. Concurrency & Consistency Rules

12.1. Bulk mark entry MUST execute as a single atomic transaction. Partial writes on failure are not permitted.

12.2. Bulk mark entry MUST validate that each `marksObtained` value does not exceed the corresponding schedule's (or, once Section 10 is implemented, component's) maximum marks.

12.3. Bulk mark entry MUST validate that the referenced `scheduleId` belongs to the referenced `examId` before writing. Mismatched exam/schedule references MUST be rejected.

12.4. Bulk mark entry MUST validate that the referenced student is enrolled in the class associated with the schedule being entered.

12.5. `Mark` MUST carry an index on `scheduleId`, and `ExamSchedule` MUST carry an index on `classId` (or an equivalent composite index including `classId`), to support results and report card queries at production data volume.

12.6. Report card class-level generation MUST fetch schedules, grade boundaries, and the class's full mark set exactly once per request and MUST NOT re-fetch this data per student.

12.7. `GradeBoundary` lookups MAY be cached per `(tenantId, sessionId[, board])` with invalidation on write; this is permitted but not mandatory for the MVP baseline.

---

## 13. Mandatory Phase-A Corrections

The following MUST be corrected before any production exam cycle runs on this system. These are corrections to existing broken behavior, not new features.

13.1. Remove the invalid `include: { subject: true }` / `include: { student: true }` Prisma queries in `gradebook.service.ts` and `report-card.service.ts`. Replace with the manual-join pattern already implemented in `examinations.service.ts`.

13.2. Implement the single canonical grade-computation function (Section 3.5) and remove the three divergent implementations.

13.3. Correct the frontend Gradebook page to call existing backend routes (`POST /examinations/marks/bulk`, `GET /report-cards/:examId/:studentId/pdf`) instead of nonexistent routes. Remove or withhold any UI action with no corresponding backend endpoint (e.g., class-level PDF export) until Section 8's persistence model supports it.

13.4. Replace the Puppeteer-dependent PDF path with the `pdf-lib`-based rendering approach (Section 3.7).

13.5. Implement the authorization and ownership rules in Section 11 across `gradebook.controller.ts`, `report-card.controller.ts`, and `examinations.controller.ts`.

13.6. Enforce the publish gate per Section 11.4.

13.7. Implement the teacher-assignment scope check per Section 11.3.

13.8. Fix `promotionPreview`/`promoteStudent`/`bulkPromote` to compute real PROMOTE/DETAIN outcomes per Section 9.1, or withhold the promotion-preview UI from admin use until this is implemented. A hardcoded "zero detained" result MUST NOT be exposed to school administrators.

13.9. Apply the indexes specified in Section 12.5.

13.10. Introduce the append-only academic placement history model per Section 7.3/15.6 before further student promotion/section-change events are processed.

13.11. Introduce the `Board` structural field per Section 4.1 and the `AssessmentComponent` model per Section 10.1 before the first production examination cycle, even if only single-board, single-component behavior is exercised initially.

---

## 14. Deferred Features (Post-MVP)

The following are explicitly deferred and SHALL NOT be built as part of the MVP baseline:

14.1. Full seven-state result publication state machine (Section 7.1) beyond the binary publish gate (Section 7.2).
14.2. Grace marks, moderation, and scaling (Section 9.4).
14.3. Compartment, supplementary, and improvement exams (Section 9.5).
14.4. Attendance-based promotion eligibility (Section 9.6).
14.5. Conditional/"trial" promotion status.
14.6. Board-specific/stage-specific promotion safety rails beyond what Section 4 requires structurally.
14.7. Subject Groups, Best-of-N, 6th subject replacement (Section 10.7).
14.8. Cumulative, multi-year academic transcript.
14.9. QR verification, digital signature, and watermark on report cards.
14.10. Readmission continuity and academic-gap tracking beyond the append-only history baseline in Section 13.10.
14.11. `GradeBoundary` caching (Section 12.7) and bulk mark-entry round-trip batching beyond the transaction requirement in Section 12.1.

---

## 15. Architecture Invariants

The following MUST hold at all times and MUST NOT be violated by any future change:

15.1. There SHALL be exactly one grade-computation implementation in the system.
15.2. There SHALL be exactly one class-results aggregation implementation, owned by `examinations`.
15.3. No module SHALL write to another module's owned entities (Section 6).
15.4. No PDF-labeled endpoint SHALL return non-PDF content.
15.5. No result, mark, or report-card read endpoint SHALL be reachable without an explicit role declaration.
15.6. Student academic placement (class, section, board) SHALL be recorded as an append-only history, not mutable current-state overwrite.
15.7. Published `ReportCard` records SHALL be immutable; corrections SHALL create new versions.
15.8. `AssessmentComponent` max-marks validation SHALL be enforced at write time, not only at read/display time.

---

## 16. Implementation Order

Work SHALL proceed in the following order. Later items MUST NOT begin before their listed dependencies are complete.

1. Grade computation unification (13.2) — no dependencies.
2. Fix invalid Prisma includes (13.1) — no dependencies.
3. Add indexes (13.9) — no dependencies.
4. Authorization, ownership, and teacher-scope checks (13.5, 13.7) — no dependencies.
5. Publish-gate enforcement (13.6) — depends on (4).
6. Frontend route correction (13.3) — depends on (2), (4), (5).
7. Bulk mark-entry integrity (12.1–12.4) — depends on (1).
8. `Board` field and `AssessmentComponent` model introduction (13.11, Sections 4, 10) — depends on (1).
9. Append-only academic placement history (13.10, 15.6) — depends on (8) only insofar as both are schema-foundational; MAY proceed in parallel with (8).
10. `ReportCard` persistence and publish-time snapshot (Section 8) — depends on (1), (2), (4), (5), (8).
11. Module extraction: `report-card` and `promotion` into standalone modules (Section 3.2, 3.3) — depends on (10).
12. Promotion wired to real aggregated results (13.8, Section 9.1–9.2) — depends on (1), (8), (10).

---

## 17. Changelog from Review

- Corrected: ownership-check implementation requires no schema change; existing `Student.userId`/`Guardian.userId` links are sufficient (supersedes earlier assumption of a required new relation).
- Added: `TEACHER`→`TeacherAssignment` scope enforcement requirement (Section 11.3), identified during architecture review, not present in the initial technical audit.
- Consolidated: three separate grade-calculation implementations reduced to one frozen decision (Section 3.5).
- Consolidated: duplicate class-results aggregation reduced to one frozen decision, owned by `examinations` (Section 3.4).
- Elevated to Phase-A: `Board` field and `AssessmentComponent` model, originally raised as domain gaps, are now mandatory pre-production corrections (13.11) due to irreversible migration risk once production data exists.
- Elevated to Phase-A: append-only academic placement history (13.10), for the same irreversibility reason.
- Rejected/out of scope: IB, IGCSE, Cambridge board support (Section 4.5).
- Rejected/out of scope: relative/curve-based grading (Section 4.7).
- Rejected/out of scope: generic abstract grading/promotion rules engine (Section 4.8).
- Deferred: full seven-state publication workflow reduced to a binary publish gate for MVP (Section 7.2), with the full state machine retained as the frozen target architecture (Section 7.1).

---

## 18. Final Frozen Decisions

18.1. This document is the sole authoritative architecture and domain baseline for the Gradebook, Examinations, Report Card, and Promotion modules.

18.2. All decisions in Sections 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, and 15 are FROZEN and MUST NOT be revisited without a new, explicitly versioned freeze document superseding this one.

18.3. Implementation MUST follow the order specified in Section 16.

18.4. Section 13 items are mandatory and blocking. Section 14 items MUST NOT be implemented ahead of Section 13 items.

18.5. No further architectural or domain review of this scope SHALL occur prior to implementation.
```
