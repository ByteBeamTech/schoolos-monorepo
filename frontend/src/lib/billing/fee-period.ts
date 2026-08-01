// frontend/src/lib/billing/fee-period.ts
//
// FDD references: Section 8.3 (business-language labels, best-effort),
// Section 8.14 (late fee behavior), Section 12.4 (Due/Upcoming/Paid),
// Section 12.4.1 (Fee Period Card specification).
//
// No backend change backs any of this -- every field here is derived,
// client-side, from what GET /billing/invoices already returns. This is
// deliberate, not a shortcut: FDD Section 8.3 states plainly that no
// backend field represents a billing period, so "derive a label" is the
// correct, permanent shape of this logic, not a placeholder for a future
// backend field.

import type { Invoice } from "@/lib/hooks";
import { daysOverdue } from "@/lib/format";

export type FeePeriodStatus = "DUE" | "OVERDUE" | "UPCOMING" | "PAID";

export interface FeePeriod {
  invoiceId: string;
  invoiceNumber: string;
  /** Business-language label -- best-effort, see deriveLabel() below. */
  label: string;
  /** The invoice's dominant charge category (e.g. ACADEMIC, TRANSPORT). */
  category: string;
  /** Base charge (sum of item amounts, before late fee / discount / payment). */
  amount: number;
  /** Sum of unwaived late fee amounts assessed against this invoice. Zero
   *  when none exist -- FR-CARD-01 requires this line to be omitted
   *  entirely by the caller when zero, not shown as a permanent ₹0 row. */
  lateFee: number;
  /** Sum of per-item discounts already baked into this invoice. Same
   *  omit-when-zero rule as lateFee (FR-CARD-01). */
  discount: number;
  /** FR-CARD-02: amount + lateFee - discount - already paid. */
  remaining: number;
  dueDate: string;
  status: FeePeriodStatus;
  daysOverdue: number;
}

/**
 * FDD Section 8.3 label derivation, implemented exactly as specified:
 * a single, well-named item's own name is the best signal available;
 * everything else falls back to a due-date-derived label. This function
 * does NOT attempt to trace items back to a FeePlan name -- that trace
 * depends on backend include-depth this sprint does not have, and Section
 * 8.3 already anticipates the fallback path being the common case for
 * generically-named plans, not an edge case.
 */
export function deriveLabel(invoice: Invoice): string {
  const items = invoice.items ?? [];
  if (items.length === 1 && items[0].name && items[0].name.trim().length > 0) {
    return items[0].name.trim();
  }
  const due = new Date(invoice.dueDate);
  if (Number.isNaN(due.getTime())) return "Fee";
  const month = due.toLocaleDateString("en-IN", { month: "long" });
  return `${month} Fee`;
}

/**
 * The invoice's dominant charge category, for the Fee Period Card's tag.
 * "Dominant" = the category the largest-amount item belongs to, since an
 * invoice can in principle mix categories even though the two current
 * categories (ACADEMIC/TRANSPORT) rarely co-occur on one invoice today.
 */
export function deriveCategory(invoice: Invoice): string {
  const items = invoice.items ?? [];
  if (items.length === 0) return "ACADEMIC";
  const anyItems = items as Array<{ amount: number; chargeCategory?: string }>;
  const dominant = anyItems.reduce((max, item) =>
    (item.amount ?? 0) > (max.amount ?? 0) ? item : max,
  anyItems[0]);
  return dominant.chargeCategory ?? "ACADEMIC";
}

/**
 * FR-CARD-01/02: late fee and discount as distinct, real figures -- never
 * fabricated. lateFee sums each unwaived LateFee's outstanding portion
 * (amount - amountWaived), not the raw assessed amount, so a partially
 * waived late fee doesn't overstate what's actually still owed.
 */
