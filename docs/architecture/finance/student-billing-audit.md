# SchoolOS — Student Billing Module: Production-Readiness Audit

*Audit only. No code written, no files created in the repo, no patches generated. Every finding below was verified by reading the actual code — schema files, service implementations, controllers, guards, frontend pages, migrations, and seeds — not inferred from folder names or assumed from typical ERP patterns.*

**Scope covered:** `backend/prisma/schema/student-billing/*`, `backend/src/modules/student-billing/**` (fee-plans, invoice, payment, discounts, late-fee, receipt, refund, reconciliation, ledger, analytics), `frontend/src/app/dashboard/(finance)/**`, related migrations, seeds, guards (`JwtGuard`, `RolesGuard`, `AuthenticatedUser`), and `AuditService` integration.

---

## 1. Existing Architecture

```
StudentBillingModule (registered in AppModule — LIVE in production)
├── providers: FeePlansService, InvoiceService, PaymentService, DiscountService,
│              ReconciliationService, ReceiptService, RefundService, LateFeeService,
│              StandardDiscountService, GatewayFactory
├── controllers: FeePlansController, InvoiceController, PaymentController,
│                DiscountController          (4 of 10 services have a controller)
└── imports: ComplianceModule, StorageModule, AnalyticsModule (own controller)
```

**Schema** (`backend/prisma/schema/student-billing/`): 6 files — `fee-plans.prisma` (FeePlan, FeeItem, FeeAssignment), `invoices.prisma` (Invoice, InvoiceItem), `payments.prisma` (Payment, Receipt, Refund), `discounts.prisma` (Discount, DiscountApproval, LateFee), `discount-categories.prisma` (DiscountCategory), `sequences.prisma` (InvoiceSequence, ReceiptSequence). Well-normalized where it exists — proper `tenantId`/`branchId` columns and composite indexes on every model, `Decimal(12,2)` for money (no float-money bugs), real audit-trail fields on `Discount`/`LateFee` (`createdBy`, `approvedBy`, `revokedBy`, `waivedBy`, timestamps).

**Numbering**: two *different, disagreeing* implementations exist for the same problem —
- `InvoiceService.generateInvoiceNumber()` / `generateReceiptNumber()`: correct, uses `pg_advisory_xact_lock` + `count()` inside a transaction. This is the one actually used by the real payment flow.
- `ReceiptService.generateAndUpload()` (dead code, see §3): naive `count()` with no lock — a real race condition, just never reachable today.
- The schema's own purpose-built `InvoiceSequence`/`ReceiptSequence` tables (per tenant+branch+year counter) are **used by neither** — confirmed via repo-wide grep, zero references outside their own model declaration.

**Auth model**: single `JwtGuard`/`JwtStrategy` for all tenant-side users (staff **and** `PARENT`/`STUDENT` — same pipeline, confirmed via other controllers that do apply `@Roles()` against these values). A separate `jwt-superadmin.strategy.ts` exists for the platform side (unrelated to this module). `AuthenticatedUser` carries `branchId`/`branchIds` — the infrastructure for branch enforcement exists; it's just not used consistently (§5).

---

## 2. Existing Features

