"use client";

import { useEffect, useMemo, useState } from "react";
import { UserPlus, Phone, Mail, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { useAdmissionDetail, useAdmissions, useAdmissionStats, useAdmissionsActions, useApi } from "@/lib/hooks";
import { useFilterParams } from "@/lib/use-filter-params";
import { ADMISSION_SOURCES, ADMISSION_STATUSES, type AdmissionStatus } from "@schoolos/types";
import type { AdmissionDetail, ApproveAdmissionRequest, CreateAdmissionRequest } from "@schoolos/api-contracts";

const STATUSES = [...ADMISSION_STATUSES];
const SOURCES = [...ADMISSION_SOURCES];

const STATUS_VARIANTS: Record<string, any> = {
  INQUIRY: "neutral",
  APPLIED: "info",
  SCREENING: "warning",
  WAITLISTED: "purple",
  ENROLLED: "success",
  REJECTED: "error",
  WITHDRAWN: "neutral",
};

const EMPTY_APPROVE_FORM: ApproveAdmissionRequest = {
  assignedSectionId: "",
  admissionNumber: "",
  rollNumber: "",
  dateOfBirth: "",
  gender: "",
  bloodGroup: "",
  guardianFirstName: "",
  guardianLastName: "",
  guardianPhone: "",
  guardianEmail: "",
  guardianRelation: "OTHER",
  addressLine: "",
  city: "",
  state: "",
  pincode: "",
  notes: "",
};
export default function AdmissionsPage() {
  const { getParam, setFilter } = useFilterParams();
  const statusFilter = getParam("status");
  const search = getParam("search");

  const [selected, setSelected] = useState<{ id: string } | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showApproveForm, setShowApproveForm] = useState(false);
  const [approveSaving, setApproveSaving] = useState(false);
  const [approveForm, setApproveForm] = useState<ApproveAdmissionRequest>(EMPTY_APPROVE_FORM);

  const { data: list, loading, refetch } = useAdmissions({
    status: statusFilter || undefined,
    search: search || undefined,
  });
  const { data: stats, loading: sLoad } = useAdmissionStats();
  const { data: detail, loading: dLoad, refetch: refetchDetail } = useAdmissionDetail(selected?.id);
  const { createAdmission, updateAdmissionStatus, approveAdmission, rejectAdmission } = useAdmissionsActions();
  const { data: academicStructure } = useApi<{
    classes: Array<{ id: string; name: string; sections: Array<{ id: string; name: string }> }>;
  }>("/school-management/academics");

  const [form, setForm] = useState<CreateAdmissionRequest>({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    applyingForClass: "",
    academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    source: "DIRECT",
    notes: "",
  });

  const f = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const fa = (key: keyof ApproveAdmissionRequest) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setApproveForm((prev) => ({ ...prev, [key]: e.target.value }));

  const sectionOptions = useMemo(
    () =>
      (academicStructure?.classes ?? []).flatMap((cls) =>
        (cls.sections ?? []).map((section) => ({
          id: section.id,
          label: `${cls.name} - ${section.name}`,
        })),
      ),
    [academicStructure],
  );

  useEffect(() => {
    setShowApproveForm(false);
    setApproveForm(EMPTY_APPROVE_FORM);
  }, [selected?.id]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createAdmission(form);
      setShowNew(false);
      setForm({
        firstName: "",
        lastName: "",
        phone: "",
        email: "",
        applyingForClass: "",
        academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
        source: "DIRECT",
        notes: "",
      });
      refetch();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  const moveStatus = async (id: string, status: AdmissionStatus) => {
    try {
      await updateAdmissionStatus(id, { status });
      refetch();
      if (selected?.id === id) refetchDetail();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? "Failed");
    }
  };

  const openApproveForm = (admission: AdmissionDetail) => {
    setApproveForm({
      ...EMPTY_APPROVE_FORM,
      guardianLastName: admission.lastName ?? "",
      notes: admission.notes ?? "",
    });
    setShowApproveForm(true);
  };

  const submitApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    setApproveSaving(true);
    try {
      const payload = Object.fromEntries(
        Object.entries(approveForm).filter(([, value]) => value !== undefined && value !== null && value !== ""),
      ) as ApproveAdmissionRequest;
      await approveAdmission(detail.id, payload);
      setShowApproveForm(false);
      refetch();
      refetchDetail();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? err?.message ?? "Failed to approve admission");
    } finally {
      setApproveSaving(false);
    }
  };

  const rejectSelected = async (admission: AdmissionDetail) => {
    const reason = window.prompt("Rejection reason:");
    if (!reason?.trim()) return;
    try {
      await rejectAdmission(admission.id, { reason: reason.trim() });
      refetch();
      refetchDetail();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? err?.message ?? "Failed to reject admission");
    }
  };

