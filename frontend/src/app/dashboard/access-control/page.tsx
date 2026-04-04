"use client";
import { useState, useEffect } from "react";
import { Shield, Save, Users, Zap, Info, Check, ChevronDown, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge }      from "@/components/ui/badge";
import { useApi }     from "@/lib/hooks";
import { apiClient }  from "@/lib/api";
import { useToast } from '@/lib/use-toast';


// All roles with descriptions of what each one means
const ROLES = [
  { id:"SCHOOL_ADMIN",      label:"School Admin",       color:"bg-red-100 text-red-700",
    desc:"Full access to everything except superadmin. Manages all modules, users, settings and billing." },
  { id:"PRINCIPAL",         label:"Principal",          color:"bg-orange-100 text-orange-700",
    desc:"Academic head. Full academic access, can approve admissions, view all reports. Cannot manage billing or system settings." },
  { id:"VICE_PRINCIPAL",    label:"Vice Principal",     color:"bg-amber-100 text-amber-700",
    desc:"Supports principal. Manages classes, sections, timetables and attendance. Can approve leaves." },
  { id:"CLASS_TEACHER",     label:"Class Teacher",      color:"bg-blue-100 text-blue-700",
    desc:"Appointed to a specific section. Marks attendance for own section, enters marks, assigns homework. Extra responsibility over TEACHER." },
  { id:"TEACHER",           label:"Teacher",            color:"bg-sky-100 text-sky-700",
    desc:"Subject teacher. Can enter marks for assigned subjects, create homework. Read-only access to own section's students." },
  { id:"ACCOUNTANT",        label:"Accountant",         color:"bg-green-100 text-green-700",
    desc:"Manages all billing, fee collection, receipts and payroll processing. No access to academic data." },
  { id:"LIBRARIAN",         label:"Librarian",          color:"bg-purple-100 text-purple-700",
    desc:"Full library management — catalog, issue, return. Read-only access to student list." },
  { id:"RECEPTIONIST",      label:"Receptionist",       color:"bg-pink-100 text-pink-700",
    desc:"Front desk. Creates admission inquiries, manages visitor log, handles complaints." },
  { id:"HR_MANAGER",        label:"HR Manager",         color:"bg-teal-100 text-teal-700",
    desc:"Staff lifecycle management — joining, leaves, payroll. No access to student data." },
  { id:"TRANSPORT_MANAGER", label:"Transport Manager",  color:"bg-indigo-100 text-indigo-700",
    desc:"Manages routes, vehicles and student transport assignments." },
  { id:"NURSE",             label:"Nurse",              color:"bg-rose-100 text-rose-700",
    desc:"Read-only access to student list. Can view health-related records." },
  { id:"STAFF",             label:"Staff",              color:"bg-slate-100 text-slate-600",
    desc:"Basic staff member. Can read announcements. No operational access." },
];

// Module display names
const MODULE_LABELS: Record<string,string> = {
  students:"Students", academics:"Academics", attendance:"Attendance",
  timetable:"Timetable", exams:"Exams", gradebook:"Gradebook",
  homework:"Homework", admissions:"Admissions", certificates:"Certificates",
  billing:"Billing", accounting:"Accounting", payroll:"Payroll",
  staff:"Staff", hr:"HR & Leaves", library:"Library",
  transport:"Transport", inventory:"Inventory", reception:"Reception",
  communication:"Communication", reports:"Reports", settings:"Settings",
  access_control:"Access Control",
};

// Module color coding by category
const MODULE_COLORS: Record<string,string> = {
  students:"blue", academics:"blue", attendance:"blue", timetable:"blue",
  exams:"blue", gradebook:"blue", homework:"blue", admissions:"blue", certificates:"blue",
  billing:"green", accounting:"green", payroll:"green",
  staff:"violet", hr:"violet",
  library:"amber", transport:"amber", inventory:"amber",
  reception:"pink", communication:"pink",
  reports:"slate", settings:"slate", access_control:"slate",
};