| Capability | Status | Evidence |
|---|---|---|
| **Fee Plans** | 🟢 Production Ready | `FeePlansController`/`Service` — create, list, assign, per-student summary. Correct server-side `branchId` scoping (uses `user.branchId`, not client input) — the one controller in this module that gets this right. |
| **Fee Items (line items)** | 🟡 Partial | Flat items under a plan (name/amount/GST), no reusable Fee-Head/Category catalog — every plan re-types its own item names. GST rate/code per item is a genuine strength most schools-ERPs get wrong. |
| **Invoice generation** | 🟢 Production Ready | `InvoiceService.generate()` — pulls plan items + transport fee + **applies approved discounts** (explicitly fixed in a prior pass, comment confirms "P0 FIX: was never applied" — and it is now, verified in the code). Advisory-lock-safe numbering. Proper `DRAFT→SENT→PAID/CANCELLED` lifecycle with sensible guards (can't cancel a paid invoice or one with successful payments). |
| **Bulk invoice generation** | 🟡 Partial | Works, but sequential per-student loop (not parallel — see §6) with no progress/async job tracking; for a large cohort this is a synchronous HTTP request that could time out. |
| **Online payment (Razorpay)** | 🟡 Partial | Order creation + HMAC signature verification both real and correct **when configured**. Silent fallback to unverified success if the gateway secret is missing/placeholder (§5, P0). |
| **Offline payment (cash/cheque/etc.)** | 🟢 Production Ready | Idempotency check via `referenceNumber` (explicitly fixed — comment confirms prior duplicate-payment bug), correct `dueAmount` validation, correctly tagged `gateway: 'OFFLINE'` (comment confirms this used to be hardcoded to `'RAZORPAY'` — also fixed). |
| **Partial payment tracking** (on the Invoice) | 🟢 Production Ready | `updateInvoice()` correctly accumulates `paidAmount`, recomputes `dueAmount`, transitions to `PARTIALLY_PAID`/`PAID`. |
| **Receipts** | ⚫ Architectural Issue | `Receipt.invoiceId` is `@unique` — **an invoice can only ever have one receipt, ever.** Confirmed in the live `PaymentService.generateReceipt()`: if a receipt already exists for the invoice, it's returned as-is on the *second* partial payment — the second payment gets no receipt of its own, and the object returned shows the *first* payment's amount. This directly contradicts "Partial payment" as a claimed capability. |
| **Discounts / Scholarships (engine)** | ⚫ Architectural Issue | Schema and approval-workflow are genuinely well-designed (category catalog, approval chain with requester/approver, audit fields, stacking-aware `finalAmount` field). **But `DiscountService.create()` is broken**: `CreateDiscountDto.category` is validated against a *locally-declared TypeScript enum* (`SIBLING`/`MERIT`/etc.) and then assigned directly to `categoryId` — a Prisma foreign key that expects a real `DiscountCategory.id` (a cuid). Every discount-creation call will fail a foreign-key constraint in practice. See §4. |
| **Late fees (calculation + auto-apply)** | 🟡 Partial | The calculation engine (`calculateLateFee()`) is solid — flat/percentage, compounding, grace period, max-penalty cap, all correctly implemented with test-worthy logic. The `@Cron(EVERY_DAY_AT_1AM)` job is real and (because `LateFeeService` is a registered provider in a module that's imported into `AppModule`) **is actually running in production today**, despite having no API surface. But: `getTenantConfig()` is a permanent stub returning one hardcoded config for every tenant — no real per-tenant/per-branch configurability exists. No manual apply/waive/reverse/list endpoints exist anywhere, despite the schema fully supporting that lifecycle (`waivedBy`, `reversedBy`, `appliedBy` fields go unused by any code). |
| **Refunds** | 🟡 Partial | Over-refund guard, real Razorpay/Stripe gateway calls with safe mock fallback, invoice-reopen-on-full-refund — solid logic. Two concrete bugs: (1) audit call uses `'REFUND_INITIATED'`, which is **not a valid `AuditAction` enum value** (`REFUND_PROCESSED` is the real one) — this will throw and be silently swallowed exactly like the bug class documented in this project's COMM-006B work; (2) `PaymentGatewayProvider` enum only has `STRIPE`/`RAZORPAY`/`CASH` — the PayPal refund branch is unreachable dead code. |
| **Reconciliation** | 🔴 Missing (mislabeled) | The only thing called "reconciliation" in this codebase is `ReconciliationService.getStudentReconciliation()` — an outstanding-dues report (fees vs. payments per student), not bank/gateway reconciliation. **True bank/payment-gateway reconciliation (matching settlement reports or webhook events against recorded payments) does not exist anywhere** — there is no webhook endpoint in this module at all (confirmed via repo-wide grep), so a payment that succeeds at the gateway but whose client-side confirmation call never arrives (closed tab, network drop) has no path to ever being reconciled. |
| **Ledger (immutable financial ledger)** | 🔴 Missing | No `Ledger` model in the schema. `ledger/services/ledger.service.ts` exists as a file path but is **0 bytes** — an empty stub, not even a class shell. |
| **Opening balance / multi-session arrears** | 🔴 Missing | No schema field or code path anywhere carries forward an unpaid balance from a prior `academicYear`/session. Each `FeePlan`/`Invoice` is scoped to a single academic year with no linkage to a student's prior-year outstanding. |
| **Installments** | 🔴 Missing | `FeeItem`/`Invoice` each carry exactly one `dueDate`. No installment schedule model or generation logic. |
| **Fee Heads / Fee Categories (reusable catalog)** | 🔴 Missing | `FeeItem.name` is a free-text string re-typed per plan; no shared master-data table (e.g. "Tuition", "Transport", "Library" as reusable, reportable categories). `DiscountCategory` (a real catalog) exists for discounts, but there's no equivalent for fee line items themselves. |
| **Write-off** | 🔴 Missing | No model, no enum value, no code path. |
| **Adjustments (generic debit/credit)** | 🔴 Missing | No model. `Discount` covers fee reductions with a reason/approval trail; there's no equivalent for arbitrary manual adjustments outside the discount taxonomy. |
| **Cashier workflow / Daily cash book** | 🔴 Missing | No model, no endpoint, no UI. Offline payments are recorded one at a time with no session/shift/till concept. |
| **Collection / Outstanding / Defaulter reports** | 🟡 Partial | `getDefaulters()` (aggregates outstanding by student, with days-overdue) and `ReconciliationService`'s summary/bulk methods are genuinely useful and reasonably built — but the latter has zero API surface (§3), and the former has a real branch-scoping gap (§5). No **ageing report** (0–30/31–60/61–90/90+ bucketing) exists anywhere — confirmed via repo-wide search. |
| **Analytics** | 🟡 Partial | One endpoint, one method (`getOverview`): invoiced/collected/outstanding/collection-rate/late-fee breakdown/discounts/refunds, tenant-wide only. No branch breakdown, no date-range filter, no per-class/per-session drill-down. |
| **Audit trail** | 🟡 Partial | Where it's wired, it mostly works (`Discount`, `Invoice`, `Payment` all correctly call `AuditService` with valid `AuditAction` values). `Refund`'s call is broken (invalid enum value, see above) — silently producing zero audit rows for every refund, a real compliance gap for a financial action. |
| **Frontend** | 🟡 Partial / 🔴 Missing (mismatched) | Pages exist for: main billing dashboard, invoices, discounts, defaulters, fee-plan assignment, billing analytics, accounting, a separate top-level analytics page, and **late-fee**. The late-fee page calls `/billing/late-fees`, `/billing/late-fees/rules`, `/billing/late-fees/waive/:id` — **none of these routes exist in the backend** (confirmed: `LateFeeService` has zero HTTP endpoints). Every action on that page will 404 in production. A stray `billing/page.tsx_bkp` backup file sits in the route tree (harmless to Next.js routing, but repo hygiene debt). No frontend exists for refunds, reconciliation, or receipts-listing — consistent with those backends being unwired. |

---

## 3. Missing Features (Mandatory Capability Checklist)

Against the mandatory list from the brief:

| Capability | Status |
|---|---|
| Student Financial Account (unified view) | 🟡 Partial — `getStudentFeeSummary`/`getStudentReconciliation` cover pieces of this but there's no single consolidated "account" object/endpoint |
| Multi-session financial history | 🔴 Missing |
| Previous year arrears | 🔴 Missing |
| Opening balance | 🔴 Missing |
| Ledger (immutable) | 🔴 Missing — schema absent, service file empty |
| Fee Plans | 🟢 |
| Fee Structures | 🟡 — exists as FeePlan+FeeItem, no structure/template reuse across years |
| Fee Heads | 🔴 Missing |
| Fee Categories | 🔴 Missing (for fee items — exists for discounts) |
| Installments | 🔴 Missing |
| Demand generation | 🟡 — `bulkGenerate()` covers this narrowly, no scheduling/recurrence |
| Invoice | 🟢 |
| Receipt | ⚫ — architecturally broken for partial payments |
| Partial payment | 🟡 — invoice-side works, receipt-side doesn't |
| Advance payment | 🔴 Missing — no mechanism to accept payment ahead of an invoice existing |
| Discounts | ⚫ — well-designed, broken at creation |
| Scholarships | 🟡 — modeled as a Discount category, not distinct; inherits the same creation bug |
| Fine | 🟡 — overlaps with Late Fee, no separate concept |
| Late Fee | 🟡 — calculation/cron real, management API missing |
| Refund | 🟡 — solid logic, broken audit trail, PayPal dead code |
| Write-off | 🔴 Missing |
| Adjustments | 🔴 Missing |
| Online payments | 🟡 — real but has a silent-fallback security gap |
| Offline payments | 🟢 |
| Cashier workflow | 🔴 Missing |
| Daily cash book | 🔴 Missing |
| Bank reconciliation | 🔴 Missing (the existing "Reconciliation" service is a different report) |
| Collection reports | 🟡 — exists, unwired |
| Outstanding reports | 🟡 — exists, unwired |
| Defaulter reports | 🟡 — exists, wired, has a branch-leak bug |
| Ageing reports | 🔴 Missing |
| Audit trail | 🟡 — mostly works, one confirmed broken call site |

---

## 4. Architectural Problems

1. **Two receipt-numbering strategies, only one safe** — `InvoiceService` (advisory-lock, correct) vs. dead `ReceiptService` (naive count, race-prone). If `ReceiptService` is ever wired up as-is instead of being retired, the unsafe version ships.
2. **`InvoiceSequence`/`ReceiptSequence` tables are pure dead schema** — purpose-built for exactly this numbering problem, referenced nowhere in code. Both real numbering paths reinvent the same thing via `count()`+advisory-lock instead.
3. **`Receipt.invoiceId @unique` is incompatible with partial payments** — a schema-level constraint that actively prevents correct behavior once it's exercised by more than one payment per invoice, which the rest of the system (correctly) supports.
4. **`DiscountService.create()`'s `categoryId` mapping is broken** — a client-facing enum value assigned directly to a database foreign key that expects a generated cuid. This isn't a partial feature, it's a call that will fail every time it's actually invoked with real data.
5. **`GatewayFactory`/`GatewayAdapter` abstraction exists and is registered as a provider, but `PaymentService` doesn't inject or use it** — the real payment flow reimplements Razorpay calls inline instead. Same "built, registered, never actually used" shape as items 1–2, and as the five orphaned services in §-none-below.
6. **Five of ten student-billing services have zero HTTP surface**: `ReceiptService`, `RefundService`, `ReconciliationService`, `LateFeeService`, `StandardDiscountService`. All are registered as NestJS providers (so they don't crash anything) but are unreachable from any controller and, per `student-billing.module.ts`'s `exports` array, not even exposed for another module to call. `ledger.service.ts` compounds this — the file exists, is 0 bytes.
7. **`RefundService`'s audit call uses an invalid `AuditAction` enum value** (`'REFUND_INITIATED'` vs. the real `REFUND_PROCESSED`) — will throw `PrismaClientValidationError` on every call, silently swallowed by `AuditService.log()`'s own try/catch. Confirmed via direct enum comparison against `enums.prisma`, not assumed — this is the exact bug shape already found and fixed three times in this project's `feature-flags` audit trail (COMM-006B), now present here too, in code that's never been exercised in production because the controller doesn't exist yet.
8. **The payment-confirmation flow isn't atomic end-to-end** — `payment.create()`, `updateInvoice()` (its own separate transaction), and `generateReceipt()` are three independent steps. A crash between steps 1 and 2 leaves a `SUCCESS` payment with an invoice that was never updated to reflect it.
9. **`RolesGuard` leaks debug output on every guarded request** — two `console.log()` calls print the full request URL and `req.user` object to stdout unconditionally. Not a data-loss risk by itself, but real log-volume/log-hygiene concern in production, and worth checking whether `req.user` includes anything sensitive before this ships as-is.
10. **Inconsistent branch-scoping pattern within the same module** — `FeePlansController` correctly derives `branchId` from `user.branchId` server-side; `InvoiceController.getDefaulters()` takes `branchId` as an untrusted client query parameter with no cross-check against the user's actual branch access. The safe pattern exists in the same codebase one folder over — it's just not applied everywhere.

---

## 5. Security Risks

Ranked by severity, per the brief's explicit P0 criteria (cross-tenant and cross-branch leakage both treated as P0).

**P0 — Missing ownership/role enforcement, live in production today** (`StudentBillingModule` is registered in `AppModule`, and `RolesGuard` allows any authenticated user through when no `@Roles()` decorator is present — confirmed by reading the guard's own logic):
- `GET /billing/invoices` and `GET /billing/invoices/:id` — no `@Roles()`, no ownership check. `PARENT` and `STUDENT` are valid, live roles on this same auth pipeline (confirmed via other controllers using `JwtGuard` + `@Roles('PARENT', ...)`). Any authenticated parent or student can list **every invoice in the tenant** or fetch **any invoice by ID**, including other families' financial detail.
- `GET /billing/payments/invoice/:invoiceId` — same gap; any authenticated user can pull any invoice's payment history.
- `GET /billing/discounts` and `GET /billing/discounts/:id` — same gap; exposes discount/scholarship reasons and approval notes for any student to any authenticated user.
- `GET /billing/fee-plans/student/:studentId` and `.../summary` — same gap; any parent can pull any other student's fee summary by guessing/enumerating IDs.

**P0 — Cross-branch data exposure**:
- `InvoiceController.getDefaulters()` takes `branchId` as a plain, client-supplied query parameter with no server-side check against `user.branchId`/`user.branchIds`. A branch-scoped staff account can view another branch's defaulter list simply by changing the query string. `AuthenticatedUser` already carries the data needed to enforce this (`branchId`, `branchIds`) — it's just not consulted here.

**P0 (conditional) — Payment verification can be silently bypassed by configuration drift**:
- `PaymentService.verifyRazorpay()` only performs HMAC signature verification `if (keySecret && !keySecret.includes('xxxxxxxxxx'))`. If that env var is ever unset or left as a placeholder in a real environment, the method falls through and marks the payment `SUCCESS` **unconditionally**, on an endpoint that `PARENT` role can call directly with client-supplied `razorpayPaymentId`/`razorpaySignature` values. This should hard-fail in any non-development environment rather than silently skip verification.

**P1 — Audit trail gap for a financial action**:
- Refunds produce no audit log entry (§4, item 7) — a compliance gap specifically on money leaving the school's account, the single most sensitive action in this module.

**P1 — Cross-tenant read in dead code, latent**:
- `ReceiptService.generateAndUpload()` fetches the `Payment` record with `this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } })` — **no `tenantId` filter at all**. Currently unreachable (no controller), but if this service is ever wired up as-is, a cross-tenant `paymentId` would return another tenant's payment data.

**P2 — Information leakage into logs**:
- `RolesGuard`'s unconditional `console.log` of the full `req.user` object on every guarded request (§4, item 9).

**Confirmed NOT a problem** (worth stating, since the brief asked to verify rather than assume):
- Every model in the billing schema carries `tenantId`, and every *service-layer* Prisma query I read scopes by it correctly (the payment lookup above is the one exception, and it's in unreachable code). No evidence of cross-*tenant* leakage in anything actually wired to a controller today.
- The late-fee cron (`applyLateFees()`) does **not** filter by tenant at all in its query (`where: { status, dueDate }`, no `tenantId`) and caps at `take: 1000` platform-wide with no `orderBy` — not a tenant-isolation *leak* (each `LateFee` it creates is still correctly tagged with the right `tenantId`), but a fairness/scalability problem: at real multi-tenant scale, whichever 1000 overdue invoices the untyped default ordering happens to return each night are the only ones that ever get a late fee applied — some tenants could be silently starved indefinitely. Flagged here because it's adjacent to the "background jobs are not tenant scoped" check the brief asked for directly, even though the failure mode is fairness/scale rather than data leakage. Also a real, confirmed **N+1**: an `academicSession.findFirst()` call runs once per invoice inside the loop instead of being batched by tenant.

---

## 6. Scalability

- **Numbering**: advisory-lock approach in `InvoiceService` is correct under concurrency, but serializes on a lock key derived from `tenantId` alone (not `tenantId+branchId`), and the `count()` inside it isn't `branchId`-scoped either — multi-branch tenants get platform-wide-per-tenant sequential numbers, not clean per-branch sequences, despite the unique constraint being `(tenantId, branchId, invoiceNumber)`. The purpose-built `InvoiceSequence`/`ReceiptSequence` tables would solve both problems (real per-branch-per-year counters) but aren't used (§4, item 2).
- **`ReconciliationService.bulkReconciliation()`**: hard `take: 500` cap with no cursor/pagination beyond that — silently truncates for any tenant with more students than that, no indication to the caller that results are incomplete. Also runs one `getStudentReconciliation()` call per student via `Promise.all` — each of which does its own `findFirstOrThrow` + `findMany` — so 500 students means up to 1000 concurrent queries fired at once, a real connection-pool risk.
- **`LateFeeService.applyLateFees()`**: confirmed N+1 (`academicSession.findFirst()` per invoice, not batched), plus the platform-wide `take: 1000` cap described in §5.
- **`InvoiceService.bulkGenerate()`**: sequential (not parallel) loop calling `generate()` once per student assignment — each iteration does ~5 separate queries. Safer than parallelizing (given the lock-based numbering), but means a large cohort (thousands of students) turns bulk invoice generation into a slow synchronous HTTP request with no progress reporting or background-job pattern.
- **Transaction boundaries**: `updateInvoice()` is correctly wrapped in `$transaction`; the *larger* payment-confirmation flow (create payment → update invoice → generate receipt) is not (§4, item 8) — three independent round-trips, not one atomic unit.
- **Locking**: only place genuine locking (`pg_advisory_xact_lock`) is used is invoice/receipt numbering. Nothing else in this module uses row-level locking or optimistic concurrency (no `version`/`updatedAt`-based CAS anywhere) — the refund double-submission risk (§4 discussion under Refunds) and the payment-flow atomicity gap both stem from this.
- **Indexes**: genuinely good coverage — every model has `tenantId` and `(tenantId, branchId)` composite indexes at minimum, plus targeted ones (`Invoice.status`, `Invoice.dueDate`, `Payment.gatewayPaymentId`, `LateFee.(invoiceId, status)`). No missing-index concerns found in the models reviewed.

---

## 7. Recommended Production Architecture

This isn't a rewrite — the foundation (schema conventions, tenant/branch columns, audit-trail fields on the models that have them, the numbering lock pattern, the offline-payment idempotency fix, the discount approval chain) is genuinely solid in the parts that were finished carefully. The recommendation is to **finish what's started before adding anything new**:

1. **Consolidate to one numbering mechanism** — retire `ReceiptService`'s naive counter, either fully adopt the `InvoiceSequence`/`ReceiptSequence` tables (cleanest, matches their intended per-branch-per-year design) or keep the advisory-lock approach but fix it to key on `(tenantId, branchId)`.
2. **Fix the `Receipt` model for partial payments** — drop the `invoiceId @unique` constraint (keep `paymentId @unique`, since one receipt per payment is the correct invariant); update `generateReceipt()`/`generateAndUpload()` to always create a new receipt per successful payment.
3. **Fix `DiscountService.create()`'s category mapping** — look up the real `DiscountCategory.id` from `dto.category` (by `code` + `branchId`) instead of assigning the DTO enum value directly as a foreign key. This one blocks the entire discount/scholarship feature from working at all.
4. **Close the authorization gaps** — add `@Roles()` and ownership checks (student/parent can only read their own child's records; branch-scoped staff can only read their own branch) to every `GET` in `InvoiceController`, `PaymentController`, `DiscountController`, and `FeePlansController` that currently has none. This is the single highest-priority item in this whole audit given it's live, in production, today.
5. **Hard-fail payment verification on missing gateway config** in any non-development environment, rather than silently skipping the HMAC check.
6. **Either wire up or deliberately delete** the five orphaned services (`ReceiptService` after the fix above, `RefundService`, `ReconciliationService`, `LateFeeService`, `StandardDiscountService`) and the empty `ledger.service.ts`. Leaving them as unreachable-but-registered is exactly the "built but never wired" shape that's caused real, expensive confusion elsewhere in this project's history — don't let it compound here too.
7. **Fix `RefundService`'s audit call** (`REFUND_PROCESSED`, not `REFUND_INITIATED`) as part of wiring it up.
8. **Add the missing financial primitives as new, explicit models** rather than overloading existing ones: `Ledger` (immutable, append-only, one row per financial event — invoice raised, payment received, discount applied, refund issued, write-off — this becomes the actual source of truth reports are built from), `Installment` (schedule under a FeePlan/Invoice), a `FeeHead`/`FeeCategory` catalog (mirroring the pattern `DiscountCategory` already establishes well), `WriteOff`, and a `CashBook`/cashier-session model if in-person collection at scale is a real requirement for this product.
9. **Arrears/opening-balance**: model as a specific `Ledger` entry type carried forward at session rollover, rather than a bespoke mechanism — this keeps it consistent with item 8 rather than adding a second parallel concept.
10. **Bank/gateway reconciliation**: add a real webhook endpoint (Razorpay/Stripe both support this) plus a reconciliation job that reads `Ledger` entries against gateway settlement data — separate concern from the existing `ReconciliationService`, which should probably be renamed (`OutstandingDuesService` or similar) to stop the name collision with real reconciliation once both exist.
11. **Ageing report**: straightforward once `Ledger`/existing `Invoice.dueDate` data is in place — bucket `getDefaulters()`-style output into 0–30/31–60/61–90/90+ day buckets.
12. **Remove the `console.log`s from `RolesGuard`** and the stray `billing/page.tsx_bkp` file as basic hygiene, low effort, do alongside whichever of the above ships first.

---

## 8. Prioritized Implementation Roadmap

**Phase 0 — Security (do first, independent of everything else, smallest possible diffs):**
1. Add `@Roles()` + ownership/branch checks to the unguarded `GET` endpoints across Invoice/Payment/Discount/FeePlans controllers.
2. Hard-fail Razorpay verification on missing/placeholder config instead of silent-skip.
3. Fix `getDefaulters()`'s branch parameter to be server-derived, not client-supplied.

**Phase 1 — Fix what's broken in already-wired, customer-facing paths:**
4. Fix `DiscountService.create()`'s `categoryId` mapping (unblocks the entire discount/scholarship feature).
5. Fix `Receipt` model + generation for partial payments.
6. Fix `RefundService`'s audit action enum value (as part of wiring it up — see Phase 2).
7. Wrap the full payment-confirmation flow (payment → invoice update → receipt) in one transaction.

**Phase 2 — Wire up what's built but orphaned:**
8. Give `RefundService`, `ReceiptService` (post-fix), `LateFeeService`, `ReconciliationService`, `StandardDiscountService` real controllers, or explicitly retire whichever aren't wanted. Priority order: Refund (money leaving the building, currently has zero API) → LateFee (frontend already exists and expects it) → Reconciliation (reports are usually an early ask) → Receipt/StandardDiscount as needed.
9. Consolidate numbering onto one mechanism (§7 item 1).
10. Consolidate the payment-gateway abstraction (`GatewayFactory`) into actual use, or remove it.

**Phase 3 — New financial primitives (the real ERP-completeness gap):**
11. `Ledger` model + migration + backfill strategy for existing Invoice/Payment/Discount/Refund/LateFee history.
12. `Installment` model + invoice-generation support for installment schedules.
13. `FeeHead`/`FeeCategory` catalog.
14. Arrears/opening-balance as a `Ledger` entry type, wired into session rollover.
15. `WriteOff` model + approval workflow (mirror the `Discount`/`DiscountApproval` pattern, which is already a good template for this).

**Phase 4 — Operational completeness:**
16. Cashier workflow + daily cash book, if in-person collection at scale is a real product requirement (confirm this before building — it's the largest single item on this list).
17. Bank/gateway webhook + reconciliation.
18. Ageing report.
19. Branch/date-range breakdowns for `AnalyticsService`.

**Explicitly not recommending yet:** starting Phase 3/4 before Phase 0–2 land. The mandatory-capability gaps are real, but they're additive — the Phase 0–1 items are live, exploitable, and load-bearing for what already exists. Same discipline this project applied to COMM-006B: audit before building, fix what's broken before adding what's missing, verify end-to-end before calling anything done.
