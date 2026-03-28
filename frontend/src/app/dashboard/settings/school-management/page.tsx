"use client";
import { useState, useEffect } from "react";
import { Building2, Users, BookOpen, Banknote, Bus, Palette, Shield, ChevronRight, Plus, Trash2, Check } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { apiClient }  from "@/lib/api";

type Tab = "profile"|"branches"|"users"|"academics"|"fees"|"transport"|"branding"|"security";

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "profile",   label: "School Profile", icon: Building2 },
  { id: "branches",  label: "Branches",       icon: Building2 },
  { id: "users",     label: "Users",          icon: Users     },
  { id: "academics", label: "Academic Setup", icon: BookOpen  },
  { id: "fees",      label: "Fee Setup",      icon: Banknote  },
  { id: "transport", label: "Transport",      icon: Bus       },
  { id: "branding",  label: "Branding",       icon: Palette   },
  { id: "security",  label: "Security",       icon: Shield    },
];

function useFetch<T>(url: string) {
  const [data, setData]       = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const load = async () => {
    setLoading(true); setError(null);
    try { const r = await apiClient.get(url); setData((r as any).data ?? r); }
    catch (e: any) { setError(e?.response?.data?.message ?? "Failed to load"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [url]);
  return { data, loading, error, refetch: load };
}

function Field({ label, value, onChange, type = "text", required = false }: any) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}{required && " *"}</label>
      <input type={type} required={required} value={value ?? ""} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  );
}

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function SaveBtn({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={saving}
      className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors">
      {saving ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
      {saving ? "Saving…" : "Save Changes"}
    </button>
  );
}

function Hdr({ title, action }: { title: string; action?: React.ReactNode }) {
  return <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-slate-900">{title}</h3>{action}</div>;
}

function AddBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium transition-colors">
      <Plus className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl border border-slate-100 p-5 ${className}`}>{children}</div>;
}

// ── Profile ──────────────────────────────────────────────────────────────────
function ProfileTab() {
  const { data, loading } = useFetch("/school-management/profile");
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data) setForm(data); }, [data]);
  const f = (k: string) => (v: string) => setForm((p: any) => ({ ...p, [k]: v }));
  const save = async () => {
    setSaving(true);
    try { await apiClient.patch("/school-management/profile", form); alert("Saved!"); }
    catch (e: any) { alert(e?.response?.data?.message ?? "Failed"); }
    finally { setSaving(false); }
  };
  if (loading) return <div className="h-40 bg-slate-100 rounded-xl animate-pulse" />;
  return (
    <div className="space-y-5">
      <Card>
        <Hdr title="Basic Information" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="School Name *"    value={form.name}               onChange={f("name")}               required />
          <Field label="Short Name"       value={form.shortName}          onChange={f("shortName")}          />
          <Field label="Phone"            value={form.phone}              onChange={f("phone")}              />
          <Field label="Email"            value={form.email}              onChange={f("email")}  type="email" />
          <Field label="Website"          value={form.website}            onChange={f("website")}            />
          <Field label="Board"            value={form.board}              onChange={f("board")}              />
          <Field label="Reg. Number"      value={form.registrationNumber} onChange={f("registrationNumber")} />
          <Field label="GSTIN"            value={form.gstin}              onChange={f("gstin")}              />
          <Field label="Timezone"         value={form.timezone}           onChange={f("timezone")}           />
          <Field label="Currency"         value={form.currency}           onChange={f("currency")}           />
        </div>
      </Card>
      <Card>
        <Hdr title="Address" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="md:col-span-3"><Field label="Street Address" value={form.address} onChange={f("address")} /></div>
          <Field label="City"    value={form.city}    onChange={f("city")}    />
          <Field label="State"   value={form.state}   onChange={f("state")}   />
          <Field label="Pincode" value={form.pincode} onChange={f("pincode")} />
          <Field label="Country" value={form.country} onChange={f("country")} />
        </div>
      </Card>
      <SaveBtn saving={saving} onClick={save} />
    </div>
  );
}

// ── Branches ──────────────────────────────────────────────────────────────────
function BranchesTab() {
  const { data, loading, refetch } = useFetch<any[]>("/school-management/branches");
  const [show, setShow]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm]   = useState({ name: "", code: "", address: "", city: "", phone: "", email: "", principal: "" });
  const f = (k: string) => (v: string) => setForm(p => ({ ...p, [k]: v }));
  const create = async () => {
    setSaving(true);
    try { await apiClient.post("/school-management/branches", form); setShow(false); setForm({ name:"",code:"",address:"",city:"",phone:"",email:"",principal:"" }); refetch(); }
    catch (e: any) { alert(e?.response?.data?.message ?? "Failed"); }
    finally { setSaving(false); }
  };
  const remove = async (id: string) => { if (!confirm("Deactivate branch?")) return; await apiClient.delete(`/school-management/branches/${id}`); refetch(); };
  return (
    <div className="space-y-4">
      <Hdr title="Branches" action={<AddBtn label="Add Branch" onClick={() => setShow(p => !p)} />} />
      {show && (
        <Card>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <Field label="Name *"    value={form.name}      onChange={f("name")}      required />
            <Field label="Code"      value={form.code}      onChange={f("code")}      />
            <Field label="Principal" value={form.principal} onChange={f("principal")} />
            <Field label="Phone"     value={form.phone}     onChange={f("phone")}     />
            <Field label="Email"     value={form.email}     onChange={f("email")} type="email" />
            <Field label="City"      value={form.city}      onChange={f("city")}      />
            <div className="md:col-span-3"><Field label="Address" value={form.address} onChange={f("address")} /></div>
          </div>
          <div className="flex gap-2">
            <SaveBtn saving={saving} onClick={create} />
            <button onClick={() => setShow(false)} className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg">Cancel</button>
          </div>
        </Card>
      )}
      {loading ? <div className="h-32 bg-slate-100 rounded-xl animate-pulse" /> : (
        <Card className="p-0 overflow-hidden">
          {!data?.length ? <p className="p-8 text-center text-slate-400 text-sm">No branches yet.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 border-b border-slate-100">
                {["Name","Code","City","Principal","Phone",""].map(h => <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {data?.map((b: any) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium">{b.name}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{b.code ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-600">{b.city ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-600">{b.principal ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-600">{b.phone ?? "—"}</td>
                    <td className="px-5 py-3 text-right"><button onClick={() => remove(b.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}

// ── Users ─────────────────────────────────────────────────────────────────────
const ROLES = ["SCHOOL_ADMIN","PRINCIPAL","VICE_PRINCIPAL","TEACHER","ACCOUNTANT","LIBRARIAN","RECEPTIONIST","SUPPORT_STAFF"];
function UsersTab() {
  const { data, loading, refetch } = useFetch<any[]>("/school-management/users");
  const [show, setShow]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm]   = useState({ firstName:"", lastName:"", email:"", role:"TEACHER" });
  const f = (k: string) => (v: string) => setForm(p => ({ ...p, [k]: v }));
  const invite = async () => {
    setSaving(true);
    try { await apiClient.post("/school-management/users/invite", form); setShow(false); setForm({ firstName:"",lastName:"",email:"",role:"TEACHER" }); refetch(); }
    catch (e: any) { alert(e?.response?.data?.message ?? "Failed"); }
    finally { setSaving(false); }
  };
  const remove = async (id: string) => { if (!confirm("Remove user?")) return; await apiClient.delete(`/school-management/users/${id}`); refetch(); };
  const roleColor = (r: string) => ({ SCHOOL_ADMIN:"bg-purple-100 text-purple-700", PRINCIPAL:"bg-blue-100 text-blue-700", ACCOUNTANT:"bg-green-100 text-green-700", TEACHER:"bg-amber-100 text-amber-700" }[r] ?? "bg-slate-100 text-slate-600");
  return (
    <div className="space-y-4">
      <Hdr title="Users & Roles" action={<AddBtn label="Invite User" onClick={() => setShow(p => !p)} />} />
      {show && (
        <Card>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <Field label="First Name *" value={form.firstName} onChange={f("firstName")} required />
            <Field label="Last Name *"  value={form.lastName}  onChange={f("lastName")}  required />
            <Field label="Email *"      value={form.email}     onChange={f("email")} type="email" required />
            <Sel label="Role" value={form.role} onChange={f("role")} options={ROLES.map(r => ({ value: r, label: r.replace(/_/g," ") }))} />
          </div>
          <div className="flex gap-2">
            <SaveBtn saving={saving} onClick={invite} />
            <button onClick={() => setShow(false)} className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg">Cancel</button>
          </div>
        </Card>
      )}
      {loading ? <div className="h-40 bg-slate-100 rounded-xl animate-pulse" /> : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 border-b border-slate-100">
              {["User","Email","Role","Status",""].map(h => <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-50">
              {data?.map((u: any) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3"><div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">{u.firstName?.[0]}{u.lastName?.[0]}</div>
                    <span className="font-medium">{u.firstName} {u.lastName}</span>
                  </div></td>
                  <td className="px-5 py-3 text-slate-500">{u.email}</td>
                  <td className="px-5 py-3"><span className={`text-xs font-medium px-2 py-1 rounded-full ${roleColor(u.role)}`}>{u.role.replace(/_/g," ")}</span></td>
                  <td className="px-5 py-3"><span className={`text-xs font-medium px-2 py-1 rounded-full ${u.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>{u.isActive ? "Active" : "Inactive"}</span></td>
                  <td className="px-5 py-3 text-right"><button onClick={() => remove(u.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ── Academics ─────────────────────────────────────────────────────────────────
function AcademicsTab() {
  const { data, loading, refetch } = useFetch<any>("/school-management/academics");
  const [sc, setSc] = useState(false); const [ss, setSs] = useState(false); const [ssub, setSsub] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cf, setCf] = useState({ name:"", sortOrder:"" });
  const [sf, setSf] = useState({ name:"", classId:"", capacity:"" });
  const [subf, setSubf] = useState({ name:"", code:"" });
  const post = async (url: string, body: any, reset: () => void) => {
    setSaving(true); try { await apiClient.post(url, body); reset(); refetch(); } catch (e: any) { alert(e?.response?.data?.message ?? "Failed"); } finally { setSaving(false); }
  };
  return (
    <div className="space-y-5">
      <Card>
        <Hdr title="Classes" action={<AddBtn label="Add Class" onClick={() => setSc(p => !p)} />} />
        {sc && <div className="grid grid-cols-3 gap-3 mb-4 pb-4 border-b border-slate-100">
          <Field label="Class Name *" value={cf.name} onChange={(v: string) => setCf(p => ({ ...p, name: v }))} required />
          <Field label="Sort Order" value={cf.sortOrder} onChange={(v: string) => setCf(p => ({ ...p, sortOrder: v }))} type="number" />
          <div className="flex items-end gap-2">
            <SaveBtn saving={saving} onClick={() => post("/school-management/academics/classes", { name: cf.name, sortOrder: Number(cf.sortOrder) || 0 }, () => { setSc(false); setCf({ name:"", sortOrder:"" }); })} />
            <button onClick={() => setSc(false)} className="px-3 py-2 text-sm bg-slate-100 rounded-lg">Cancel</button>
          </div>
        </div>}
        {loading ? <div className="h-16 bg-slate-100 rounded-lg animate-pulse" /> : (
          <div className="space-y-2">{data?.classes?.map((c: any) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-lg">
              <span className="font-medium text-slate-800 flex-1">{c.name}</span>
              <span className="text-xs text-slate-400">{c.sections?.length ?? 0} sections</span>
              {c.sections?.map((s: any) => <span key={s.id} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{s.name}</span>)}
            </div>
          ))}{!data?.classes?.length && <p className="text-sm text-slate-400 py-2">No classes yet.</p>}</div>
        )}
      </Card>
      <Card>
        <Hdr title="Sections" action={<AddBtn label="Add Section" onClick={() => setSs(p => !p)} />} />
        {ss && <div className="grid grid-cols-3 gap-3 pb-4 border-b border-slate-100">
          <Field label="Section Name *" value={sf.name} onChange={(v: string) => setSf(p => ({ ...p, name: v }))} required />
          <Sel label="Class *" value={sf.classId} onChange={(v: string) => setSf(p => ({ ...p, classId: v }))}
            options={[{ value:"", label:"Select class" }, ...(data?.classes ?? []).map((c: any) => ({ value: c.id, label: c.name }))]} />
          <Field label="Capacity" value={sf.capacity} onChange={(v: string) => setSf(p => ({ ...p, capacity: v }))} type="number" />
          <div className="flex items-end gap-2">
            <SaveBtn saving={saving} onClick={() => post("/school-management/academics/sections", { name: sf.name, classId: sf.classId, capacity: Number(sf.capacity) || undefined }, () => { setSs(false); setSf({ name:"", classId:"", capacity:"" }); })} />
            <button onClick={() => setSs(false)} className="px-3 py-2 text-sm bg-slate-100 rounded-lg">Cancel</button>
          </div>
        </div>}
      </Card>
      <Card>
        <Hdr title="Subjects" action={<AddBtn label="Add Subject" onClick={() => setSsub(p => !p)} />} />
        {ssub && <div className="grid grid-cols-3 gap-3 mb-4 pb-4 border-b border-slate-100">
          <Field label="Subject Name *" value={subf.name} onChange={(v: string) => setSubf(p => ({ ...p, name: v }))} required />
          <Field label="Code" value={subf.code} onChange={(v: string) => setSubf(p => ({ ...p, code: v }))} />
          <div className="flex items-end gap-2">
            <SaveBtn saving={saving} onClick={() => post("/school-management/academics/subjects", subf, () => { setSsub(false); setSubf({ name:"", code:"" }); })} />
            <button onClick={() => setSsub(false)} className="px-3 py-2 text-sm bg-slate-100 rounded-lg">Cancel</button>
          </div>
        </div>}
        {!loading && <div className="flex flex-wrap gap-2">{data?.subjects?.map((s: any) => (
          <span key={s.id} className="text-sm bg-slate-100 text-slate-700 px-3 py-1 rounded-full">{s.name}{s.code && <span className="text-slate-400 text-xs ml-1">({s.code})</span>}</span>
        ))}{!data?.subjects?.length && <p className="text-sm text-slate-400">No subjects yet.</p>}</div>}
      </Card>
    </div>
  );
}

// ── Fee Setup ─────────────────────────────────────────────────────────────────
const FREQS = ["MONTHLY","QUARTERLY","HALF_YEARLY","ANNUAL","ONE_TIME"];
function FeeSetupTab() {
  const { data, loading, refetch } = useFetch<any>("/school-management/fees");
  const { data: ac } = useFetch<any>("/school-management/academics");
  const [showT, setShowT] = useState(false); const [showS, setShowS] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tf, setTf] = useState({ name:"", description:"", isMandatory:false, isRecurring:true });
  const [sf, setSf] = useState({ name:"", classId:"", frequency:"MONTHLY", amount:"", feeTypeId:"" });
  const post = async (url: string, body: any, reset: () => void) => {
    setSaving(true); try { await apiClient.post(url, body); reset(); refetch(); } catch (e: any) { alert(e?.response?.data?.message ?? "Failed"); } finally { setSaving(false); }
  };
  const del = async (id: string) => { if (!confirm("Delete?")) return; await apiClient.delete(`/school-management/fees/structures/${id}`); refetch(); };
  return (
    <div className="space-y-5">
      <Card>
        <Hdr title="Fee Types" action={<AddBtn label="Add Type" onClick={() => setShowT(p => !p)} />} />
        {showT && <div className="grid grid-cols-2 gap-3 mb-4 pb-4 border-b border-slate-100">
          <Field label="Name *" value={tf.name} onChange={(v: string) => setTf(p => ({ ...p, name: v }))} required />
          <Field label="Description" value={tf.description} onChange={(v: string) => setTf(p => ({ ...p, description: v }))} />
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer"><input type="checkbox" checked={tf.isMandatory} onChange={e => setTf(p => ({ ...p, isMandatory: e.target.checked }))} className="rounded" />Mandatory</label>
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer"><input type="checkbox" checked={tf.isRecurring} onChange={e => setTf(p => ({ ...p, isRecurring: e.target.checked }))} className="rounded" />Recurring</label>
          </div>
          <div className="flex items-end gap-2">
            <SaveBtn saving={saving} onClick={() => post("/school-management/fees/types", tf, () => { setShowT(false); setTf({ name:"", description:"", isMandatory:false, isRecurring:true }); })} />
            <button onClick={() => setShowT(false)} className="px-3 py-2 text-sm bg-slate-100 rounded-lg">Cancel</button>
          </div>
        </div>}
        <div className="flex flex-wrap gap-2">{data?.feeTypes?.map((t: any) => (
          <span key={t.id} className="text-sm bg-green-50 text-green-800 px-3 py-1.5 rounded-full border border-green-100">{t.name}{t.isMandatory && <span className="text-xs ml-1 text-green-600">(mandatory)</span>}</span>
        ))}{!loading && !data?.feeTypes?.length && <p className="text-sm text-slate-400">No fee types yet.</p>}</div>
      </Card>
      <Card>
        <Hdr title="Fee Structures" action={<AddBtn label="Add Structure" onClick={() => setShowS(p => !p)} />} />
        {showS && <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 pb-4 border-b border-slate-100">
          <Field label="Name *" value={sf.name} onChange={(v: string) => setSf(p => ({ ...p, name: v }))} required />
          <Sel label="Class *" value={sf.classId} onChange={(v: string) => setSf(p => ({ ...p, classId: v }))} options={[{ value:"", label:"Select class" }, ...(ac?.classes ?? []).map((c: any) => ({ value: c.id, label: c.name }))]} />
          <Sel label="Frequency" value={sf.frequency} onChange={(v: string) => setSf(p => ({ ...p, frequency: v }))} options={FREQS.map(f => ({ value: f, label: f.replace(/_/g," ") }))} />
          <Field label="Amount (₹) *" value={sf.amount} onChange={(v: string) => setSf(p => ({ ...p, amount: v }))} type="number" required />
          <Sel label="Fee Type" value={sf.feeTypeId} onChange={(v: string) => setSf(p => ({ ...p, feeTypeId: v }))} options={[{ value:"", label:"None" }, ...(data?.feeTypes ?? []).map((t: any) => ({ value: t.id, label: t.name }))]} />
          <div className="flex items-end gap-2">
            <SaveBtn saving={saving} onClick={() => post("/school-management/fees/structures", { ...sf, amount: Number(sf.amount), feeTypeId: sf.feeTypeId || undefined }, () => { setShowS(false); setSf({ name:"", classId:"", frequency:"MONTHLY", amount:"", feeTypeId:"" }); })} />
            <button onClick={() => setShowS(false)} className="px-3 py-2 text-sm bg-slate-100 rounded-lg">Cancel</button>
          </div>
        </div>}
        {loading ? <div className="h-24 bg-slate-100 rounded-lg animate-pulse" /> : (
          <table className="w-full text-sm"><thead><tr className="bg-slate-50">{["Name","Class","Frequency","Amount",""].map(h => <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-50">{data?.feeStructures?.map((s: any) => (
            <tr key={s.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium">{s.name}</td>
              <td className="px-4 py-3 text-slate-600">{s.class?.name ?? "—"}</td>
              <td className="px-4 py-3 text-slate-600">{s.frequency}</td>
              <td className="px-4 py-3 font-mono">₹{s.amount.toLocaleString("en-IN")}</td>
              <td className="px-4 py-3 text-right"><button onClick={() => del(s.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded"><Trash2 className="w-4 h-4" /></button></td>
            </tr>
          ))}{!data?.feeStructures?.length && <tr><td colSpan={5} className="px-4 py-4 text-center text-slate-400 text-sm">No fee structures yet.</td></tr>}</tbody></table>
        )}
      </Card>
    </div>
  );
}

// ── Transport ─────────────────────────────────────────────────────────────────
function TransportTab() {
  const { data, loading, refetch } = useFetch<any>("/school-management/transport");
  const [showR, setShowR] = useState(false); const [showV, setShowV] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rf, setRf] = useState({ name:"", description:"", feeAmount:"" });
  const [vf, setVf] = useState({ registrationNumber:"", model:"", capacity:"", driverName:"", driverPhone:"" });
  const post = async (url: string, body: any, reset: () => void) => {
    setSaving(true); try { await apiClient.post(url, body); reset(); refetch(); } catch (e: any) { alert(e?.response?.data?.message ?? "Failed"); } finally { setSaving(false); }
  };
  return (
    <div className="space-y-5">
      <Card>
        <Hdr title="Routes" action={<AddBtn label="Add Route" onClick={() => setShowR(p => !p)} />} />
        {showR && <div className="grid grid-cols-3 gap-3 mb-4 pb-4 border-b border-slate-100">
          <Field label="Route Name *" value={rf.name} onChange={(v: string) => setRf(p => ({ ...p, name: v }))} required />
          <Field label="Description" value={rf.description} onChange={(v: string) => setRf(p => ({ ...p, description: v }))} />
          <Field label="Fee (₹)" value={rf.feeAmount} onChange={(v: string) => setRf(p => ({ ...p, feeAmount: v }))} type="number" />
          <div className="flex items-end gap-2">
            <SaveBtn saving={saving} onClick={() => post("/school-management/transport/routes", { ...rf, feeAmount: Number(rf.feeAmount) || undefined }, () => { setShowR(false); setRf({ name:"", description:"", feeAmount:"" }); })} />
            <button onClick={() => setShowR(false)} className="px-3 py-2 text-sm bg-slate-100 rounded-lg">Cancel</button>
          </div>
        </div>}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{data?.routes?.map((r: any) => (
          <div key={r.id} className="p-3 bg-slate-50 rounded-lg"><p className="font-medium text-sm">{r.name}</p>{r.feeAmount && <p className="text-xs text-green-700 mt-1">₹{r.feeAmount.toLocaleString("en-IN")}/mo</p>}</div>
        ))}{!loading && !data?.routes?.length && <p className="text-sm text-slate-400">No routes yet.</p>}</div>
      </Card>
      <Card>
        <Hdr title="Vehicles" action={<AddBtn label="Add Vehicle" onClick={() => setShowV(p => !p)} />} />
        {showV && <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4 pb-4 border-b border-slate-100">
          <Field label="Reg. Number *" value={vf.registrationNumber} onChange={(v: string) => setVf(p => ({ ...p, registrationNumber: v }))} required />
          <Field label="Model"         value={vf.model}              onChange={(v: string) => setVf(p => ({ ...p, model: v }))} />
          <Field label="Capacity"      value={vf.capacity}           onChange={(v: string) => setVf(p => ({ ...p, capacity: v }))} type="number" />
          <Field label="Driver Name"   value={vf.driverName}         onChange={(v: string) => setVf(p => ({ ...p, driverName: v }))} />
          <Field label="Driver Phone"  value={vf.driverPhone}        onChange={(v: string) => setVf(p => ({ ...p, driverPhone: v }))} />
          <div className="flex items-end gap-2">
            <SaveBtn saving={saving} onClick={() => post("/school-management/transport/vehicles", { ...vf, capacity: Number(vf.capacity) || undefined }, () => { setShowV(false); setVf({ registrationNumber:"", model:"", capacity:"", driverName:"", driverPhone:"" }); })} />
            <button onClick={() => setShowV(false)} className="px-3 py-2 text-sm bg-slate-100 rounded-lg">Cancel</button>
          </div>
        </div>}
        {!loading && <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{data?.vehicles?.map((v: any) => (
          <div key={v.id} className="p-3 bg-slate-50 rounded-lg"><p className="font-mono font-medium text-sm">{v.registrationNumber}</p><p className="text-xs text-slate-500 mt-0.5">{v.model ?? ""}{v.capacity ? ` · ${v.capacity} seats` : ""}</p>{v.driverName && <p className="text-xs text-slate-400 mt-1">{v.driverName}{v.driverPhone && ` · ${v.driverPhone}`}</p>}</div>
        ))}{!data?.vehicles?.length && <p className="text-sm text-slate-400">No vehicles yet.</p>}</div>}
      </Card>
    </div>
  );
}

// ── Branding ──────────────────────────────────────────────────────────────────
function BrandingTab() {
  const { data, loading } = useFetch<any>("/school-management/branding");
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data) setForm(data); }, [data]);
  const f = (k: string) => (v: string) => setForm((p: any) => ({ ...p, [k]: v }));
  const save = async () => { setSaving(true); try { await apiClient.patch("/school-management/branding", form); alert("Saved!"); } catch (e: any) { alert(e?.response?.data?.message ?? "Failed"); } finally { setSaving(false); }};
  if (loading) return <div className="h-40 bg-slate-100 rounded-xl animate-pulse" />;
  return (
    <div className="space-y-5">
      <Card>
        <Hdr title="Brand Colors" />
        <div className="grid grid-cols-2 gap-6 mb-6">{[["Primary Color","primaryColor","#1E40AF"],["Secondary Color","secondaryColor","#DBEAFE"]].map(([label, key, def]) => (
          <div key={key}>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{label}</label>
            <div className="flex gap-3 items-center">
              <input type="color" value={form[key] ?? def} onChange={e => f(key)(e.target.value)} className="w-12 h-10 rounded cursor-pointer border border-slate-200" />
              <input type="text"  value={form[key] ?? def} onChange={e => f(key)(e.target.value)} className="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
            </div>
          </div>
        ))}</div>
        <Hdr title="Portal Settings" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Portal Title" value={form.portalTitle} onChange={f("portalTitle")} />
          <Field label="Tagline"      value={form.tagline}     onChange={f("tagline")}     />
          <Field label="Logo URL"     value={form.logoUrl}     onChange={f("logoUrl")}     />
          <Field label="Favicon URL"  value={form.faviconUrl}  onChange={f("faviconUrl")}  />
        </div>
        <div className="mt-5 p-4 rounded-xl border border-slate-200" style={{ background: form.secondaryColor ?? "#DBEAFE" }}>
          <p className="text-xs text-slate-500 mb-2">Preview</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ background: form.primaryColor ?? "#1E40AF" }}>S</div>
            <div><p className="font-semibold text-slate-900 text-sm">{form.portalTitle ?? "School Portal"}</p><p className="text-xs text-slate-500">{form.tagline ?? "Your school, our mission."}</p></div>
          </div>
        </div>
      </Card>
      <SaveBtn saving={saving} onClick={save} />
    </div>
  );
}