export default function AccessControlPage() {
  const { toast } = useToast();

  const [selectedRole, setSelectedRole] = useState("CLASS_TEACHER");
  const [granted, setGranted]           = useState<Set<string>>(new Set());
  const [saving,  setSaving]            = useState(false);
  const [seeding, setSeeding]           = useState(false);
  const [applying, setApplying]         = useState(false);
  const [expanded, setExpanded]         = useState<Record<string,boolean>>({});
  const [saved, setSaved]               = useState(false);

  const { data: modulePermissions, loading: loadingPerms, refetch: refetchPerms } =
    useApi<any[]>("/access-control/permissions/grouped", []);
  const { data: rolePermissions, loading: loadingRole, refetch: refetchRole } =
    useApi<any[]>(`/access-control/roles/${selectedRole}/permissions`, [selectedRole]);

  useEffect(() => {
    if (rolePermissions) setGranted(new Set((rolePermissions as any[]).map((p:any) => p.id)));
  }, [rolePermissions]);

  const toggle = (id: string) => setGranted(prev => {
    const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s;
  });

  const selectModule = (mod: string) => {
    const perms = (modulePermissions as any[])?.find((m:any) => m.module === mod)?.permissions ?? [];
    setGranted(prev => { const s = new Set(prev); perms.forEach((p:any) => s.add(p.id)); return s; });
  };
  const clearModule = (mod: string) => {
    const perms = (modulePermissions as any[])?.find((m:any) => m.module === mod)?.permissions ?? [];
    setGranted(prev => { const s = new Set(prev); perms.forEach((p:any) => s.delete(p.id)); return s; });
  };

  const save = async () => {
    setSaving(true); setSaved(false);
    try {
      await apiClient.post("/access-control/roles/permissions/bulk", {
        role: selectedRole, permissionIds: Array.from(granted),
      });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
      refetchRole();
    } catch { toast.error("Failed to save"); } finally { setSaving(false); }
  };

  const seed = async () => {
    setSeeding(true);
    try {
      const r = await apiClient.post("/access-control/permissions/seed", {});
      toast.error(`Permissions seeded! ${(r as any).created || 0} entries created/updated.`);
      refetchPerms();
    } catch { toast.error("Failed to seed"); } finally { setSeeding(false); }
  };

  const applyMatrix = async () => {
    if (!confirm("This will apply the built-in recommended permissions to ALL roles. Existing customisations for those roles will be overwritten. Continue?")) return;
    setApplying(true);
    try {
      const r = await apiClient.post("/access-control/roles/apply-default-matrix", {});
      toast.error(`Default matrix applied! ${(r as any).granted} permissions granted across ${(r as any).roles} roles.`);
      refetchRole();
    } catch { toast.error("Failed to apply matrix"); } finally { setApplying(false); }
  };

  const toggleModule = (mod: string) =>
    setExpanded(p => ({ ...p, [mod]: !p[mod] }));

  const role = ROLES.find(r => r.id === selectedRole);
  const modules = (modulePermissions as any[]) ?? [];

  // Count granted per module
  const grantedPerModule = (mod: string) =>
    modules.find((m:any) => m.module === mod)?.permissions
      .filter((p:any) => granted.has(p.id)).length ?? 0;
  const totalPerModule = (mod: string) =>
    modules.find((m:any) => m.module === mod)?.permissions.length ?? 0;

  return (
    <div>
      <PageHeader
        title="Access Control"
        subtitle="Define exactly what each role can see and do"
        action={
          <div className="flex gap-2">
            <button onClick={seed} disabled={seeding}
              className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">
              {seeding ? "Seeding…" : "Seed permissions"}
            </button>
            <button onClick={applyMatrix} disabled={applying}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium disabled:opacity-50 transition-colors">
              <Zap className="w-4 h-4" />
              {applying ? "Applying…" : "Apply default matrix"}
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* ── Role list ── */}
        <div className="lg:col-span-1 space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Users className="w-3.5 h-3.5" /> Select Role
          </p>
          {ROLES.map(r => (
            <button key={r.id} onClick={() => setSelectedRole(r.id)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                selectedRole === r.id
                  ? "border-blue-300 bg-blue-50 shadow-sm"
                  : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50"
              }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-slate-800">{r.label}</span>
                {selectedRole === r.id && <div className="w-2 h-2 rounded-full bg-blue-600" />}
              </div>
              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{r.desc}</p>
            </button>
          ))}
        </div>

        {/* ── Permission matrix ── */}
        <div className="lg:col-span-3">
          {/* Role header */}
          {role && (
            <div className={`flex items-start gap-4 p-4 rounded-xl border mb-5 ${role.color.replace("text-","border-").split(" ")[0].replace("bg-","border-")} bg-white border-slate-100`}>
              <div className={`w-10 h-10 rounded-lg ${role.color} flex items-center justify-center flex-shrink-0`}>
                <Shield className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="font-bold text-slate-900">{role.label}</h2>
                  <Badge label={`${granted.size} permissions`} variant="info" />
                </div>
                <p className="text-sm text-slate-500">{role.desc}</p>
              </div>
              <button onClick={save} disabled={saving || loadingRole}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  saved
                    ? "bg-emerald-600 text-white"
                    : "bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                }`}>
                {saved ? <><Check className="w-4 h-4" /> Saved!</> : saving ? "Saving…" : <><Save className="w-4 h-4" /> Save</>}
              </button>
            </div>
          )}

          {loadingPerms || loadingRole ? (
            <div className="space-y-3">
              {[...Array(5)].map((_,i) => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
            </div>
          ) : modules.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-100 p-12 text-center">
              <Shield className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 font-medium mb-1">No permissions found</p>
              <p className="text-xs text-slate-400 mb-4">Click "Seed permissions" to create the permission registry, then "Apply default matrix" to assign them.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {modules.map((mod:any) => {
                const count = grantedPerModule(mod.module);
                const total = totalPerModule(mod.module);
                const isExpanded = expanded[mod.module] !== false; // default open
                const colorKey = MODULE_COLORS[mod.module] ?? "slate";

                return (
                  <div key={mod.module} className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                    {/* Module header */}
                    <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => toggleModule(mod.module)}>
                      {isExpanded
                        ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      }
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">
                            {MODULE_LABELS[mod.module] ?? mod.module.replace(/_/g," ")}
                          </span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            count === 0 ? "bg-slate-100 text-slate-400" :
                            count === total ? "bg-emerald-100 text-emerald-700" :
                            "bg-blue-100 text-blue-700"
                          }`}>
                            {count}/{total}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={e => { e.stopPropagation(); selectModule(mod.module); }}
                          className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-colors">
                          All
                        </button>
                        <button onClick={e => { e.stopPropagation(); clearModule(mod.module); }}
                          className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-colors">
                          None
                        </button>
                      </div>
                    </div>

                    {/* Permissions grid */}
                    {isExpanded && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 px-4 pb-3">
                        {mod.permissions.map((perm:any) => {
                          const isGranted = granted.has(perm.id);
                          return (
                            <label key={perm.id}
                              className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                                isGranted
                                  ? "bg-blue-50 border-blue-200"
                                  : "bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                              }`}>
                              <div onClick={() => toggle(perm.id)}
                                className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                                  isGranted ? "bg-blue-600 border-blue-600" : "border-slate-300"
                                }`}>
                                {isGranted && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <span className={`text-xs font-medium capitalize leading-tight ${
                                isGranted ? "text-blue-700" : "text-slate-600"
                              }`}>
                                {perm.action.replace(/_/g," ")}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
