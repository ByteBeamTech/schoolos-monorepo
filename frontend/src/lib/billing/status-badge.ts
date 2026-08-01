// frontend/src/lib/billing/status-badge.ts
//
// Extracted per the Student Billing reuse audit: an "xVariant(status,
// isOverdue)" badge-color function existed independently, slightly
// differently, in at least three billing pages. Consolidated for new
// Collect Fee code; existing pages are not migrated in this sprint.
//
// FDD Section 21 (Accessibility) / FR-COLLECT-08: status is communicated
// by icon + color + text together, never color alone. feePeriodStatusIcon
// exists specifically so no call site can render a status badge with color
// only by forgetting to also pick an icon.

import type { BadgeVariant } from "@/components/ui/badge";
import type { FeePeriodStatus } from "./fee-period";
import { AlertTriangle, Clock, CheckCircle2, CalendarClock } from "lucide-react";

export function feePeriodStatusVariant(status: FeePeriodStatus): BadgeVariant {
  switch (status) {
    case "OVERDUE":  return "error";
    case "DUE":       return "neutral"; // FDD 12.4.1: a normal, on-time Due row shows no badge at all -- see feePeriodStatusLabel
    case "UPCOMING":  return "info";
    case "PAID":      return "success";
  }
}

/**
 * FDD 12.4.1: "Absent entirely for a normal, on-time Due row; a status
 * badge only appears when there is something to flag." DUE intentionally
 * returns null here -- callers must not render a badge for it.
 */
export function feePeriodStatusIcon(status: FeePeriodStatus) {
  switch (status) {
    case "OVERDUE":  return AlertTriangle;
    case "UPCOMING":  return CalendarClock;
    case "PAID":      return CheckCircle2;
    case "DUE":       return null;
  }
}

export function feePeriodStatusLabel(status: FeePeriodStatus, daysOverdue: number): string | null {
  switch (status) {
    case "OVERDUE":  return daysOverdue > 0 ? `Overdue ${daysOverdue}d` : "Overdue";
    case "UPCOMING":  return "Upcoming";
    case "PAID":      return "Paid";
    case "DUE":       return null;
  }
}
