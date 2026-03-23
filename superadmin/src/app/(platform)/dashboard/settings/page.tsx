"use client";
import { PageHeader } from "@/components/ui/page-header";

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Platform Settings" subtitle="Global configuration for SchoolOS" />
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-12 text-center">
        <p className="text-4xl mb-4">⚙️</p>
        <p className="text-slate-300 font-semibold text-lg">Settings UI coming soon</p>
        <p className="text-slate-500 text-sm mt-2">Region control, gateway config, and platform-wide toggles</p>
      </div>
    </div>
  );
}
