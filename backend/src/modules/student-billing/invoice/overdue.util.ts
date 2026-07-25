// modules/student-billing/invoice/overdue.util.ts
//
// M5: OVERDUE becomes a derived condition, not a persisted InvoiceStatus
// value. Nothing in Student Billing writes 'OVERDUE' as of this milestone
// (LateFeeService.applyLateFees() previously did; see its diff). The
// LONG-TERM, permanent business rule is: an invoice is overdue if it is
// still unsettled (SENT or PARTIALLY_PAID) and its due date has passed --
// see PERMANENT_OVERDUE_STATUSES below. That rule is extracted here so
// every consumer shares one definition instead of five independently-
// drifting copies.
//
// Deliberately does NOT touch SaasInvoice or the shared InvoiceStatus enum.
// See FINANCE_ARCHITECTURE_FREEZE_v1.2 / ADR-FEE-003 M5 pre-flight review:
// SaasInvoice.status shares this Prisma enum, so the enum itself is left
// untouched; only Student Billing's application-level reads/writes change.

import { InvoiceStatus } from '@prisma/client';

// The permanent rule. This is the ONLY status set that should exist once
// the transitional compatibility path below is retired.
const PERMANENT_OVERDUE_STATUSES = [
  InvoiceStatus.SENT,
  InvoiceStatus.PARTIALLY_PAID,
] as const;

// ---------------------------------------------------------------------------
// TRANSITIONAL COMPATIBILITY -- NOT part of the long-term business rule.
// ---------------------------------------------------------------------------
// Transitional compatibility for legacy OVERDUE rows.
// This compatibility path is temporary and exists only to support
// historical persisted data during the migration away from persisted
// OVERDUE in Student Billing.
//
// 'OVERDUE' was written by LateFeeService.applyLateFees() before this
// milestone; that write path is now removed. Rows written before this
// commit may still carry the value until they are backfilled or reach a
// terminal status (PAID/CANCELLED) on their own. Included here ONLY so
// those pre-existing rows remain visible in reads during that window,
// rather than silently vanishing from defaulter lists, analytics, and
// reconciliation the moment this commit lands.
const LEGACY_OVERDUE_STATUSES = [
  InvoiceStatus.OVERDUE,
] as const;

// Single place to flip when the transitional path is no longer needed.
//
// TODO(remove after legacy backfill): set this to `false` -- and then
// delete LEGACY_OVERDUE_STATUSES and this flag entirely -- once (a) the
// M5 backfill has run in every environment that matters, and (b) enough
// time has passed that no un-backfilled row could plausibly remain -- or
// once InvoiceStatus is ever split per the deferred Option B discussion,
// whichever comes first. This does NOT happen within M5 itself; M5 only
// stops writing OVERDUE and derives it for reads, it does not retire this
// compatibility path. Re-check live row counts before flipping; do not
// assume zero. This is the exact class of oversight documented in
// migrations/20260722000000_remove_invoice_status_expired/migration.sql,
// where the same assumption was made carelessly once already for a
// different enum value on a different (but enum-sharing) table.
const includeLegacyOverdueStatuses = true;

function computeOverdueStatuses(includeLegacy: boolean): InvoiceStatus[] {
  return includeLegacy
    ? [...PERMANENT_OVERDUE_STATUSES, ...LEGACY_OVERDUE_STATUSES]
    : [...PERMANENT_OVERDUE_STATUSES];
}

/**
 * The exact status set every overdue check currently matches against.
 * Exported so tests assert against this reference rather than duplicating
 * the literal list -- if this set ever changes (e.g. when the transitional
 * flag above is flipped), tests built on this export update automatically
 * instead of needing a separate edit in every one of them.
 */
export const OVERDUE_STATUS_MATCH: InvoiceStatus[] =
  computeOverdueStatuses(includeLegacyOverdueStatuses);
// ---------------------------------------------------------------------------

/**
 * Prisma `where`-fragment identifying overdue invoices. Spread into any
 * `invoice.findMany` / `invoice.count` / `invoice.aggregate` where-clause
 * alongside tenant/branch scoping, which this function does not itself
 * apply -- callers remain responsible for their own authorization scoping,
 * unchanged from before this milestone.
 */
export function overdueWhere(now: Date = new Date()) {
  return {
    status:  { in: OVERDUE_STATUS_MATCH },
    dueDate: { lt: now },
  };
}

/**
 * Per-invoice boolean check, for a single already-loaded invoice (API
 * response shaping, UI-facing flags). Built from the same
 * OVERDUE_STATUS_MATCH / dueDate rule as overdueWhere() above so the two
 * can never disagree.
 */
export function isInvoiceOverdue(
  invoice: { status: InvoiceStatus; dueDate: Date | string | null },
  now: Date = new Date(),
): boolean {
  if (!invoice.dueDate) return false;
  if (!OVERDUE_STATUS_MATCH.includes(invoice.status)) return false;
  return new Date(invoice.dueDate) < now;
}
