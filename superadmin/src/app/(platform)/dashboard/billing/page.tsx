"use client";
import { CreditCard, Download } from "lucide-react";
import { PageHeader }      from "@/components/ui/page-header";
import { StatCard }        from "@/components/ui/stat-card";
import { Badge }           from "@/components/ui/badge";
import { useApi, SaasInvoice } from "@/lib/hooks";
import { formatDate, formatCurrency } from "@/lib/utils";

function invoiceStatusVariant(s: string) {
  if (s === "PAID")           return "success" as const;
  if (s === "SENT")           return "info" as const;
  if (s === "OVERDUE")        return "error" as const;
  if (s === "PARTIALLY_PAID") return "warning" as const;
  return "neutral" as const;
}

export default function BillingPage() {
  const { data: invoices, loading } = useApi<{ data: SaasInvoice[] }>("/saas/invoices?limit=50");
  const list = invoices?.data ?? [];

  const totalCollected = list.filter(i => i.status === "PAID").reduce((s, i) => s + Number(i.totalAmount), 0);
  const totalPending   = list.filter(i => i.status === "SENT").reduce((s, i) => s + Number(i.totalAmount), 0);
  const totalOverdue   = list.filter(i => i.status === "OVERDUE").reduce((s, i) => s + Number(i.totalAmount), 0);

  return (
    <div>
      <PageHeader title="SaaS Billing" subtitle="Money schools pay SchoolOS" />

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Collected"    value={formatCurrency(totalCollected)} loading={loading} />
        <StatCard label="Pending"      value={formatCurrency(totalPending)}   loading={loading} />
        <StatCard label="Overdue"      value={formatCurrency(totalOverdue)}   loading={loading} />
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-slate-500" />
          <h2 className="font-semibold text-slate-200 text-sm">SaaS Invoices</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              {["Invoice", "School", "Period", "Amount", "Status", "Due Date"].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {loading ? [...Array(6)].map((_, i) => (
              <tr key={i}>
                {[...Array(6)].map((_, j) => (
                  <td key={j} className="px-5 py-4"><div className="h-4 bg-slate-800 rounded animate-pulse" /></td>
                ))}
              </tr>
            )) : list.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-16 text-center text-slate-500">
                No invoices yet — billing module wires to backend /saas/invoices
              </td></tr>
            ) : list.map(inv => (
              <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="px-5 py-3.5 font-mono text-xs text-slate-300">{inv.invoiceNumber}</td>
                <td className="px-5 py-3.5 text-slate-300">{inv.subscription?.tenant?.name ?? "—"}</td>
                <td className="px-5 py-3.5 text-xs text-slate-500">
                  {formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}
                </td>
                <td className="px-5 py-3.5 font-semibold text-slate-200">
                  {formatCurrency(Number(inv.totalAmount), inv.currency)}
                </td>
                <td className="px-5 py-3.5">
                  <Badge label={inv.status} variant={invoiceStatusVariant(inv.status)} />
                </td>
                <td className="px-5 py-3.5 text-xs text-slate-500">{formatDate(inv.dueDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
