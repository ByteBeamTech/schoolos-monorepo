"use client";
import { useState }       from "react";
import { useRouter }       from "next/navigation";
import { useSearchParams } from "next/navigation";
import { UserCheck, Plus, Check, BookOpen } from "lucide-react";
import { PageHeader }      from "@/components/ui/page-header";
import { Badge }           from "@/components/ui/badge";
import { EmptyState }      from "@/components/ui/empty-state";
import { FilterBuilder }   from "@/components/ui/filter-builder";
import { Pagination }      from "@/components/ui/pagination";
import { STAFF_FILTER_SCHEMA } from "@/lib/filter-schemas";
import { useApi }          from "@/lib/hooks";
import { apiClient }       from "@/lib/api";

interface StaffMember {
  id: string; employeeId: string; designation: string;
  department?: string; isActive: boolean; dateOfJoining: string;
  user: { id: string; firstName: string; lastName: string; email: string; phone?: string; role: string };
}

const ROLES = [
  "TEACHER", "CLASS_TEACHER", "PRINCIPAL", "VICE_PRINCIPAL",
  "ACCOUNTANT", "LIBRARIAN", "NURSE", "HR_MANAGER",
  "RECEPTIONIST", "TRANSPORT_MANAGER", "STAFF",
];
const DEPARTMENTS = [
  "Academics", "Administration", "Finance", "Sports",
  "Library", "Health", "Transport", "IT", "Other",
];

const IS_TEACHER = (role: string) => ["TEACHER", "CLASS_TEACHER"].includes(role);

