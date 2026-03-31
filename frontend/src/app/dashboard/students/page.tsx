"use client";
import { useApi } from "@/lib/hooks";
import { useState }    from "react";
import { useRouter }   from "next/navigation";
import { Users, Search, Plus, Phone } from "lucide-react";
import { PageHeader }  from "@/components/ui/page-header";
import { Badge }       from "@/components/ui/badge";
import { EmptyState }  from "@/components/ui/empty-state";
import { useStudents, useAcademicSessions, useClasses } from "@/lib/hooks";
import { apiClient }   from "@/lib/api";

function statusVariant(s: string) {
  if (s === "ACTIVE")   return "success" as const;
  if (s === "INACTIVE") return "error"   as const;
  return "neutral" as const;
}

export default function StudentsPage() {
  const router = useRouter();
  const [page,  setPage]  = useState(1);
  const [search, setSearch] = useState("");
  const [query,  setQuery]  = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving,   setSaving]   = useState(false);

  const { data, loading, error, refetch } = useStudents(page, query);
  const students = data?.data ?? [];
  const meta     = data?.meta;

  // For the add student form
  const { data: sessions }  = useAcademicSessions();
  const { data: branches }  = useApi<any[]>("/school-management/branches");
  const currentSession      = sessions?.find(s => s.isCurrent) ?? sessions?.[0];
  const { data: classes }   = useClasses(currentSession?.id ?? "");
  const allSections = classes?.flatMap((c: any) =>
    (c.sections ?? []).map((s: any) => ({ ...s, className: c.name }))
  ) ?? [];

  const [form, setForm] = useState({
    firstName: "", lastName: "", admissionNumber: "",
    dateOfBirth: "", gender: "MALE", sectionId: "",
    academicYear: currentSession?.id ?? "",
    branchId: "",
    // Guardian
    guardianFirstName: "", guardianLastName: "",
    guardianPhone: "", guardianEmail: "", guardianRelation: "FATHER", guardianAadhaar: "", studentAadhaar: "",
  });
  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  const createStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiClient.post("/students", {
        firstName:       form.firstName,
        lastName:        form.lastName,
        admissionNumber: form.admissionNumber,
        dateOfBirth:     form.dateOfBirth || undefined,
        gender:          form.gender,
        sectionId:       form.sectionId   || undefined,
        academicYear:    form.academicYear || currentSession?.id,
        branchId:        form.branchId || (branches && branches[0]?.id) || '',
      });
      const studentId = (res as any).id ?? (res as any).data?.id;

      // Create guardian if name provided
      if (form.guardianFirstName && studentId) {
        await apiClient.post("/students/guardians", {
          firstName: form.guardianFirstName,
          lastName:  form.guardianLastName,
          phone:     form.guardianPhone    || undefined,
          email:     form.guardianEmail    || undefined,
        }).then((g: any) => {
          const gId = g.id ?? g.data?.id;
          if (gId) return apiClient.post(`/students/${studentId}/guardians/link`, {
            guardianId: gId, relation: form.guardianRelation, isPrimary: true,
          });
        }).catch(() => {}); // Non-fatal
      }

      setShowForm(false);
      
setForm({ 
  firstName:"", lastName:"", admissionNumber:"", dateOfBirth:"", gender:"MALE",
  sectionId:"", academicYear: currentSession?.id ?? "",
  branchId: "", // ← ये जादू की झप्पी यहाँ डाल दो
  guardianFirstName:"", guardianLastName:"", guardianPhone:"", guardianEmail:"", 
  guardianRelation:"FATHER", guardianAadhaar:"", studentAadhaar:"" 
});	
      refetch();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? "Failed to add student");
    } finally {
      setSaving(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault(); setQuery(search); setPage(1);
  };

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle={meta ? `${meta.total} students enrolled` : "Manage student records"}
        action={
          <button onClick={() => setShowForm(p => !p)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" /> Add Student
          </button>
        }
      />

      {/* Add student form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-6 mb-6">
          <h3 className="font-semibold text-slate-900 mb-4">Add New Student</h3>
          <form onSubmit={createStudent}>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Student Info</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              {[
                { label: "First Name *",       key: "firstName",       required: true },
                { label: "Last Name *",        key: "lastName",        required: true },
                { label: "Admission Number *", key: "admissionNumber", required: true },
                { label: "Date of Birth",      key: "dateOfBirth",     type: "date" },
              ].map(({ label, key, required, type }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>
                  <input type={type ?? "text"} required={required} value={(form as any)[key]} onChange={f(key)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Gender</label>
                <select value={form.gender} onChange={f("gender")}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {["MALE","FEMALE","OTHER"].map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Section</label>
                <select value={form.sectionId} onChange={f("sectionId")}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select section</option>
                  {allSections.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.className} — {s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Guardian (Optional)</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              {[
                { label: "First Name", key: "guardianFirstName" },
                { label: "Last Name",  key: "guardianLastName"  },
                { label: "Phone",      key: "guardianPhone"     },
                { label: "Email",      key: "guardianEmail",    type: "email" },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>
                  <input type={type ?? "text"} value={(form as any)[key]} onChange={f(key)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Relation</label>
                <select value={form.guardianRelation} onChange={f("guardianRelation")}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {["FATHER","MOTHER","GRANDFATHER","GRANDMOTHER","UNCLE","AUNT","SIBLING","LEGAL_GUARDIAN","OTHER"].map(r => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-2 border-t border-slate-100">
              <button type="submit" disabled={saving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors flex items-center gap-2">
                {saving && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {saving ? "Adding..." : "Add Student"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6 flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search by name or admission number…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button type="submit" className="px-4 py-2.5 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-700 transition-colors">Search</button>
        {query && (
          <button type="button" onClick={() => { setSearch(""); setQuery(""); setPage(1); }}
            className="px-4 py-2.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Clear</button>
        )}
      </form>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />)}
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500 text-sm">{error}</div>
        ) : students.length === 0 ? (
          <EmptyState title="No students found"
            message={query ? "Try a different search term." : "Add your first student to get started."}
            icon={<Users className="w-12 h-12" />} />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {["Student","Admission No.","Class","Guardian","Status"].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {students.map((s: any) => {
                  const guardian = s.guardianLinks?.[0]?.guardian;
                  const cls = s.section ? `${s.section.class.name} — ${s.section.name}` : "—";
                  return (
                    <tr key={s.id}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/dashboard/students/${s.id}`)}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                            {s.firstName[0]}{s.lastName[0]}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{s.firstName} {s.lastName}</p>
                            <p className="text-xs text-slate-400">{new Date(s.createdAt).toLocaleDateString("en-IN")}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-600">{s.admissionNumber}</td>
                      <td className="px-6 py-4 text-slate-600">{cls}</td>
                      <td className="px-6 py-4">
                        {guardian ? (
                          <div>
                            <p className="text-slate-700">{guardian.firstName}</p>
                            {guardian.phone && (
                              <p className="text-xs text-slate-400 flex items-center gap-1">
                                <Phone className="w-3 h-3" />{guardian.phone}
                              </p>
                            )}
                          </div>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-6 py-4">
                        <Badge label={s.status} variant={statusVariant(s.status)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {meta && meta.lastPage > 1 && (
              <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                <p className="text-xs text-slate-500">Page {meta.page} of {meta.lastPage} · {meta.total} total</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors">← Prev</button>
                  <button onClick={() => setPage(p => Math.min(meta.lastPage, p + 1))} disabled={page === meta.lastPage}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors">Next →</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
