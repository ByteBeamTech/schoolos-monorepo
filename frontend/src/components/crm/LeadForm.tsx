"use client";
import { useState } from "react";
import type { CreateLeadRequest, LeadTemperature } from "@/lib/api";
import { useCrmActions } from "@/lib/hooks";
import { useToast } from "@/lib/use-toast";

interface LeadFormProps {
  onComplete: (id: string) => void;
  onCancel?: () => void;
}

export function LeadForm({ onComplete, onCancel }: LeadFormProps) {
  const { createLead } = useCrmActions();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<CreateLeadRequest>({
    parentName: "",
    parentPhone: "",
    parentEmail: "",
    studentName: "",
    gradeInterestedIn: "",
    expectedEnrollYear: new Date().getFullYear() + 1,
    temperature: "WARM",
    initialNote: "",
  });

  const set = <K extends keyof CreateLeadRequest>(k: K, v: CreateLeadRequest[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.parentName?.trim() || !form.parentPhone?.trim() || !form.gradeInterestedIn?.trim()) {
      toast.error("Parent name, phone, and grade are required.");
      return;
    }
    setSubmitting(true);
    try {
      const payload: CreateLeadRequest = {
        ...form,
        parentEmail: form.parentEmail?.trim() || undefined,
        studentName: form.studentName?.trim() || undefined,
        initialNote: form.initialNote?.trim() || undefined,
      };
      const lead = await createLead(payload);
      toast.success("Lead created", { description: `Lead ${lead.parentName} added to pipeline.` });
      onComplete(lead.id);
    } catch (e: any) {
      toast.error(e);
    } finally { setSubmitting(false); }
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit(); }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Parent name *">
          <input className={INPUT_CLS} required value={form.parentName} onChange={(e) => set("parentName", e.target.value)} />
        </Field>
        <Field label="Parent phone *">
          <input className={INPUT_CLS} required value={form.parentPhone} onChange={(e) => set("parentPhone", e.target.value)} />
        </Field>
        <Field label="Parent email">
          <input className={INPUT_CLS} type="email" value={form.parentEmail ?? ""} onChange={(e) => set("parentEmail", e.target.value)} />
        </Field>
        <Field label="Student name">
          <input className={INPUT_CLS} value={form.studentName ?? ""} onChange={(e) => set("studentName", e.target.value)} />
        </Field>
        <Field label="Grade interested in *">
          <input className={INPUT_CLS} required value={form.gradeInterestedIn} onChange={(e) => set("gradeInterestedIn", e.target.value)} />
        </Field>
        <Field label="Expected enrol year *">
          <input className={INPUT_CLS} type="number" min={2020} max={2099} required value={form.expectedEnrollYear} onChange={(e) => set("expectedEnrollYear", Number(e.target.value))} />
        </Field>
        <Field label="Temperature">
          <select className={INPUT_CLS} value={form.temperature ?? "WARM"} onChange={(e) => set("temperature", e.target.value as LeadTemperature)}>
            <option value="COLD">Cold</option>
            <option value="WARM">Warm</option>
            <option value="HOT">Hot</option>
          </select>
        </Field>
      </div>
      <Field label="Initial note">
        <textarea className={`${INPUT_CLS} min-h-[80px]`} value={form.initialNote ?? ""} onChange={(e) => set("initialNote", e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 rounded-md bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Create Lead"}
        </button>
      </div>
    </form>
  );
}

const INPUT_CLS = "w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400 font-medium">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
