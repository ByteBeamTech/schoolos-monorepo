"use client";
import { use, useState, useEffect }  from "react";
import { useRouter }       from "next/navigation";
import { ArrowLeft, Edit2, BookOpen, Check, Save, X, Mail, Phone, Briefcase } from "lucide-react";
import { Badge }   from "@/components/ui/badge";
import { useApi }  from "@/lib/hooks";
import { apiClient } from "@/lib/api";
import { useToast } from '@/lib/use-toast';


const DEPARTMENTS = ["Academics","Administration","Finance","Sports","Library","Health","Transport","IT","Other"];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }  = use(params);
  const router  = useRouter();

  const { data: staff, loading, refetch } = useApi<any>(`/staff/${id}`);
  const { data: subjects } =
  useApi<any[]>("/academics/subjects");

const {
  data: teacherSubjects,
  refetch: refetchTeacherSubjects,
} = useApi<any[]>(
  `/staff/${id}/subject-preferences`
);
  const { toast } = useToast();

  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [savingSubjects, setSavingSubjects] = useState(false);
  const [form, setForm] = useState({ designation: "", department: "", qualification: "", experience: "" });
  useEffect(() => {
  if (teacherSubjects) {
    setSelectedSubjects(
      teacherSubjects.map((s: any) => s.id)
    );
  }
}, [teacherSubjects]);

  const saveSubjectPreferences = async () => {
  setSavingSubjects(true);

  try {
    await apiClient.post(
      `/staff/${id}/subject-preferences`,
      {
        subjectIds: selectedSubjects,
      }
    );

    toast.success("Subject preferences updated");
    refetchTeacherSubjects();
  } catch (err: any) {
    toast.error(
      err?.response?.data?.message ||
      "Failed to save subject preferences"
    );
  } finally {
    setSavingSubjects(false);
  }
}; 



  const startEdit = () => {
    setForm({
      designation:   staff?.designation   ?? "",
      department:    staff?.department    ?? "",
      qualification: staff?.qualification ?? "",
      experience:    String(staff?.experience ?? ""),
    });
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await apiClient.patch(`/staff/${id}`, {
        designation:   form.designation   || undefined,
        department:    form.department    || undefined,
        qualification: form.qualification || undefined,
        experience:    form.experience    ? parseInt(form.experience) : undefined,
      });
      setEditing(false);
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!staff) return <div className="text-center py-24 text-slate-400">Staff member not found</div>;

  return (
    <div>
      <button onClick={() => router.push("/dashboard/staff")}
        className="flex items-center gap-2 text-slate-400 hover:text-slate-700 text-sm mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Staff
      </button>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mb-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xl font-bold">
              {staff.user.firstName[0]}{staff.user.lastName[0]}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{staff.user.firstName} {staff.user.lastName}</h1>
              <p className="text-slate-500 text-sm mt-0.5">{staff.designation} · {staff.employeeId}</p>
              <div className="flex gap-2 mt-2">
                <Badge label={staff.user.role}  variant="info" />
                <Badge label={staff.isActive ? "Active" : "Inactive"} variant={staff.isActive ? "success" : "neutral"} />
                {staff.department && <Badge label={staff.department} variant="neutral" />}
              </div>
            </div>
          </div>
          {!editing ? (
            <button onClick={startEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors">
              <Edit2 className="w-3 h-3" /> Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-100 text-slate-600 rounded-lg">
                <X className="w-3 h-3" /> Cancel
              </button>
              <button onClick={save} disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg disabled:opacity-50">
                <Save className="w-3 h-3" /> {saving ? "Saving..." : "Save"}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Contact */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 text-sm mb-4">Contact</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span className="text-slate-700">{staff.user.email}</span>
            </div>
            {staff.user.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-slate-700">{staff.user.phone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Employment */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 text-sm mb-4">Employment</h2>
          {editing ? (
            <div className="space-y-3">
              {[
                { label: "Designation",   key: "designation",   type: "text" },
                { label: "Qualification", key: "qualification", type: "text" },
                { label: "Experience (yrs)", key: "experience", type: "number" },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="block text-xs text-slate-500 mb-1">{label}</label>
                  <input type={type} value={(form as any)[key]}
                    onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Department</label>
                <select value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">None</option>
                  {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { label: "Employee ID",    value: staff.employeeId },
                { label: "Date of Joining",value: fmtDate(staff.dateOfJoining) },
                { label: "Qualification",  value: staff.qualification ?? "—" },
                { label: "Experience",     value: staff.experience != null ? `${staff.experience} years` : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-medium text-slate-900">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
{/* Subject Preferences */}
<div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 md:col-span-2">
  <div className="flex items-center gap-2 mb-4">
    <BookOpen className="w-4 h-4 text-blue-600" />
    <h2 className="font-semibold text-slate-900">
      Subject Preferences
    </h2>
  </div>

  <p className="text-sm text-slate-500 mb-4">
    Select the subjects this teacher can teach.
  </p>

  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
    {(subjects ?? []).map((subject: any) => (
      <label
        key={subject.id}
        className="flex items-center gap-2 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer"
      >
        <input
          type="checkbox"
          checked={selectedSubjects.includes(subject.id)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedSubjects((prev) => [...prev, subject.id]);
            } else {
              setSelectedSubjects((prev) =>
                prev.filter((id) => id !== subject.id)
              );
            }
          }}
        />

        <span className="text-sm">{subject.name}</span>
      </label>
    ))}
  </div>

  <button
    onClick={saveSubjectPreferences}
    disabled={savingSubjects}
    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
  >
    {savingSubjects ? "Saving..." : "Save Subject Preferences"}
  </button>
</div>

      </div>
    </div>
  );
}
