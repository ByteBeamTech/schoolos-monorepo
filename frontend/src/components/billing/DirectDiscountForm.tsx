"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/lib/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DirectDiscountForm({
  invoiceId,
  onApplied,
  onCancel,
}: {
  invoiceId: string;
  onApplied: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [type, setType] = useState<"FIXED" | "PERCENTAGE">("FIXED");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const apply = async () => {
    const amount = Number(value);
    if (!amount || amount <= 0 || !reason.trim()) {
      toast.error("Enter a positive discount and a reason.");
      return;
    }
    if (type === "PERCENTAGE" && amount > 100) {
      toast.error("Percentage discount cannot exceed 100%.");
      return;
    }
    setSaving(true);
    try {
      await apiClient.patch(`/billing/invoices/${invoiceId}/direct-discount`, {
        type, value: amount, reason: reason.trim(),
      });
      toast.success("Direct discount applied.");
      onApplied();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to apply discount");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
      <p className="text-sm font-semibold text-emerald-800 mb-3">Apply one-time discount</p>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <select value={type} onChange={(e) => setType(e.target.value as "FIXED" | "PERCENTAGE")}
          className="px-3 py-2 text-sm border border-emerald-200 rounded-lg bg-white">
          <option value="FIXED">Fixed amount</option>
          <option value="PERCENTAGE">Percentage</option>
        </select>
        <Input type="number" min="0" max={type === "PERCENTAGE" ? 100 : undefined}
          value={value} onChange={(e) => setValue(e.target.value)} placeholder={type === "PERCENTAGE" ? "e.g. 10" : "e.g. 500"} />
      </div>
      <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" />
      <div className="flex gap-2 mt-3">
        <Button onClick={apply} disabled={saving}>{saving ? "Applying…" : "Apply discount"}</Button>
        <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
      </div>
    </div>
  );
}
