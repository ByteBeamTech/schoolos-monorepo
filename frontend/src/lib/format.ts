// frontend/src/lib/format.ts
//
// Extracted per the Student Billing reuse audit: fmt()/fmtDate() existed as
// three separate, near-identical hand-rolled copies across billing pages
// (billing/page.tsx, billing/students/[studentId]/page.tsx, billing/
// invoices/[id]/page.tsx). Consolidated here rather than writing a fourth
// copy for Collect Fee. Existing pages are not migrated to this module in
// this sprint -- only new Collect Fee code uses it -- to keep this sprint's
// diff scoped to what it's actually building.

export function fmt(n: number | string | null | undefined, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(n ?? 0));
}

export function fmtCompact(n: number | string | null | undefined): string {
  // For tight spaces (Student Summary Card, badges) where the ₹ symbol and
  // decimal precision of fmt() would crowd a small label. No currency
  // symbol, no paise -- whole rupees only, comma-grouped.
  return Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export function fmtDate(d?: string | Date | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateTime(d?: string | Date | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

export function daysOverdue(dueDate: string | Date): number {
  const due = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  const diffMs = Date.now() - due.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}
