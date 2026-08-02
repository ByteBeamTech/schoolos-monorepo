// frontend/src/lib/billing/timeline.ts
//
// FDD Section 14.4, FR-PROFILE-03/05. Assembled client-side from data
// already fetched for the Profile's other tabs -- no backend timeline
// endpoint exists (Constraint, Section 24 item 3), and this is the
// correct permanent approach given that, not a placeholder.
//
// FR-PROFILE-05 is explicit that Waiver must never share a visual with
// Discount (different facts: a waiver forgives an already-assessed late
// fee; a discount reduces a charge before billing), and Late Fee must be
// visually distinct from the Overdue status icon used elsewhere (Section
// 12.4.1) -- an assessment event and a currently-overdue period are
// different facts. Six distinct icons below, one per event type, chosen
// so no two are the same component.

import { FileText, Receipt as ReceiptIcon, Tag, ShieldCheck, AlertOctagon, CircleDollarSign } from "lucide-react";
import type { Invoice, DiscountSummary } from "@/lib/hooks";
import { fmt } from "@/lib/format";

export type TimelineEventType = "INVOICE_ISSUED" | "PAYMENT" | "RECEIPT" | "DISCOUNT" | "LATE_FEE" | "WAIVER";

export interface TimelineEvent {
  type: TimelineEventType;
  date: string;
  label: string;
  amount?: number;
}

export const TIMELINE_ICONS: Record<TimelineEventType, typeof FileText> = {
  INVOICE_ISSUED: FileText,
  RECEIPT: ReceiptIcon,
  PAYMENT: CircleDollarSign,
  DISCOUNT: Tag,
  // FR-PROFILE-05: deliberately not Tag or any Discount-adjacent icon.
  WAIVER: ShieldCheck,
  // FR-PROFILE-05: deliberately not the Overdue AlertTriangle used in
  // status-badge.ts -- related but distinct facts get distinct icons.
  LATE_FEE: AlertOctagon,
};

export function buildTimeline(invoices: Invoice[], discounts: DiscountSummary[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const inv of invoices) {
    if (inv.issuedAt) {
      events.push({ type: "INVOICE_ISSUED", date: inv.issuedAt, label: `Invoice ${inv.invoiceNumber} issued`, amount: inv.totalAmount });
    }
    for (const p of inv.payments ?? []) {
      if (p.status === "SUCCESS" && p.paidAt) {
        events.push({ type: "PAYMENT", date: p.paidAt, label: `Payment received (${inv.invoiceNumber})`, amount: p.amount });
      }
    }
    for (const r of inv.receipts ?? []) {
      events.push({ type: "RECEIPT", date: r.createdAt, label: `Receipt ${r.receiptNumber} created`, amount: r.amount });
    }
    for (const lf of inv.lateFees ?? []) {
      if (lf.appliedAt) {
        events.push({ type: "LATE_FEE", date: lf.appliedAt, label: `Late fee assessed (${inv.invoiceNumber})`, amount: lf.amount });
      }
      if (lf.waivedAt) {
        events.push({ type: "WAIVER", date: lf.waivedAt, label: `Late fee waived (${inv.invoiceNumber})`, amount: lf.amountWaived });
      }
    }
  }

  // Scoped to what useStudentBilling already fetches (approvalStatus=APPROVED
  // discounts only) -- a deliberate scoping choice for Sprint 4, not a
  // silent narrowing of FDD intent: the Discounts page (Section 16) is the
  // place for the full approval history, this Timeline shows a student's
  // actual financial activity, not every pending/rejected request.
  for (const d of discounts) {
    if (d.createdAt) {
      events.push({ type: "DISCOUNT", date: d.createdAt, label: `${d.category?.name ?? "Discount"} applied`, amount: d.appliedAmount });
    }
  }

  return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function timelineEventDescription(event: TimelineEvent): string {
  return event.amount != null ? `${event.label} — ${fmt(event.amount)}` : event.label;
}
