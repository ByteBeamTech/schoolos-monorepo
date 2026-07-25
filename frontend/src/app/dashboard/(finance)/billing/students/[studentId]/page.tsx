"use client";
// frontend/src/app/dashboard/(finance)/billing/students/[studentId]/ledger/page.tsx
// Single financial truth for one student — invoices, payments, discounts, refunds

import { use }           from "react";
import { useRouter }     from "next/navigation";
import {
  ArrowLeft, CreditCard, FileText, Tag,
  RefreshCw, TrendingDown, CheckCircle2, Clock,
} from "lucide-react";
import { Badge }         from "@/components/ui/badge";
import { StatCard }      from "@/components/ui/stat-card";
import { useApi }        from "@/lib/hooks";
import Link              from "next/link";

// ── helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number | string, cur = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: cur, maximumFractionDigits: 2,
  }).format(Number(n ?? 0));
}
function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function invVariant(s: string, isOverdue: boolean) {
  if (s === "PAID") return "success";
  if (isOverdue)    return "error";
  const m: Record<string, any> = {
    SENT: "info", PARTIALLY_PAID: "warning", DRAFT: "neutral", CANCELLED: "neutral",
  };
  return m[s] ?? "neutral";
}
function payVariant(s: string) {
  return s === "SUCCESS" ? "success" : s === "FAILED" ? "error" : "warning";
}
function discountVariant(s: string) {
  return s === "APPROVED" ? "success" : s === "REJECTED" ? "error" : "warning";
}