const nextStatus = (current: string) => {
  const idx = STATUSES.indexOf(current as AdmissionStatus);
  if (idx === -1 || idx >= STATUSES.indexOf("ENROLLED")) return null;
  return STATUSES[idx + 1];
};
  return (
    <div>
      <PageHeader
        title="Admissions"
        subtitle="CRM pipeline - track inquiries to enrollment"
        action={
          <button
            onClick={() => setShowNew((prev) => !prev)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <UserPlus className="w-4 h-4" /> New inquiry
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total inquiries" value={stats?.total ?? 0} icon={<span>👤</span>} color="blue" loading={sLoad} />
        <StatCard label="This month" value={stats?.thisMonth ?? 0} icon={<span>📅</span>} color="green" loading={sLoad} />
        <StatCard label="Enrolled" value={stats?.enrolled ?? 0} icon={<span>✅</span>} color="green" loading={sLoad} />
        <StatCard label="Conversion rate" value={`${stats?.conversionRate ?? 0}%`} icon={<span>📈</span>} color="purple" loading={sLoad} />
      </div>

      {showNew && (
        <div className="bg-white border border-blue-100 rounded-xl p-5 mb-5 shadow-sm">
          <h3 className="font-semibold text-slate-900 text-sm mb-4">New inquiry</h3>
          <form onSubmit={create} className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { l: "First name *", k: "firstName", req: true },
              { l: "Last name *", k: "lastName", req: true },
              { l: "Phone *", k: "phone", req: true },
              { l: "Email", k: "email", req: false },
              { l: "Applying for class *", k: "applyingForClass", req: true },
              { l: "Academic year *", k: "academicYear", req: true },
              { l: "Notes", k: "notes", req: false },
            ].map(({ l, k, req }) => (
              <div key={k}>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{l}</label>
                <input
                  type="text"
                  required={req}
                  value={(form as any)[k]}
                  onChange={f(k)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Source</label>
              <select
                value={form.source}
                onChange={f("source")}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SOURCES.map((source) => <option key={source}>{source}</option>)}
              </select>
            </div>
            <div className="md:col-span-3 flex gap-3">
              <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium disabled:opacity-50">
                {saving ? "Saving..." : "Create inquiry"}
              </button>
              <button type="button" onClick={() => setShowNew(false)} className="px-5 py-2 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex gap-2 mb-5 flex-wrap items-center">
        <button
          onClick={() => setFilter("status", undefined)}
          className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
            !statusFilter ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          All ({stats?.total ?? 0})
        </button>
        {STATUSES.map((status) => (
          <button
            key={status}
            onClick={() => setFilter("status", statusFilter === status ? undefined : status)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              statusFilter === status ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {status} {stats?.byStatus?.[status] ? `(${stats.byStatus[status]})` : ""}
          </button>
        ))}
        <input
          type="text"
          placeholder="Search name, phone..."
          value={search ?? ""}
          onChange={(e) => setFilter("search", e.target.value || undefined)}
          className="ml-auto px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-48"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["Name", "Phone", "Class", "Source", "Status", "Action"].map((heading) => (
                  <th key={heading} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(6)].map((__, j) => (
                      <td key={j} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : !list || list.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-slate-400 text-sm">No admissions found. Add your first inquiry.</td>
                </tr>
              ) : list.map((admission) => (
                <tr
                  key={admission.id}
                  onClick={() => setSelected(admission)}
                  className={`cursor-pointer hover:bg-slate-50 transition-colors ${selected?.id === admission.id ? "bg-blue-50" : ""}`}
                >
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-slate-900">{admission.firstName} {admission.lastName}</p>
                    <p className="text-xs text-slate-400">{admission.academicYear}</p>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600 text-xs">{admission.phone}</td>
                  <td className="px-5 py-3.5 text-slate-600">{admission.applyingForClass}</td>
                  <td className="px-5 py-3.5 text-xs text-slate-500">{admission.source}</td>
                  <td className="px-5 py-3.5"><Badge label={admission.status} variant={STATUS_VARIANTS[admission.status]} /></td>
                  <td className="px-5 py-3.5">
                    {nextStatus(admission.status) && admission.status !== "WAITLISTED" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveStatus(admission.id, nextStatus(admission.status)!);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-0.5"
                      >
                        Next: {nextStatus(admission.status)}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
          {!selected ? (
            <div className="p-12 text-center text-slate-300 text-sm flex flex-col items-center gap-2">
              <ChevronRight className="w-8 h-8" /> Select a record to view details
            </div>
          ) : dLoad ? (
            <div className="p-5 space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />)}
            </div>
          ) : (
            <div className="p-5">
              <div className="mb-4">
                <h3 className="font-bold text-slate-900 text-base">{detail?.firstName} {detail?.lastName}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge label={detail?.status} variant={STATUS_VARIANTS[detail?.status ?? "INQUIRY"] ?? "neutral"} />
                  <span className="text-xs text-slate-400">{detail?.source}</span>
                </div>
              </div>

              <div className="space-y-2 text-sm mb-5">
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="w-3.5 h-3.5 text-slate-400" /> {detail?.phone}
                </div>
                {detail?.email && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> {detail.email}
                  </div>
                )}
                <div className="text-slate-600">Class: <span className="font-medium">{detail?.applyingForClass}</span></div>
                <div className="text-slate-600">Year: <span className="font-medium">{detail?.academicYear}</span></div>
                {detail?.notes && <div className="text-slate-500 text-xs bg-slate-50 rounded-lg p-3">{detail.notes}</div>}
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {detail?.status !== "ENROLLED" && detail?.status !== "REJECTED" && (
                  <button
                    onClick={() => detail && openApproveForm(detail)}
                    className="text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Prepare Enrollment
                  </button>
                )}
                {detail?.status !== "REJECTED" && (
                  <button
                    onClick={() =>  detail && rejectSelected(detail)}
                    className="text-xs px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Reject With Reason
                  </button>
                )}
              </div>

              {showApproveForm && detail && (
                <form onSubmit={submitApproval} className="mb-5 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-slate-900">Enrollment Details</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Capture the section, student profile, guardian contact, and address before creating the student record.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Assign Section</label>
                      <select value={approveForm.assignedSectionId ?? ""} onChange={fa("assignedSectionId")}
                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500">
                        <option value="">Select section</option>
                        {sectionOptions.map((section) => (
                          <option key={section.id} value={section.id}>{section.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Admission Number</label>
                      <input value={approveForm.admissionNumber ?? ""} onChange={fa("admissionNumber")}
                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Roll Number</label>
                      <input value={approveForm.rollNumber ?? ""} onChange={fa("rollNumber")}
                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Date of Birth</label>
                      <input type="date" value={approveForm.dateOfBirth ?? ""} onChange={fa("dateOfBirth")}
                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Gender</label>
                      <select value={approveForm.gender ?? ""} onChange={fa("gender")}
                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500">
                        <option value="">Select</option>
                        {["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"].map((gender) => (
                          <option key={gender} value={gender}>{gender.replace(/_/g, " ")}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Blood Group</label>
                      <input value={approveForm.bloodGroup ?? ""} onChange={fa("bloodGroup")}
                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Guardian First Name</label>
                      <input value={approveForm.guardianFirstName ?? ""} onChange={fa("guardianFirstName")}
                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Guardian Last Name</label>
                      <input value={approveForm.guardianLastName ?? ""} onChange={fa("guardianLastName")}
                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Guardian Phone</label>
                      <input value={approveForm.guardianPhone ?? ""} onChange={fa("guardianPhone")}
                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Guardian Email</label>
                      <input value={approveForm.guardianEmail ?? ""} onChange={fa("guardianEmail")}
                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Guardian Relation</label>
                      <select value={approveForm.guardianRelation ?? "OTHER"} onChange={fa("guardianRelation")}
                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500">
                        {["FATHER", "MOTHER", "GRANDFATHER", "GRANDMOTHER", "UNCLE", "AUNT", "SIBLING", "LEGAL_GUARDIAN", "OTHER"].map((relation) => (
                          <option key={relation} value={relation}>{relation.replace(/_/g, " ")}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Address</label>
                      <input value={approveForm.addressLine ?? ""} onChange={fa("addressLine")}
                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">City</label>
                      <input value={approveForm.city ?? ""} onChange={fa("city")}
                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">State</label>
                      <input value={approveForm.state ?? ""} onChange={fa("state")}
                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Pincode</label>
                      <input value={approveForm.pincode ?? ""} onChange={fa("pincode")}
                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Enrollment Notes</label>
                      <textarea value={approveForm.notes ?? ""} onChange={fa("notes")} rows={3}
                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-4">
                    <button type="button" onClick={() => setShowApproveForm(false)}
                      className="px-4 py-2 text-sm bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">
                      Keep Reviewing
                    </button>
                    <button type="submit" disabled={approveSaving}
                      className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                      {approveSaving ? "Enrolling..." : "Create Student Record"}
                    </button>
                  </div>
                </form>
              )}

              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Move to</p>
                <div className="flex flex-wrap gap-2">
                  {STATUSES.filter((status) => status !== detail?.status && status !== "ENROLLED" && status !== "REJECTED").map((status) => (
                    <button key={status} onClick={() => moveStatus(detail!.id, status)}
                      className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors">
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {detail?.activities?.length ? (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Activity</p>
                  <div className="space-y-2">
                    {detail.activities.slice(0, 5).map((activity) => (
                      <div key={activity.id} className="text-xs text-slate-500 border-l-2 border-slate-200 pl-3">
                        <span className="font-medium text-slate-700">{activity.action.replace(/_/g, " ")}</span>
                        {activity.note && <span> - {activity.note}</span>}
                        <div className="text-slate-400">
                          {new Date(activity.createdAt).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
