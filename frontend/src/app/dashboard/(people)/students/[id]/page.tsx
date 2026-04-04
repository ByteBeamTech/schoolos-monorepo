"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  BookOpen,
  CreditCard,
  ClipboardCheck,
  Edit2,
  Save,
  X,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useApi } from "@/lib/hooks";
import { apiClient, behaviorApi } from "@/lib/api";
import type { BehaviorRecord, CreateBehaviorRecordRequest } from "@schoolos/api-contracts";
import { useToast } from '@/lib/use-toast';


function fmt(n: number) {
  return `Rs ${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const { data: student, loading, refetch } = useApi<any>(`/students/${id}`);
  const { data: invoices } = useApi<any[]>(`/billing/invoices?studentId=${id}`, [id]);
  const { data: attendance } = useApi<any>(
    `/attendance/student/${id}?fromDate=${new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]}&toDate=${new Date().toISOString().split("T")[0]}`,
    [id],
  );
  const { data: behaviorRecords, refetch: refetchBehavior } = useApi<BehaviorRecord[]>(`/behavior/student/${id}`, [id]);

  const { toast } = useToast();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showBehaviorForm, setShowBehaviorForm] = useState(false);
  const [savingBehavior, setSavingBehavior] = useState(false);
  const [editForm, setEditForm] = useState({ rollNumber: "", status: "" });
  const [behaviorForm, setBehaviorForm] = useState<CreateBehaviorRecordRequest>({
    type:             "NEGATIVE",                            // Required in contract
  title:            "",
    category: "DISCIPLINE",
    incidentDate: new Date().toISOString().split("T")[0],
    severity: "MEDIUM",
    description: "",
    actionTaken: "",
    points: 0,
    parentNotified: false,
    followUpRequired: false,
    reportedBy:       "",
  });

  const startEdit = () => {
    setEditForm({ rollNumber: student?.rollNumber ?? "", status: student?.status ?? "ACTIVE" });
    setEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await apiClient.patch(`/students/${id}`, editForm);
      setEditing(false);
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const saveBehavior = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBehavior(true);
    try {
      await behaviorApi.create({ ...behaviorForm, studentId: id });
	    //await behaviorApi.createForStudent(id, behaviorForm);
      setShowBehaviorForm(false);
      // लाइन 86 के आसपास, सेव होने के बाद का रिसेट ब्लॉक
setBehaviorForm({
  type:             "NEGATIVE",
  title:            "",
  category:         "DISCIPLINE",
  incidentDate:     new Date().toISOString().split("T")[0],
  severity:         "MEDIUM",
  description:      "",
  actionTaken:      "",
  points:           0,
  parentNotified:   false,
  followUpRequired: false,
  reportedBy:       "", // इनिशियल स्टेट से मैच करने के लिए यहाँ भी जोड़ दिया
});

      refetchBehavior();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to save behavior record");
    } finally {
      setSavingBehavior(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!student) {
    return <div className="text-center py-24 text-slate-400">Student not found</div>;
  }

  const guardianLink = student.guardianLinks?.[0];
  const guardian = guardianLink?.guardian;
  const cls = student.section ? `${student.section.class?.name} - ${student.section.name}` : "-";
  const totalFees = (invoices ?? []).reduce((sum: number, invoice: any) => sum + Number(invoice.totalAmount), 0);
  const totalPaid = (invoices ?? []).reduce((sum: number, invoice: any) => sum + Number(invoice.paidAmount), 0);
  const totalDue = totalFees - totalPaid;

  return (
    <div>
      <button
        onClick={() => router.push("/dashboard/students")}
        className="flex items-center gap-2 text-slate-400 hover:text-slate-700 text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Students
      </button>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xl font-bold flex-shrink-0">
              {student.firstName[0]}{student.lastName[0]}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{student.firstName} {student.lastName}</h1>
              <p className="text-slate-500 text-sm mt-0.5">
                {student.admissionNumber} - {cls}
                {student.rollNumber && <span className="ml-2 text-slate-400">- Roll {student.rollNumber}</span>}
              </p>
              <div className="flex gap-2 mt-2">
                <Badge
                  label={student.status}
                  variant={student.status === "ACTIVE" ? "success" : student.status === "INACTIVE" ? "error" : "neutral"}
                />
                {student.gender && <Badge label={student.gender} variant="neutral" />}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {!editing ? (
              <button
                onClick={startEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
              >
                <Edit2 className="w-3 h-3" /> Edit
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <X className="w-3 h-3" /> Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <Save className="w-3 h-3" /> {saving ? "Saving..." : "Save"}
                </button>
              </div>
            )}
          </div>
        </div>

        {editing && (
          <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Roll Number</label>
              <input
                type="text"
                value={editForm.rollNumber}
                onChange={(e) => setEditForm((prev) => ({ ...prev, rollNumber: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Status</label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {["ACTIVE", "INACTIVE", "TRANSFERRED", "GRADUATED", "DROPPED"].map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-4 h-4 text-slate-400" />
              <h2 className="font-semibold text-slate-900 text-sm">Personal Info</h2>
            </div>
            <div className="space-y-3">
              {[
                { label: "Date of Birth", value: student.dateOfBirth ? fmtDate(student.dateOfBirth) : "-" },
                { label: "Blood Group", value: student.bloodGroup ?? "-" },
                { label: "Nationality", value: student.nationality ?? "-" },
                { label: "Religion", value: student.religion ?? "-" },
                { label: "Aadhaar", value: student.aadhaarNumber ? `****${student.aadhaarNumber.slice(-4)}` : "-" },
                { label: "Enrolled", value: fmtDate(student.createdAt) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-slate-500">{label}</span>
                  <span className="text-slate-900 font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-4 h-4 text-slate-400" />
              <h2 className="font-semibold text-slate-900 text-sm">Guardian</h2>
            </div>
            {guardian ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-sm font-bold">
                    {guardian.firstName[0]}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{guardian.firstName} {guardian.lastName}</p>
                    <p className="text-xs text-slate-400">{guardianLink?.relation?.replace("_", " ") ?? "Guardian"}</p>
                  </div>
                </div>
                {guardian.phone && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> {guardian.phone}
                  </div>
                )}
                {guardian.email && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> {guardian.email}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-400 text-sm">No guardian linked</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <ClipboardCheck className="w-4 h-4 text-slate-400" />
              <h2 className="font-semibold text-slate-900 text-sm">Attendance (This Year)</h2>
            </div>
            {attendance ? (
              <div>
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {[
                    { label: "Total Days", value: attendance.summary?.total ?? 0, color: "text-slate-900" },
                    { label: "Present", value: attendance.summary?.present ?? 0, color: "text-emerald-600" },
                    { label: "Absent", value: attendance.summary?.absent ?? 0, color: "text-red-500" },
                    {
                      label: "Percentage",
                      value: `${attendance.summary?.percentage ?? 0}%`,
                      color: (attendance.summary?.percentage ?? 0) >= 75 ? "text-emerald-600" : "text-red-500",
                    },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-slate-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-slate-500 mb-1">{label}</p>
                      <p className={`text-lg font-bold ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${(attendance.summary?.percentage ?? 0) >= 75 ? "bg-emerald-500" : "bg-red-400"}`}
                    style={{ width: `${attendance.summary?.percentage ?? 0}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1.5">
                  {(attendance.summary?.percentage ?? 0) < 75 ? "Below 75% - low attendance" : "Attendance is satisfactory"}
                </p>
              </div>
            ) : (
              <p className="text-slate-400 text-sm">No attendance records found</p>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-slate-400" />
                <h2 className="font-semibold text-slate-900 text-sm">Fee History</h2>
              </div>
              <a href="/dashboard/billing" className="text-xs text-blue-600 hover:text-blue-800">View all</a>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: "Total Fees", value: fmt(totalFees), color: "text-slate-900" },
                { label: "Paid", value: fmt(totalPaid), color: "text-emerald-600" },
                { label: "Due", value: fmt(totalDue), color: totalDue > 0 ? "text-red-500" : "text-slate-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500 mb-1">{label}</p>
                  <p className={`text-base font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            {invoices && invoices.length > 0 ? (
              <div className="space-y-2">
                {invoices.slice(0, 5).map((invoice: any) => (
                  <div key={invoice.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <div>
                      <p className="text-xs font-mono text-slate-600">{invoice.invoiceNumber}</p>
                      <p className="text-xs text-slate-400">Due: {fmtDate(invoice.dueDate)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-900">{fmt(invoice.totalAmount)}</span>
                      <Badge
                        label={invoice.status}
                        variant={
                          invoice.status === "PAID"
                            ? "success"
                            : invoice.status === "OVERDUE"
                              ? "error"
                              : invoice.status === "PARTIALLY_PAID"
                                ? "warning"
                                : "neutral"
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-sm text-center py-4">No invoices yet</p>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-slate-400" />
                <h2 className="font-semibold text-slate-900 text-sm">Behavior Records</h2>
              </div>
              <button
                onClick={() => setShowBehaviorForm((prev) => !prev)}
                className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
              >
                {showBehaviorForm ? "Close" : "Add Record"}
              </button>
            </div>

            {showBehaviorForm && (
              <form onSubmit={saveBehavior} className="space-y-3 mb-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Title</label>
                  <input
                    value={behaviorForm.title}
                    onChange={(e) => setBehaviorForm((prev) => ({ ...prev, title: e.target.value }))}
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Category</label>
                    <select
                      value={behaviorForm.category}
                      onChange={(e) => setBehaviorForm((prev) => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {["DISCIPLINE", "POSITIVE", "COUNSELLING", "ATTENDANCE", "SAFETY", "ACADEMIC"].map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Severity</label>
                    <select
                      value={behaviorForm.severity}
                      onChange={(e) => setBehaviorForm((prev) => ({ ...prev, severity: e.target.value as any }))}
		      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((severity) => (
                        <option key={severity} value={severity}>{severity}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Incident Date</label>
                    <input
                      type="date"
                      value={behaviorForm.incidentDate}
                      onChange={(e) => setBehaviorForm((prev) => ({ ...prev, incidentDate: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Points</label>
                    <input
                      type="number"
                      value={behaviorForm.points ?? 0}
                      onChange={(e) => setBehaviorForm((prev) => ({ ...prev, points: Number(e.target.value) }))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Description</label>
                  <textarea
                    rows={3}
                    value={behaviorForm.description ?? ""}
                    onChange={(e) => setBehaviorForm((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Action Taken</label>
                  <input
                    value={behaviorForm.actionTaken ?? ""}
                    onChange={(e) => setBehaviorForm((prev) => ({ ...prev, actionTaken: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-4 text-sm text-slate-600">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={behaviorForm.parentNotified ?? false}
                      onChange={(e) => setBehaviorForm((prev) => ({ ...prev, parentNotified: e.target.checked }))}
                    />
                    Parent notified
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={behaviorForm.followUpRequired ?? false}
                      onChange={(e) => setBehaviorForm((prev) => ({ ...prev, followUpRequired: e.target.checked }))}
                    />
                    Follow-up required
                  </label>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingBehavior}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingBehavior ? "Saving..." : "Save Behavior"}
                  </button>
                </div>
              </form>
            )}

            {behaviorRecords && behaviorRecords.length > 0 ? (
              <div className="space-y-3">
                {behaviorRecords.slice(0, 6).map((record) => (
                  <div key={record.id} className="rounded-lg border border-slate-100 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{record.title}</p>
                        <p className="text-xs text-slate-500 mt-1">{record.category} - {fmtDate(record.incidentDate)}</p>
                      </div>
                      <Badge
                        label={record.severity}
                        variant={record.severity === "HIGH" || record.severity === "CRITICAL" ? "error" : record.severity === "MEDIUM" ? "warning" : "neutral"}
                      />
                    </div>
                    {record.description && <p className="text-sm text-slate-600 mt-2">{record.description}</p>}
                    <div className="flex flex-wrap gap-2 mt-3 text-xs text-slate-500">
                      <span>Points: {record.points}</span>
                      <span>{record.parentNotified ? "Parent notified" : "Parent not notified"}</span>
                      <span>{record.followUpRequired ? "Follow-up required" : "No follow-up pending"}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-sm">No behavior records added yet</p>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-4 h-4 text-slate-400" />
              <h2 className="font-semibold text-slate-900 text-sm">Academic Info</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Class", value: student.section?.class?.name ?? "-" },
                { label: "Section", value: student.section?.name ?? "-" },
                { label: "Academic Year", value: student.academicYear ?? "-" },
                { label: "Roll Number", value: student.rollNumber ?? "-" },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">{label}</p>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
