"use client";
// frontend/src/components/billing/DueUpcomingPaidSections.tsx
//
// FDD Section 12.4 -- Due / Upcoming / Paid, selection behavior.

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmt } from "@/lib/format";
import { FeePeriodCard } from "./FeePeriodCard";
import type { GroupedFeePeriods } from "@/lib/billing/fee-period";

interface DueUpcomingPaidSectionsProps {
  grouped: GroupedFeePeriods;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onViewDetails: (invoiceId: string) => void;
  /** FDD Section 8.10 / Section 24 item 7: whether advance payment is
   *  permitted is a school-level setting whose backend mechanism is
   *  unverified. The Collect Fee page passes false here until that is
   *  confirmed -- see the page component for the explicit note. This
   *  component does not decide the default; it only renders whichever
   *  value it's given. */
  advancePaymentAllowed: boolean;
}

export function DueUpcomingPaidSections({
  grouped, selectedIds, onSelectionChange, onViewDetails, advancePaymentAllowed,
}: DueUpcomingPaidSectionsProps) {
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [paidOpen, setPaidOpen] = useState(false);

  const toggle = (invoiceId: string) => {
    const next = new Set(selectedIds);
    if (next.has(invoiceId)) next.delete(invoiceId);
    else next.add(invoiceId);
    onSelectionChange(next);
  };

  // FR-COLLECT-05: always the complete Due set, full stop -- never additive
  // to an existing partial selection, never touches Upcoming.
  const selectAllDue = () => {
    onSelectionChange(new Set(grouped.due.map((p) => p.invoiceId)));
  };
  const clearSelection = () => onSelectionChange(new Set());

  const selectedCount = selectedIds.size;
  const selectedTotal = [...grouped.due, ...grouped.upcoming]
    .filter((p) => selectedIds.has(p.invoiceId))
    .reduce((sum, p) => sum + p.remaining, 0);

  return (
    <div className="rounded-lg border bg-white" style={{ borderColor: "var(--border-light)" }}>
      {/* DUE -- FDD 12.4: expanded by default, always visible */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: "var(--border-light)" }}>
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Due</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={selectAllDue} disabled={grouped.due.length === 0}>
            Select All Due
          </Button>
          <Button variant="ghost" size="sm" onClick={clearSelection} disabled={selectedCount === 0}>
            Clear
          </Button>
        </div>
      </div>

      {/* FR-COLLECT-09: internal scroll cap so the payment panel below is
          never pushed off-screen by a long Due list. */}
      <div className="max-h-[280px] overflow-y-auto">
        {grouped.due.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-400 text-center">No dues pending — all fees paid.</p>
        ) : (
          grouped.due.map((period) => (
            <FeePeriodCard
              key={period.invoiceId}
              period={period}
              selected={selectedIds.has(period.invoiceId)}
              selectable
              showCheckbox
              onToggleSelect={toggle}
              onViewDetails={onViewDetails}
            />
          ))
        )}
      </div>

      <div className="px-4 py-2 text-sm border-t flex justify-between" style={{ borderColor: "var(--border-light)" }}>
        <span className="text-slate-500">
          Selected: {selectedCount} {selectedCount === 1 ? "period" : "periods"}
        </span>
        <span className="font-semibold" style={{ color: selectedCount === 0 ? "var(--text-tertiary)" : "var(--text-primary)" }}>
          {selectedCount === 0 ? "No periods selected" : fmt(selectedTotal)}
        </span>
      </div>

      {/* UPCOMING -- FDD 12.4: always visible, collapsed by default, never
          bulk-selectable regardless of advancePaymentAllowed. */}
      <div className="border-t" style={{ borderColor: "var(--border-light)" }}>
        <button
          onClick={() => setUpcomingOpen((v) => !v)}
          className="w-full flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:bg-slate-50"
        >
          {upcomingOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          Upcoming ({grouped.upcoming.length})
        </button>
        {upcomingOpen && (
          <div>
            {grouped.upcoming.length === 0 ? (
              <p className="px-4 py-4 text-sm text-slate-400 text-center">No upcoming periods.</p>
            ) : (
              grouped.upcoming.map((period) => (
                <FeePeriodCard
                  key={period.invoiceId}
                  period={period}
                  selected={selectedIds.has(period.invoiceId)}
                  selectable={advancePaymentAllowed}
                  showCheckbox
                  collapsed
                  onToggleSelect={toggle}
                  onViewDetails={onViewDetails}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* PAID -- collapsed by default, no selection */}
      <div className="border-t" style={{ borderColor: "var(--border-light)" }}>
        <button
          onClick={() => setPaidOpen((v) => !v)}
          className="w-full flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:bg-slate-50"
        >
          {paidOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          Paid ({grouped.paid.length}) — view
        </button>
        {paidOpen && (
          <div>
            {grouped.paid.map((period) => (
              <FeePeriodCard
                key={period.invoiceId}
                period={period}
                selected={false}
                selectable={false}
                showCheckbox={false}
                collapsed
                onToggleSelect={() => {}}
                onViewDetails={onViewDetails}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
