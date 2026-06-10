"use client";
import { useState }     from "react";
import { useRouter }    from "next/navigation";
import { ArrowLeft, Plus, Check, X, Tag } from "lucide-react";
import { PageHeader }   from "@/components/ui/page-header";
import { Badge }        from "@/components/ui/badge";
import { StatCard }     from "@/components/ui/stat-card";
import { useApi, useStudents } from "@/lib/hooks";
import { apiClient }    from "@/lib/api";
import { useToast } from '@/lib/use-toast';


const CATEGORIES = ["SIBLING","MERIT","STAFF_CHILD","FINANCIAL_HARDSHIP","SCHOLARSHIP","CUSTOM"];
const TYPES      = ["PERCENTAGE","FIXED"];

function approvalVariant(s: string) {
  if (s === "APPROVED") return "success" as const;
  if (s === "REJECTED") return "error"   as const;
  if (s === "PENDING")  return "warning" as const;
  return "neutral" as const;
}

function fmtDiscount(type: string, value: number) {
  return type === "PERCENTAGE" ? `${value}%` : `₹${value.toLocaleString("en-IN")}`;
}

export default function DiscountsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [acting,   setActing]   = useState("");

  const url = `/billing/discounts${statusFilter ? `?approvalStatus=${statusFilter}` : ""}`;
  const { data: discounts, loading, refetch } = useApi<any[]>(url, [statusFilter]);
  const { data: studentsData } =
  useStudents(1, {});
  const students = studentsData?.data ?? [];

  const pending  = (discounts ?? []).filter(d => d.approvalStatus === "PENDING").length;
  const approved = (discounts ?? []).filter(d => d.approvalStatus === "APPROVED").length;

  const [form, setForm] = useState({
    studentId: "", category: "MERIT", type: "PERCENTAGE",
    value: "", validFrom: "", validUntil: "", reason: "", notes: "",
  });
  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.post("/billing/discounts", {
        studentId:  form.studentId,
        category:   form.category,
        type:       form.type,
        value:      parseFloat(form.value),
        validFrom:  form.validFrom,
        validUntil: form.validUntil || undefined,
        reason:     form.reason    || undefined,
        notes:      form.notes     || undefined,
      });
      setShowForm(false);
      setForm({ studentId:"", category:"MERIT", type:"PERCENTAGE", value:"", validFrom:"", validUntil:"", reason:"", notes:"" });
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

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
        action={
          <button onClick={() => setShowForm(p => !p)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> New Discount
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total"    value={(discounts ?? []).length} icon={<Tag className="w-5 h-5" />} color="blue"  loading={loading} />
        <StatCard label="Pending"  value={pending}                  icon={<Tag className="w-5 h-5" />} color="amber" loading={loading} />
        <StatCard label="Approved" value={approved}                 icon={<Tag className="w-5 h-5" />} color="green" loading={loading} />
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white border border-blue-100 rounded-xl p-5 mb-5 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4 text-sm">New Discount Request</h3>
          <form onSubmit={create}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Student *</label>
                <select required value={form.studentId} onChange={f("studentId")}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select student</option>
                  {students.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admissionNumber})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Category *</label>
                <select required value={form.category} onChange={f("category")}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Type *</label>
                <select required value={form.type} onChange={f("type")}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Value * {form.type === "PERCENTAGE" ? "(0–100%)" : "(₹)"}
                </label>
                <input required type="number" min="0" max={form.type === "PERCENTAGE" ? "100" : undefined}
                  value={form.value} onChange={f("value")} placeholder={form.type === "PERCENTAGE" ? "10" : "5000"}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Valid From *</label>
                <input required type="date" value={form.validFrom} onChange={f("validFrom")}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Valid Until</label>
                <input type="date" value={form.validUntil} onChange={f("validUntil")}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Reason</label>
                <input type="text" value={form.reason} onChange={f("reason")} placeholder="e.g. Merit scholarship for academic excellence"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex gap-3 pt-2 border-t border-slate-100">
              <button type="submit" disabled={saving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors">
                {saving ? "Submitting..." : "Submit Request"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm rounded-lg transition-colors">Cancel</button>
            </div>
          </form>
        </div>
      )}

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
                  {fmtDiscount(d.type, Number(d.value))}
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
                  {d.approvalStatus === "PENDING" && (
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