function deriveLateFee(invoice: Invoice): number {
  const fees = (invoice as any).lateFees as
    | Array<{ amount: number; amountWaived?: number; status?: string }>
    | undefined;
  if (!fees || fees.length === 0) return 0;
  return fees
    .filter((f) => f.status !== "WAIVED" && f.status !== "REVERSED")
    .reduce((sum, f) => sum + Math.max(0, (f.amount ?? 0) - (f.amountWaived ?? 0)), 0);
}

function deriveDiscount(invoice: Invoice): number {
  const items = (invoice.items ?? []) as Array<{ discountAmount?: number }>;
  return items.reduce((sum, item) => sum + (item.discountAmount ?? 0), 0);
}

/**
 * Builds one Fee Period Card's worth of data from a raw Invoice.
 * FR-COLLECT-08 / FDD Section 8.14: isOverdue is read directly from the
 * backend-computed field -- never recomputed here from status + dueDate,
 * per the invariant already carried in the Invoice type's own comment.
 */
export function toFeePeriod(invoice: Invoice): FeePeriod {
  const lateFee = deriveLateFee(invoice);
  const discount = deriveDiscount(invoice);
  const amount = invoice.totalAmount - discount; // totalAmount already reflects billed amount; discount is shown separately per FR-CARD-01
  const remaining = Math.max(0, invoice.dueAmount + lateFee);

  let status: FeePeriodStatus;
  if (invoice.status === "PAID" || invoice.dueAmount <= 0) {
    status = "PAID";
  } else if (invoice.isOverdue) {
    status = "OVERDUE";
  } else if (new Date(invoice.dueDate).getTime() > Date.now()) {
    status = "UPCOMING";
  } else {
    status = "DUE";
  }

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    label: deriveLabel(invoice),
    category: deriveCategory(invoice),
    amount,
    lateFee,
    discount,
    remaining,
    dueDate: invoice.dueDate,
    status,
    daysOverdue: invoice.isOverdue ? daysOverdue(invoice.dueDate) : 0,
  };
}

export interface GroupedFeePeriods {
  due: FeePeriod[];       // includes OVERDUE, sorted oldest-due-first (FDD Section 12.4)
  upcoming: FeePeriod[];
  paid: FeePeriod[];
}

/**
 * FDD Section 12.4: DRAFT and CANCELLED invoices never appear in the
 * Collect Fee workspace -- a DRAFT hasn't been sent to a student's account
 * yet, and a CANCELLED one is dead. Only SENT/PARTIALLY_PAID/PAID surface
 * here.
 */
export function groupFeePeriods(invoices: Invoice[]): GroupedFeePeriods {
  const relevant = invoices.filter(
    (inv) => inv.status !== "DRAFT" && inv.status !== "CANCELLED",
  );
  const periods = relevant.map(toFeePeriod);

  const due = periods
    .filter((p) => p.status === "DUE" || p.status === "OVERDUE")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  const upcoming = periods
    .filter((p) => p.status === "UPCOMING")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  const paid = periods
    .filter((p) => p.status === "PAID")
    .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());

  return { due, upcoming, paid };
}

/** FDD Section 12.3.1 -- Current Due / Overdue / Total Outstanding / Last Payment. */
export interface OutstandingSummary {
  currentDue: number;
  overdue: number;
  totalOutstanding: number;
  lastPaymentAmount?: number;
  lastPaymentDate?: string;
}

export function computeOutstandingSummary(
  grouped: GroupedFeePeriods,
  lastPayment?: { amount: number; date: string },
): OutstandingSummary {
  const overdue = grouped.due
    .filter((p) => p.status === "OVERDUE")
    .reduce((sum, p) => sum + p.remaining, 0);
  const currentDue = grouped.due
    .filter((p) => p.status === "DUE")
    .reduce((sum, p) => sum + p.remaining, 0);

  return {
    currentDue,
    overdue,
    totalOutstanding: currentDue + overdue,
    lastPaymentAmount: lastPayment?.amount,
    lastPaymentDate: lastPayment?.date,
  };
}
