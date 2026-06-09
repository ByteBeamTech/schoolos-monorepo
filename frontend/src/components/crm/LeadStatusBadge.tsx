"use client";
import type { LeadStatus } from "@/lib/api";

const LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  FOLLOW_UP: "Follow-up",
  VISIT_SCHEDULED: "Visit Scheduled",
  INTERESTED: "Interested",
  APPLICATION_STARTED: "App Started",
  APPLICATION_SUBMITTED: "App Submitted",
  APPROVED: "Approved",
  ENROLLED: "Enrolled",
  LOST: "Lost",
};

const COLORS: Record<LeadStatus, string> = {
  NEW: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200",
  CONTACTED: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200",
  FOLLOW_UP: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  VISIT_SCHEDULED: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200",
  INTERESTED: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200",
  APPLICATION_STARTED: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200",
  APPLICATION_SUBMITTED: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-200",
  APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
  ENROLLED: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200",
  LOST: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export function LeadStatusBadge({ status, className = "" }: { status: LeadStatus; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${COLORS[status]} ${className}`}>
      {LABELS[status]}
    </span>
  );
}

export const LEAD_STATUS_LABELS = LABELS;
export const LEAD_STATUS_ORDER: LeadStatus[] = [
  "NEW", "CONTACTED", "FOLLOW_UP", "VISIT_SCHEDULED", "INTERESTED",
  "APPLICATION_STARTED", "APPLICATION_SUBMITTED", "APPROVED", "ENROLLED", "LOST",
];
