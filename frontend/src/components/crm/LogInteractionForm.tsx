"use client";
import { useState } from "react";
import type { CreateInteractionRequest, InteractionDirection, InteractionType } from "@/lib/api";
import { useCrmActions } from "@/lib/hooks";
import { useToast } from "@/lib/use-toast";

interface Props {
  leadId: string;
  onLogged?: () => void;
}

const TYPE_LABELS: Record<InteractionType, string> = {
  CALL: "Call", WHATSAPP: "WhatsApp", EMAIL: "Email", SMS: "SMS", MEETING: "Meeting",
};

export function LogInteractionForm({ leadId, onLogged }: Props) {
  const { logInteraction } = useCrmActions();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<CreateInteractionRequest>({
    type: "CALL", direction: "OUTBOUND", summary: "",
  });

  const submit = async () => {
    if (!form.summary.trim()) return;
    setBusy(true);
    try {
      await logInteraction(leadId, { ...form, summary: form.summary.trim() });
      toast.success("Interaction logged");
      setForm({ type: "CALL", direction: "OUTBOUND", summary: "" });
      onLogged?.();
    } catch (e: any) {
      toast.error(e);
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select
          className="px-3 py-1.5 rounded-md text-sm border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
          value={form.type}
          onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as InteractionType }))}
        >
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select
          className="px-3 py-1.5 rounded-md text-sm border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
          value={form.direction}
          onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value as InteractionDirection }))}
        >
          <option value="OUTBOUND">Outbound</option>
          <option value="INBOUND">Inbound</option>
        </select>
      </div>
      <textarea
        rows={3}
        placeholder="What did you discuss?"
        className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
        value={form.summary}
        onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
      />
      <div className="flex justify-end mt-3">
        <button
          onClick={submit}
          disabled={busy || !form.summary.trim()}
          className="px-4 py-2 rounded-md bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 disabled:opacity-50"
        >
          {busy ? "Logging..." : "Log Interaction"}
        </button>
      </div>
    </div>
  );
}
