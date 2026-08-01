"use client";
// frontend/src/components/billing/FeePeriodCard.tsx
//
// FDD Section 12.4.1 -- Fee Period Card, component specification. The row
// rendered for every period in Due, Upcoming, and Paid (FDD Section 12.4).

import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { fmt } from "@/lib/format";
import type { FeePeriod } from "@/lib/billing/fee-period";
import { feePeriodStatusVariant, feePeriodStatusIcon, feePeriodStatusLabel } from "@/lib/billing/status-badge";

interface FeePeriodCardProps {
  period: FeePeriod;
  selected: boolean;
  /** FDD Section 24, item 7: the mechanism governing whether advance
   *  payment is permitted is unverified against the backend. Until that is
   *  confirmed, callers pass selectable=false for every Upcoming row --
   *  see the collect-fee page for where this default is applied. This
   *  component itself supports both states; it does not decide the
   *  default. */
  selectable: boolean;
  /** FDD Section 12.4: Paid rows have nothing to select. */
  showCheckbox: boolean;
  onToggleSelect: (invoiceId: string) => void;
  onViewDetails: (invoiceId: string) => void;
  /** FDD 12.4.1 "Collapsed": default for Upcoming and Paid rows -- Header,
   *  Status, and Remaining only, no Late Fee/Discount breakdown. */
  collapsed?: boolean;
}

export function FeePeriodCard({
  period, selected, selectable, showCheckbox,
  onToggleSelect, onViewDetails, collapsed = false,
}: FeePeriodCardProps) {
  const StatusIcon = feePeriodStatusIcon(period.status);
  const statusLabel = feePeriodStatusLabel(period.status, period.daysOverdue);
  const hasLateFee = period.lateFee > 0;
  const hasDiscount = period.discount > 0;
  // FDD 12.4.1: Expanded (Fee Head Breakdown) state renders separately,
  // below the Due list -- not inside the row. This component only ever
  // shows its own Amount/Late Fee/Discount/Remaining lines, never a full
  // item-level breakdown; that's a distinct region (FDD Section 12.3).
  const showBreakdownLines = !collapsed && (hasLateFee || hasDiscount);

  const clickable = showCheckbox; // FR-COLLECT-07: whole row toggles selection, only when selection is meaningful
  const handleRowClick = () => {
    if (clickable && selectable) onToggleSelect(period.invoiceId);
  };

  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable && selectable ? 0 : undefined}
      onClick={handleRowClick}
      onKeyDown={(e) => {
        if (clickable && selectable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onToggleSelect(period.invoiceId);
        }
      }}
      className={[
        "flex items-start gap-3 px-4 py-3 border-b transition-colors last:border-b-0",
        clickable && selectable ? "cursor-pointer hover:bg-slate-50" : "",
        selected ? "bg-blue-50/60" : "",
      ].join(" ")}
      style={{ borderColor: "var(--border-light)" }}
      aria-selected={selected}
    >
      {showCheckbox && (
        <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selected}
            onCheckedChange={() => selectable && onToggleSelect(period.invoiceId)}
            disabled={!selectable}
            aria-label={`Select ${period.label}`}
          />
        </div>
      )}

      <div className="flex-1 min-w-0">
        {/* Header + Status -- FDD 12.4.1 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
            {period.label}
          </span>
          <Badge label={period.category} variant="secondary" />
          {statusLabel && (
            <Badge
              variant={feePeriodStatusVariant(period.status)}
              className="inline-flex items-center gap-1"
            >
              {StatusIcon && <StatusIcon className="w-3 h-3" />}
              {statusLabel}
            </Badge>
          )}
          {!selectable && showCheckbox && (
            <span className="text-xs text-slate-400">Not open for advance payment yet</span>
          )}
        </div>

        {/* Amount / Late Fee / Discount -- shown only when real (FR-CARD-01) */}
        {showBreakdownLines && (
          <div className="mt-1.5 text-xs space-y-0.5" style={{ color: "var(--text-tertiary)" }}>
            <div className="flex justify-between max-w-[220px]">
              <span>Amount</span><span>{fmt(period.amount)}</span>
            </div>
            {hasLateFee && (
              <div className="flex justify-between max-w-[220px] text-red-600">
                <span>Late Fee</span><span>+{fmt(period.lateFee)}</span>
              </div>
            )}
            {hasDiscount && (
              <div className="flex justify-between max-w-[220px] text-green-700">
                <span>Discount</span><span>−{fmt(period.discount)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Remaining + Actions (FR-CARD-02; FR-COLLECT-07's carved-out click zone) */}
      <div className="text-right flex-shrink-0">
        <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
          {fmt(period.remaining)}
        </p>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onViewDetails(period.invoiceId); }}
          className="text-xs text-blue-600 hover:text-blue-700 hover:underline mt-1"
        >
          View Details
        </button>
      </div>
    </div>
  );
}
