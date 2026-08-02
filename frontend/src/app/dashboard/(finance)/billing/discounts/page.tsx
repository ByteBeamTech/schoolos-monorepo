"use client";
import { useState }     from "react";
import { useRouter }    from "next/navigation";
import { ArrowLeft, Check, X, Tag } from "lucide-react";
import { PageHeader }   from "@/components/ui/page-header";
import { Badge }        from "@/components/ui/badge";
import { StatCard }     from "@/components/ui/stat-card";
import { useApi } from "@/lib/hooks";
import { apiClient }    from "@/lib/api";
import { useToast } from '@/lib/use-toast';
import { useAuthStore } from "@/lib/store";
import { formatDiscountValue } from "@/lib/billing/discount-options";


function approvalVariant(s: string) {
  if (s === "APPROVED") return "success" as const;
  if (s === "REJECTED") return "error"   as const;
  if (s === "PENDING")  return "warning" as const;
  return "neutral" as const;
}

export default function DiscountsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuthStore();
  // FR-ROLE-03 / FDD Section 4.2: approve/reject are never rendered for a
  // role that will always be rejected by the backend -- matches the exact
  // role list @Roles('SCHOOL_ADMIN', 'PRINCIPAL') enforces server-side,
  // confirmed directly against discount.controller.ts before writing this.
  const canApprove = user?.role === "SCHOOL_ADMIN" || user?.role === "PRINCIPAL";

  const [statusFilter, setStatusFilter] = useState("");
  const [acting,   setActing]   = useState("");

  const url = `/billing/discounts${statusFilter ? `?approvalStatus=${statusFilter}` : ""}`;
  const { data: discounts, loading, refetch } = useApi<any[]>(url, [statusFilter]);

  const pending  = (discounts ?? []).filter(d => d.approvalStatus === "PENDING").length;
  const approved = (discounts ?? []).filter(d => d.approvalStatus === "APPROVED").length;

  // Discount creation moved to Student Financial Profile -- FR-DISC-02:
  // "Discount creation happens on a student's Profile, never as a form on
  // this page — this page is for review, not origination." Confirmed
  // this page previously violated that (an inline "New Discount Request"
  // form here). The CreateDiscountDto fields it used were genuinely
  // correct against the backend (unlike the payment forms found broken
  // in Sprint 1/5) -- this is a structural relocation, not a bug fix for
  // broken submission logic.

  const approve = async (id: string) => {
    const note = prompt("Approval note (required):");
    if (!note) return;
    setActing(id + "_approve");
    try {
      await apiClient.post(`/billing/discounts/${id}/approve`, { approvalNote: note });
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed");
    } finally {
      setActing("");
    }
  };

  const reject = async (id: string) => {
    const note = prompt("Rejection reason (required):");
    if (!note) return;
    setActing(id + "_reject");
    try {
      await apiClient.post(`/billing/discounts/${id}/reject`, { rejectionNote: note });
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed");
    } finally {
      setActing("");
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => router.push("/dashboard/billing")}
          className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Billing
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-slate-600 text-sm font-medium">Discounts</span>
      </div>

      <PageHeader
        title="Fee Discounts"
        subtitle="Manage student discount requests and approvals"
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total"    value={(discounts ?? []).length} icon={<Tag className="w-5 h-5" />} color="blue"  loading={loading} />
        <StatCard label="Pending"  value={pending}                  icon={<Tag className="w-5 h-5" />} color="amber" loading={loading} />
        <StatCard label="Approved" value={approved}                 icon={<Tag className="w-5 h-5" />} color="green" loading={loading} />
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {["","PENDING","APPROVED","REJECTED"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-4 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
              statusFilter === s
                ? "bg-blue-50 border-blue-300 text-blue-700"
                : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
            }`}>
            {s || "All"}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              {["Student","Category","Discount","Valid From","Valid Until","Status","Actions"].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? [...Array(4)].map((_, i) => (
              <tr key={i}>{[...Array(7)].map((_, j) => (
                <td key={j} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
              ))}</tr>
            )) : !discounts || discounts.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-16 text-center text-slate-400 text-sm">
                No discount requests yet.
              </td></tr>
            ) : discounts.map(d => (
              <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3.5">
                  <p className="font-medium text-slate-900">{d.student?.firstName} {d.student?.lastName}</p>
                  <p className="text-xs text-slate-400">{d.student?.admissionNumber}</p>
                </td>
                <td className="px-5 py-3.5">
                  <Badge label={d.category.replace("_"," ")} variant="neutral" />
                </td>
                <td className="px-5 py-3.5 font-semibold text-blue-700">
                  {formatDiscountValue(d.type, Number(d.value))}
                  <span className="text-xs text-slate-400 font-normal ml-1">{d.type === "PERCENTAGE" ? "off" : "flat"}</span>
                </td>
                <td className="px-5 py-3.5 text-xs text-slate-500">
                  {new Date(d.validFrom).toLocaleDateString("en-IN")}
                </td>
                <td className="px-5 py-3.5 text-xs text-slate-500">
                  {d.validUntil ? new Date(d.validUntil).toLocaleDateString("en-IN") : "No expiry"}
                </td>
                <td className="px-5 py-3.5">
                  <Badge label={d.approvalStatus} variant={approvalVariant(d.approvalStatus)} />
                </td>
                <td className="px-5 py-3.5">
                  {d.approvalStatus === "PENDING" && canApprove && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => approve(d.id)}
                        disabled={acting === d.id + "_approve"}
                        className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 font-medium disabled:opacity-50">
                        <Check className="w-3 h-3" /> Approve
                      </button>
                      <button
                        onClick={() => reject(d.id)}
                        disabled={acting === d.id + "_reject"}
                        className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50">
                        <X className="w-3 h-3" /> Reject
                      </button>
                    </div>
                  )}
                  {d.approvalStatus === "PENDING" && !canApprove && (
                    <span className="text-xs text-slate-400">Awaiting approval</span>
                  )}
                  {d.approvalStatus !== "PENDING" && (
                    <span className="text-xs text-slate-400">
                      {d.approvals?.[0]?.approvalNote ?? d.approvals?.[0]?.approvalNote ?? "—"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