export default function StaffPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const qs           = searchParams.toString();

  const { data: staffData, loading, refetch } = useApi<any>(
    `/staff${qs ? `?${qs}` : ""}`, [qs]
  );
  const staff = Array.isArray(staffData) ? staffData : (staffData?.data ?? []);
  const meta  = Array.isArray(staffData) ? null : staffData?.meta ?? null;

  // Subjects list for the multi-select
  const { data: subjects } = useApi<any[]>("/academics/subjects");

  const [showForm, setShowForm] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [step, setStep] = useState("");

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", role: "TEACHER",
    employeeId: "", designation: "", department: "", dateOfJoining: "",
    qualification: "", experience: "",
  });

  // Subjects this teacher can teach (multi-select)
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const toggleSubject = (id: string) =>
    setSelectedSubjects(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  const resetForm = () => {
    setForm({
      firstName: "", lastName: "", email: "", phone: "", role: "TEACHER",
      employeeId: "", designation: "", department: "", dateOfJoining: "",
      qualification: "", experience: "",
    });
    setSelectedSubjects([]);
    setShowForm(false);
    setStep("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // 1 — create user account
      setStep("Creating login account…");
      const userRes = await apiClient.post("/users", {
        firstName: form.firstName,
        lastName:  form.lastName,
        email:     form.email,
        phone:     form.phone || undefined,
        role:      form.role,
        password:  "School@123",
      });
      const userId = (userRes as any).id ?? (userRes as any).data?.id;

      // 2 — create staff profile
      setStep("Creating staff profile…");
      const staffRes = await apiClient.post("/staff", {
        userId,
        employeeId:    form.employeeId,
        designation:   form.designation,
        department:    form.department    || undefined,
        dateOfJoining: form.dateOfJoining,
        qualification: form.qualification || undefined,
        experience:    form.experience ? parseInt(form.experience) : undefined,
      });
      const staffId = (staffRes as any).id ?? (staffRes as any).data?.id;

      // 3 — save subject preferences (teacher roles only)
      if (IS_TEACHER(form.role) && selectedSubjects.length > 0 && staffId) {
        setStep("Saving subject preferences…");
        await apiClient.post(`/staff/${staffId}/subject-preferences`, {
          subjectIds: selectedSubjects,
        }).catch(() => {}); // non-fatal — profile still created
      }

      resetForm();
      refetch();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? `Failed: ${step}`);
    } finally {
      setSaving(false);
      setStep("");
    }
  };

  return (
    <div>
      <PageHeader
        title="Staff"
        subtitle={`${staff.length} staff members${meta?.total ? ` of ${meta.total}` : ""}`}
        action={
          <button onClick={() => setShowForm(p => !p)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Add Staff
          </button>
        }
      />

      {/* ── Add staff form ─────────────────────────────────────────── */}
      {showForm && (
        <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900">Add New Staff Member</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Default password: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">School@123</code>
              </p>
            </div>
            <button onClick={resetForm} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* ── Personal ── */}
            <section>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Personal Info</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="field-label">First Name *</label>
                  <input required value={form.firstName} onChange={f("firstName")} placeholder="Rajesh"
                    className="field-input" />
                </div>
                <div>
                  <label className="field-label">Last Name *</label>
                  <input required value={form.lastName} onChange={f("lastName")} placeholder="Kumar"
                    className="field-input" />
                </div>
                <div>
                  <label className="field-label">Email *</label>
                  <input required type="email" value={form.email} onChange={f("email")} placeholder="teacher@school.in"
                    className="field-input" />
                </div>
                <div>
                  <label className="field-label">Phone</label>
                  <input
                    type="tel" inputMode="numeric" maxLength={10}
                    value={form.phone}
                    onChange={e => setForm(p => ({ ...p, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                    placeholder="10-digit mobile"
                    className="field-input"
                  />
                  {form.phone.length > 0 && form.phone.length < 10 && (
                    <p className="text-[11px] text-amber-500 mt-1">{10 - form.phone.length} more digits</p>
                  )}
                </div>
              </div>
            </section>

            {/* ── Employment ── */}
            <section>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Employment</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="field-label">Role *</label>
                  <select required value={form.role} onChange={f("role")} className="field-input">
                    {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Employee ID *</label>
                  <input required value={form.employeeId} onChange={f("employeeId")} placeholder="EMP-001"
                    className="field-input" />
                </div>
                <div>
                  <label className="field-label">Designation *</label>
                  <input required value={form.designation} onChange={f("designation")} placeholder="Mathematics Teacher"
                    className="field-input" />
                </div>
                <div>
                  <label className="field-label">Department</label>
                  <select value={form.department} onChange={f("department")} className="field-input">
                    <option value="">Select…</option>
                    {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Date of Joining *</label>
                  <input required type="date" value={form.dateOfJoining} onChange={f("dateOfJoining")}
                    className="field-input" />
                </div>
                <div>
                  <label className="field-label">Qualification</label>
                  <input value={form.qualification} onChange={f("qualification")} placeholder="B.Ed, M.Sc"
                    className="field-input" />
                </div>
                <div>
                  <label className="field-label">Experience (yrs)</label>
                  <input type="number" min="0" value={form.experience} onChange={f("experience")}
                    className="field-input" />
                </div>
              </div>
            </section>

            {/* ── Subject preferences (teachers only) ── */}
            {IS_TEACHER(form.role) && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="w-4 h-4 text-blue-500" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Subjects This Teacher Can Teach
                  </p>
                  <span className="text-xs text-slate-400 font-normal normal-case">— select all that apply</span>
                </div>

                {!subjects || subjects.length === 0 ? (
                  <p className="text-xs text-slate-400 italic p-4 bg-slate-50 rounded-lg">
                    No subjects created yet.{" "}
                    <a href="/dashboard/academics" className="text-blue-600 underline">Add subjects in Academics →</a>
                  </p>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    {/* Group: Core subjects */}
                    {subjects.filter((s:any) => !s.isElective).length > 0 && (
                      <div className="mb-3">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Core Subjects</p>
                        <div className="flex flex-wrap gap-2">
                          {subjects.filter((s:any) => !s.isElective).map((sub: any) => (
                            <button key={sub.id} type="button" onClick={() => toggleSubject(sub.id)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                selectedSubjects.includes(sub.id)
                                  ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                                  : "bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700"
                              }`}>
                              {selectedSubjects.includes(sub.id)
                                ? <Check className="w-3 h-3" />
                                : <span className="w-3 h-3 rounded-full border border-current opacity-30" />
                              }
                              {sub.name}
                              {sub.code && <span className="opacity-50 font-mono ml-0.5">{sub.code}</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Group: Electives */}
                    {subjects.filter((s:any) => s.isElective).length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Elective Subjects</p>
                        <div className="flex flex-wrap gap-2">
                          {subjects.filter((s:any) => s.isElective).map((sub: any) => (
                            <button key={sub.id} type="button" onClick={() => toggleSubject(sub.id)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                selectedSubjects.includes(sub.id)
                                  ? "bg-violet-600 border-violet-600 text-white shadow-sm"
                                  : "bg-white border-slate-200 text-slate-500 hover:border-violet-300 hover:text-violet-700"
                              }`}>
                              {selectedSubjects.includes(sub.id)
                                ? <Check className="w-3 h-3" />
                                : <span className="w-3 h-3 rounded-full border border-current opacity-30" />
                              }
                              {sub.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedSubjects.length > 0 && (
                      <p className="text-xs text-blue-600 font-medium mt-3 pt-3 border-t border-slate-200">
                        ✓ {selectedSubjects.length} subject{selectedSubjects.length > 1 ? "s" : ""} selected
                      </p>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2 border-t border-slate-100">
              <button type="submit" disabled={saving}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-semibold disabled:opacity-50 transition-colors flex items-center gap-2">
                {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {saving ? step : "Add Staff Member"}
              </button>
              <button type="button" onClick={resetForm}
                className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FilterBuilder */}
      <FilterBuilder schema={STAFF_FILTER_SCHEMA} className="mb-6" />

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              {["Staff Member", "Employee ID", "Designation", "Department", "Role", "Status"].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>{[...Array(6)].map((_, j) => (
                  <td key={j} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                ))}</tr>
              ))
            ) : staff.length === 0 ? (
              <tr><td colSpan={6}>
                <EmptyState title="No staff members found" message="Adjust filters or add a new staff member."
                  icon={<UserCheck className="w-12 h-12" />} />
              </td></tr>
            ) : staff.map((s: StaffMember) => (
              <tr key={s.id} className="hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => router.push(`/dashboard/staff/${s.id}`)}>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold flex-shrink-0">
                      {s.user.firstName[0]}{s.user.lastName[0]}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{s.user.firstName} {s.user.lastName}</p>
                      <p className="text-xs text-slate-400">{s.user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 font-mono text-xs text-slate-600">{s.employeeId}</td>
                <td className="px-5 py-4 text-slate-700">{s.designation}</td>
                <td className="px-5 py-4 text-slate-500">{s.department ?? "—"}</td>
                <td className="px-5 py-4"><Badge label={s.user.role.replace(/_/g," ")} variant="info" /></td>
                <td className="px-5 py-4">
                  <Badge label={s.isActive ? "Active" : "Inactive"} variant={s.isActive ? "success" : "neutral"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination meta={meta} loading={loading} />
      </div>

      {/* Tailwind shorthand classes used above */}
      <style>{`
        .field-label { display:block; font-size:.65rem; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:.06em; margin-bottom:.375rem; }
        .field-input { width:100%; padding:.625rem .75rem; font-size:.875rem; border:1px solid #e2e8f0; border-radius:.5rem; outline:none; }
        .field-input:focus { ring:2px solid #3b82f6; border-color:#3b82f6; }
      `}</style>
    </div>
  );
}