// ── Security ──────────────────────────────────────────────────────────────────
function SecurityTab() {
  const { data, loading } = useFetch<any>("/school-management/security");
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data) setForm(data); }, [data]);
  const f = (k: string) => (v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  const save = async () => { setSaving(true); try { await apiClient.patch("/school-management/security", form); alert("Saved!"); } catch (e: any) { alert(e?.response?.data?.message ?? "Failed"); } finally { setSaving(false); }};
  if (loading) return <div className="h-40 bg-slate-100 rounded-xl animate-pulse" />;
  return (
    <div className="space-y-5">
      <Card>
        <Hdr title="Session & Login" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">{[["Session Timeout (min)","sessionTimeoutMinutes",60],["Max Login Attempts","maxLoginAttempts",5],["Password Expiry (days)","passwordExpiryDays",90]].map(([label, key, def]) => (
          <div key={key as string}>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>
            <input type="number" value={form[key as string] ?? def} onChange={e => f(key as string)(Number(e.target.value))}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        ))}</div>
        <Hdr title="Policies" />
        <div className="space-y-3">{[
          { key:"requireMfaForAdmins",   label:"Require MFA for admins",     desc:"Admins must use two-factor authentication"         },
          { key:"enforcePasswordPolicy", label:"Enforce password policy",     desc:"Min 8 chars, uppercase, number, special char"      },
        ].map(({ key, label, desc }) => (
          <label key={key} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
            <input type="checkbox" checked={!!form[key]} onChange={e => f(key)(e.target.checked)} className="mt-0.5 rounded" />
            <div><p className="text-sm font-medium text-slate-800">{label}</p><p className="text-xs text-slate-500 mt-0.5">{desc}</p></div>
          </label>
        ))}</div>
      </Card>
      <SaveBtn saving={saving} onClick={save} />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SchoolManagementPage() {
  const [tab, setTab] = useState<Tab>("profile");
  const { data: ov }  = useFetch<any>("/school-management/overview");
  const PANELS: Record<Tab, React.ReactNode> = {
    profile: <ProfileTab />, branches: <BranchesTab />, users: <UsersTab />,
    academics: <AcademicsTab />, fees: <FeeSetupTab />, transport: <TransportTab />,
    branding: <BrandingTab />, security: <SecurityTab />,
  };
  return (
    <div>
      <PageHeader title="School Management" subtitle="Configure your school's profile, structure, and settings" />
      {ov && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[["Branches",ov.stats?.branches],["Staff",ov.stats?.users],["Classes",ov.stats?.classes],["Routes",ov.stats?.routes]].map(([l, v]) => (
            <div key={l as string} className="bg-white rounded-xl border border-slate-100 px-5 py-4">
              <p className="text-xs text-slate-400 mb-1">{l}</p>
              <p className="text-2xl font-semibold text-slate-900">{v ?? 0}</p>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-6">
        <nav className="w-52 flex-shrink-0">
          <ul className="space-y-0.5">{TABS.map(({ id, label, icon: Icon }) => (
            <li key={id}><button onClick={() => setTab(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-lg text-left transition-colors ${tab === id ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-600 hover:bg-slate-100"}`}>
              <Icon className="w-4 h-4 flex-shrink-0" />{label}{tab === id && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
            </button></li>
          ))}</ul>
        </nav>
        <div className="flex-1 min-w-0">{PANELS[tab]}</div>
      </div>
    </div>
  );
}