export default function StudentLedgerPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = use(params);
  const router        = useRouter();

  // All data fetched in parallel
  const { data: student }   = useApi<any>(`/students/${studentId}`, [studentId]);
  const { data: invData }   = useApi<any>(`/billing/invoices?studentId=${studentId}&limit=100`, [studentId]);
  const { data: discounts } = useApi<any[]>(`/billing/discounts?studentId=${studentId}`, [studentId]);
  const { data: feePlans }  = useApi<any[]>(`/billing/fee-plans/student/${studentId}`, [studentId]);

  const invoices: any[]  = (invData as any)?.data ?? [];
  const discountList     = Array.isArray(discounts) ? discounts : [];
  const feePlanList      = Array.isArray(feePlans)  ? feePlans  : [];

  // Aggregate totals from invoices
  const totalInvoiced    = invoices.reduce((s, i) => s + Number(i.totalAmount), 0);
  const totalPaid        = invoices.reduce((s, i) => s + Number(i.paidAmount), 0);
  const outstanding      = invoices.reduce((s, i) => s + Number(i.dueAmount), 0);
  const totalDiscounted  = invoices.reduce((s, i) => s + Number(i.discountAmount ?? 0), 0);
  const overdueCount     = invoices.filter(i => i.isOverdue).length;

  const cur = invoices[0]?.currency ?? "INR";

  return (
    <div className="max-w-5xl">
      {/* Back */}
      <button onClick={() => router.back()}
        className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 text-sm mb-5 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Student header */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 text-xl font-bold flex-shrink-0">
              {student?.firstName?.[0] ?? "?"}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {student?.firstName} {student?.lastName}
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {student?.admissionNumber ?? "—"} · {student?.className ?? student?.classId ?? ""}
                {student?.sectionName ? ` · ${student.sectionName}` : ""}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{student?.email ?? student?.parentEmail ?? ""}</p>
            </div>
          </div>
          {outstanding > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-center">
              <p className="text-xs font-semibold text-red-500 uppercase tracking-wide">Outstanding</p>
              <p className="text-2xl font-bold text-red-600 mt-0.5">{fmt(outstanding, cur)}</p>
              {overdueCount > 0 && (
                <p className="text-xs text-red-400 mt-0.5">{overdueCount} overdue</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Invoiced"  value={fmt(totalInvoiced, cur)}   color="blue"  icon={<FileText  className="w-5 h-5" />} />
        <StatCard label="Total Paid"      value={fmt(totalPaid, cur)}        color="green" icon={<CheckCircle2 className="w-5 h-5" />} />
        <StatCard label="Outstanding"     value={fmt(outstanding, cur)}      color={outstanding > 0 ? "red" : "green"} icon={<CreditCard className="w-5 h-5" />} />
        <StatCard label="Total Discounts" value={fmt(totalDiscounted, cur)}  color="purple" icon={<Tag      className="w-5 h-5" />} />
      </div>

      {/* Fee plans assigned */}
      {feePlanList.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Assigned Fee Plans</h2>
          <div className="flex flex-wrap gap-3">
            {feePlanList.map((fp: any) => (
              <div key={fp.id} className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
                <FileText className="w-3.5 h-3.5 text-blue-500" />
                <div>
                  <p className="text-xs font-semibold text-blue-800">{fp.feePlan?.name ?? fp.name ?? fp.id}</p>
                  <p className="text-xs text-blue-400">{fp.academicYear}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invoices */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">
          Invoices <span className="text-slate-400 font-normal">({invoices.length})</span>
        </h2>
        {invoices.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No invoices yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Invoice","Due Date","Total","Paid","Due","Status",""].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pb-2 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {invoices.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 pr-4 font-mono text-xs text-slate-700">{inv.invoiceNumber}</td>
                    <td className="py-3 pr-4 text-slate-600">
                      <span className={new Date(inv.dueDate) < new Date() && inv.status !== "PAID" ? "text-red-500 font-medium" : ""}>
                        {fmtDate(inv.dueDate)}
                      </span>
                    </td>
                    <td className="py-3 pr-4 font-medium text-slate-800">{fmt(inv.totalAmount, cur)}</td>
                    <td className="py-3 pr-4 text-emerald-600">{fmt(inv.paidAmount, cur)}</td>
                    <td className="py-3 pr-4">
                      <span className={Number(inv.dueAmount) > 0 ? "text-red-600 font-semibold" : "text-slate-400"}>
                        {fmt(inv.dueAmount, cur)}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge label={inv.status.replace("_"," ")} variant={invVariant(inv.status, inv.isOverdue)} />
                    </td>
                    <td className="py-3">
                      <Link href={`/dashboard/billing/invoices/${inv.id}`}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200">
                <tr>
                  <td colSpan={2} className="pt-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</td>
                  <td className="pt-3 font-bold text-slate-900">{fmt(totalInvoiced, cur)}</td>
                  <td className="pt-3 font-bold text-emerald-700">{fmt(totalPaid, cur)}</td>
                  <td className="pt-3 font-bold text-red-600">{fmt(outstanding, cur)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Discounts */}
      {discountList.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">
            Discounts <span className="text-slate-400 font-normal">({discountList.length})</span>
          </h2>
          <div className="space-y-2">
            {discountList.map((d: any) => (
              <div key={d.id} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {d.category?.replace("_"," ")} — {d.type === "PERCENTAGE" ? `${d.value}%` : fmt(d.value, cur)}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {fmtDate(d.validFrom)} {d.validUntil ? `→ ${fmtDate(d.validUntil)}` : "· ongoing"}
                    {d.reason ? ` · ${d.reason}` : ""}
                  </p>
                </div>
                <Badge label={d.approvalStatus} variant={discountVariant(d.approvalStatus)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All payments across all invoices */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Payment History</h2>
        {invoices.every((i: any) => !i.payments?.length) ? (
          <p className="text-sm text-slate-400 text-center py-8">No payments recorded</p>
        ) : (
          <div className="space-y-2">
            {invoices
              .flatMap((i: any) => (i.payments ?? []).map((p: any) => ({ ...p, invoiceNumber: i.invoiceNumber, invoiceId: i.id })))
              .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((p: any) => (
                <div key={p.id} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                      p.status === "SUCCESS" ? "bg-emerald-100" : p.status === "FAILED" ? "bg-red-100" : "bg-amber-100"
                    }`}>
                      {p.status === "SUCCESS" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        : p.status === "FAILED" ? <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                        : <Clock className="w-3.5 h-3.5 text-amber-500" />}
                    </div>
                    <div>
                      <p className="text-sm text-slate-800">
                        {p.paymentMethod ?? p.gateway}
                        {p.gatewayPaymentId && p.gateway === "OFFLINE"
                          ? <span className="text-xs text-slate-400 ml-1">· {p.gatewayPaymentId}</span>
                          : null}
                      </p>
                      <p className="text-xs text-slate-400">
                        <Link href={`/dashboard/billing/invoices/${p.invoiceId}`}
                          className="hover:text-blue-600 transition-colors">{p.invoiceNumber}</Link>
                        {" · "}{fmtDate(p.paidAt ?? p.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">{fmt(p.amount, cur)}</p>
                    <Badge label={p.status} variant={payVariant(p.status)} />
                  </div>
                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  );
}
