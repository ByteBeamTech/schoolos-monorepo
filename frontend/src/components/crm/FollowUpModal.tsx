"use client";
import { useState } from "react";
import type { CreateFollowUpRequest } from "@/lib/api";
import { useCrmActions } from "@/lib/hooks";
import { useToast } from "@/lib/use-toast";

interface Props {
  leadId: string;
  onClose: () => void;
  onCreated?: () => void;
}

export function FollowUpModal({ leadId, onClose, onCreated }: Props) {
  const { createFollowUp } = useCrmActions();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<CreateFollowUpRequest>({
    title: "",
    description: "",
    dueDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16),
  });

  const submit = async () => {
    if (!form.title.trim()) return;
    setBusy(true);
    try {
      await createFollowUp(leadId, {
        ...form,
        dueDate: new Date(form.dueDate).toISOString(),
        description: form.description?.trim() || undefined,
      });
      toast({ title: "Follow-up scheduled" });
      onCreated?.();
      onClose();
    } catch (e: any) {
      toast({ title: "Couldn't schedule", description: e?.response?.data?.message ?? "Try again", variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white dark:bg-zinc-950 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">New follow-up</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">✕</button>
        </div>
        <div className="space-y-4">
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-zinc-500">Title *</span>
            <input
              className="mt-1 w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Call back about admission tour"
              required
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-zinc-500">Due date *</span>
            <input
              type="datetime-local"
              className="mt-1 w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-zinc-500">Notes</span>
            <textarea
              className="mt-1 w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm min-h-[80px]"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancel</button>
          <button
            disabled={busy || !form.title.trim()}
            onClick={submit}
            className="px-4 py-2 rounded-md bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 disabled:opacity-50"
          >
            {busy ? "Saving..." : "Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}
