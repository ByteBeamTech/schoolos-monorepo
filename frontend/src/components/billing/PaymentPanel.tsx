"use client";
// frontend/src/components/billing/PaymentPanel.tsx
//
// FDD Section 12.6 -- Payment Panel, complete field specification.

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmt } from "@/lib/format";
import type { Student } from "@/lib/hooks";
import type { FeePeriod } from "@/lib/billing/fee-period";
import { computeAllocation, selectedTotal } from "@/lib/billing/allocation";
import { PAYMENT_METHODS, type OfflinePaymentMethod } from "@/lib/billing/payment-method";
import { AllocationPreview } from "./AllocationPreview";
import type { CollectionInput } from "@/lib/billing/collect";

interface PaymentPanelProps {
  selectedPeriods: FeePeriod[];
  student: Student;
  submitting: boolean;
  onCollect: (input: CollectionInput, allocationLines: ReturnType<typeof computeAllocation>["lines"]) => void;
}

export function PaymentPanel({ selectedPeriods, student, submitting, onCollect }: PaymentPanelProps) {
  const total = useMemo(() => selectedTotal(selectedPeriods), [selectedPeriods]);
  const [amount, setAmount] = useState(total);
  const [method, setMethod] = useState<OfflinePaymentMethod>("CASH");
  const [reference, setReference] = useState("");

  const primaryGuardian =
    student.guardianLinks?.find((l) => l.isPrimary) ?? student.guardianLinks?.[0];
  const [payerMode, setPayerMode] = useState<"guardian" | "manual">(primaryGuardian ? "guardian" : "manual");
  const [payerName, setPayerName] = useState("");

  // FR-PANEL-02: Amount defaults to the sum of selected periods -- and
  // resets to the new total whenever the selection itself changes. A
  // manual edit is scoped to the selection it was made against; it does
  // not carry over to a different selection.
  useEffect(() => { setAmount(total); }, [total]);

  const methodConfig = PAYMENT_METHODS.find((m) => m.value === method)!;
  const allocation = useMemo(
    () => computeAllocation(selectedPeriods, amount),
    [selectedPeriods, amount],
  );

  const payerId = payerMode === "guardian" ? primaryGuardian?.guardian.id : undefined;
  const effectivePayerName = payerMode === "manual" ? payerName.trim() : undefined;
  const payerLabel = payerMode === "guardian" && primaryGuardian
    ? `${primaryGuardian.guardian.firstName} ${primaryGuardian.guardian.lastName}`
    : effectivePayerName;

  // FR-PANEL-02 / FDD 8.4: hard ceiling, prevented at input, not merely by
  // relying on the backend's rejection.
  const handleAmountChange = (raw: string) => {
    const value = Math.max(0, Number(raw) || 0);
    setAmount(Math.min(value, total));
  };

  const canCollect =
    selectedPeriods.length > 0 &&
    amount > 0 &&
    (payerId || (effectivePayerName && effectivePayerName.length > 0)) &&
    !submitting;

  // FR-PANEL-06: the confirmation line, reactive to amount, period count,
  // method, and payer -- every one of the four, not just selection.
  const confirmationLine = canCollect
    ? `Collecting ${fmt(amount)} · ${selectedPeriods.length} ${selectedPeriods.length === 1 ? "period" : "periods"} · ${methodConfig.label} · Paid by ${payerLabel}`
    : null;

  const handleCollect = () => {
    if (!canCollect) return;
    onCollect(
      { method, referenceNumber: reference || undefined, payerId, payerName: effectivePayerName, payerLabel },
      allocation.lines,
    );
  };

  return (
    <div
      className={`rounded-lg border bg-white px-4 py-4 space-y-3 transition-opacity ${selectedPeriods.length === 0 ? "opacity-50" : ""}`}
      style={{ borderColor: "var(--border-light)" }}
    >
      {selectedPeriods.length >= 2 && <AllocationPreview allocation={allocation} />}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Amount</label>
          <Input
            type="number"
            value={selectedPeriods.length === 0 ? "" : amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            disabled={selectedPeriods.length === 0 || submitting}
            max={total}
            min={0}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Paid By</label>
          {payerMode === "guardian" && primaryGuardian ? (
            <button
              type="button"
              onClick={() => setPayerMode("manual")}
              disabled={submitting}
              className="w-full text-left px-3 py-2 border rounded-md text-sm hover:bg-slate-50"
              style={{ borderColor: "var(--border-light)" }}
            >
              {primaryGuardian.guardian.firstName} {primaryGuardian.guardian.lastName}
              <span className="text-xs text-slate-400 ml-1">(edit)</span>
            </button>
          ) : (
            <Input
              value={payerName}
              onChange={(e) => setPayerName(e.target.value)}
              placeholder="Enter payer name"
              disabled={submitting}
            />
          )}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-slate-500 mb-1 block">Method</label>
        <div className="flex gap-2 flex-wrap">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMethod(m.value)}
              disabled={selectedPeriods.length === 0 || submitting}
              className={[
                "px-3 py-1.5 rounded-md text-sm border transition-colors",
                method === m.value
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-700 hover:bg-slate-50",
              ].join(" ")}
              style={{ borderColor: method === m.value ? undefined : "var(--border-light)" }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {methodConfig.needsReference && selectedPeriods.length > 0 && (
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">
            Reference # <span className="text-slate-400">(optional — UTR / transaction ID)</span>
          </label>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} disabled={submitting} />
        </div>
      )}

      {confirmationLine && (
        <p className="text-xs text-slate-500 border-t pt-2" style={{ borderColor: "var(--border-light)" }}>
          {confirmationLine}
        </p>
      )}

      <Button
        onClick={handleCollect}
        disabled={!canCollect}
        className="w-full"
      >
        {submitting ? "Collecting…" : amount > 0 ? `Collect ${fmt(amount)}` : "Collect"}
      </Button>
    </div>
  );
}
