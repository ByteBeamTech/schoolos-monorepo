"use client";
import { useState }        from "react";
import { useRouter }       from "next/navigation";
import { Search, Plus, ChevronLeft, ChevronRight, CheckCircle, XCircle } from "lucide-react";
import { PageHeader }      from "@/components/ui/page-header";
import { Badge }           from "@/components/ui/badge";
import { useApi }          from "@/lib/hooks";
import { api }             from "@/lib/api";
import { formatDate }      from "@/lib/utils";

function statusVariant(s: string): any {
  return s === "ACTIVE" ? "success" : s === "TRIAL" ? "info" : s === "SUSPENDED" ? "warning" : "error";
}
function tierVariant(t: string): any {
  return t === "ENTERPRISE" ? "purple" : t === "PRO" ? "info" : t === "GROWTH" ? "success" : "neutral";
}

// ── Onboard Modal ─────────────────────────────────────────────────────────
function OnboardModal({ plans, onClose, onSuccess }: { plans: any[]; onClose: () => void; onSuccess: () => void }) {
  const [step,    setStep]    = useState(1);
  const [saving,  setSaving]  = useState(false);
  const [slugOk,  setSlugOk]  = useState<boolean | null>(null);
  const [checking,setChecking]= useState(false);
  const [result,  setResult]  = useState<any>(null);
  const [form, setForm] = useState({
    schoolName: "", slug: "", adminEmail: "", adminFirstName: "",
    adminLastName: "", adminPassword: "", contactPhone: "",
    planId: plans[0]?.id ?? "", region: "IN", currency: "INR",
    maxStudents: "500", trialDays: "30", sessionName: "",
  });

  const f = (k: string) => (e: React.ChangeEvent<any>) => {
    setForm(p => ({ ...p, [k]: e.target.value }));
    if (k === "slug") { setSlugOk(null); }
  };

  // Auto-generate slug from school name
  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const checkSlug = async () => {
    if (!form.slug) return;
    setChecking(true);
    try {
      const res = await api.get<{ available: boolean }>(`/onboarding/check-slug/${form.slug}`);
      setSlugOk(res.available);
    } catch { setSlugOk(false); }
    finally { setChecking(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post<any>("/onboarding/tenant", {
        ...form,
        maxStudents: parseInt(form.maxStudents),
        trialDays:   parseInt(form.trialDays),
      });
      setResult(res);
      setStep(3);
      onSuccess();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Onboard New School</h2>
            <p className="text-slate-400 text-sm mt-0.5">
              {step === 1 ? "School details" : step === 2 ? "Subscription & setup" : "Done!"}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Steps indicator */}
            <div className="flex items-center gap-2">
              {[1, 2].map(n => (
                <div key={n} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step > n ? "bg-emerald-500 text-white" :
                  step === n ? "bg-orange-500 text-white" :
                  "bg-slate-700 text-slate-400"
                }`}>{step > n ? "✓" : n}</div>
              ))}
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-xl">✕</button>
          </div>
        </div>

        <div className="px-6 py-6">
          {/* Step 3 — Success */}
          {step === 3 && result && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">School Onboarded!</h3>
              <p className="text-slate-400 text-sm mb-6">{result.message}</p>
              <div className="bg-slate-800 rounded-xl p-5 text-left space-y-3 mb-6">
                <Row label="School Name" value={result.name} />
                <Row label="School ID"   value={result.slug} mono />
                <Row label="Admin Email" value={result.adminEmail} />
                <Row label="Plan"        value={result.plan} />
                <Row label="Session"     value={result.sessionName} />
                {result.trialEndsAt && <Row label="Trial ends" value={new Date(result.trialEndsAt).toLocaleDateString()} />}
                <Row label="Login URL"   value={result.loginUrl} mono />
              </div>
              <button onClick={onClose}
                className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors">
                Done
              </button>
            </div>
          )}

          {/* Step 1 — School Details */}
          {step === 1 && (
            <form onSubmit={e => { e.preventDefault(); if (slugOk !== false) setStep(2); }} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">School Name *</label>
                <input type="text" required value={form.schoolName}
                  onChange={e => { f("schoolName")(e); setForm(p => ({ ...p, slug: autoSlug(e.target.value) })); setSlugOk(null); }}
                  placeholder="Greenwood International School"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-600" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">School ID (slug) *</label>
                <div className="flex gap-2">
                  <input type="text" required value={form.slug} onChange={f("slug")}
                    placeholder="greenwood-school"
                    className={`flex-1 px-4 py-3 bg-slate-800 border rounded-xl text-slate-200 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-600 ${
                      slugOk === true ? "border-emerald-500" : slugOk === false ? "border-red-500" : "border-slate-700"
                    }`} />
                  <button type="button" onClick={checkSlug} disabled={checking || !form.slug}
                    className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm disabled:opacity-50 transition-colors whitespace-nowrap">
                    {checking ? "..." : "Check"}
                  </button>
                </div>
                {slugOk === true  && <p className="text-emerald-400 text-xs mt-1.5 flex items-center gap-1"><CheckCircle className="w-3 h-3"/>Available</p>}
                {slugOk === false && <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1"><XCircle className="w-3 h-3"/>Already taken — try another</p>}
                <p className="text-slate-500 text-xs mt-1">Lowercase, letters, numbers, hyphens only. Cannot be changed later.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Admin First Name *</label>
                  <input type="text" required value={form.adminFirstName} onChange={f("adminFirstName")}
                    placeholder="Ravi"
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-600" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Admin Last Name *</label>
                  <input type="text" required value={form.adminLastName} onChange={f("adminLastName")}
                    placeholder="Kumar"
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-600" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Admin Email *</label>
                <input type="email" required value={form.adminEmail} onChange={f("adminEmail")}
                  placeholder="admin@greenwood.edu.in"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-600" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Admin Password *</label>
                <input type="password" required value={form.adminPassword} onChange={f("adminPassword")}
                  placeholder="Min 8 chars"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-600" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Contact Phone *</label>
                <input type="text" required value={form.contactPhone} onChange={f("contactPhone")}
                  placeholder="+919876543210"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-600" />
              </div>

              <div className="flex justify-end pt-2">
                <button type="submit" disabled={slugOk === false}
                  className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors">
                  Next: Subscription →
                </button>
              </div>
            </form>
          )}

          {/* Step 2 — Subscription */}
          {step === 2 && (
            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Pricing Plan *</label>
                <select value={form.planId} onChange={f("planId")}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-orange-500">
                  {plans.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.tier} ({p.model}) {p.baseFee ? `₹${p.baseFee}/mo` : ""} {p.perStudentRate ? `₹${p.perStudentRate}/student` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Region</label>
                  <select value={form.region} onChange={f("region")}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-orange-500">
                    {["IN","US","EU","UK","GLOBAL"].map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Currency</label>
                  <select value={form.currency} onChange={f("currency")}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-orange-500">
                    {["INR","USD","GBP","EUR"].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Max Students</label>
                  <input type="number" value={form.maxStudents} onChange={f("maxStudents")}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-orange-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Trial Days</label>
                  <input type="number" value={form.trialDays} onChange={f("trialDays")} min="0" max="365"
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-orange-500" />
                  <p className="text-slate-500 text-xs mt-1">Set 0 to activate immediately</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Academic Session</label>
                  <input type="text" value={form.sessionName} onChange={f("sessionName")}
                    placeholder={`${new Date().getFullYear()}-${(new Date().getFullYear()+1).toString().slice(2)}`}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-600" />
                  <p className="text-slate-500 text-xs mt-1">Leave blank to auto-generate</p>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button type="button" onClick={() => setStep(1)}
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors">
                  ← Back
                </button>
                <button type="submit" disabled={saving}
                  className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors flex items-center gap-2">
                  {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {saving ? "Onboarding..." : "Onboard School ✓"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-sm text-slate-200 ${mono ? "font-mono text-orange-400" : "font-medium"}`}>{value}</span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function TenantsPage() {
  const router = useRouter();
  const [search,      setSearch]      = useState("");
  const [status,      setStatus]      = useState("");
  const [page,        setPage]        = useState(1);
  const [showOnboard, setShowOnboard] = useState(false);

  const { data: plansData } = useApi<any[]>("/onboarding/plans");
  const plans = Array.isArray(plansData) ? plansData : [];

  const url = `/onboarding/tenants?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ""}${status ? `&status=${status}` : ""}`;
  const { data, loading, refetch } = useApi<any>(url, [page, search, status]);

  const tenants = data?.data ?? [];
  const meta    = data?.meta;

  return (
    <div>
      <PageHeader
        title="Schools"
        subtitle={meta ? `${meta.total} schools on the platform` : "All tenant schools"}
        action={
          <button onClick={() => setShowOnboard(true)}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Onboard School
          </button>
        }
      />

      {/* Onboard modal */}
      {showOnboard && (
        <OnboardModal
          plans={plans}
          onClose={() => setShowOnboard(false)}
          onSuccess={() => { setShowOnboard(false); refetch(); }}
        />
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="text" placeholder="Search schools…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-900 border border-slate-700 text-slate-200 rounded-lg focus:outline-none focus:border-orange-500 placeholder-slate-500" />
        </div>
        {["", "TRIAL", "ACTIVE", "SUSPENDED", "CANCELLED"].map(s => (
          <button key={s} onClick={() => { setStatus(s); setPage(1); }}
            className={`px-3 py-2 text-xs rounded-lg border font-medium transition-colors ${
              status === s
                ? "bg-orange-500/10 border-orange-500 text-orange-400"
                : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600"
            }`}>
            {s || "All"}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              {["School","Contact","Status","Plan","Students","Trial ends","Actions"].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {loading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i}>{[...Array(7)].map((_, j) => (
                  <td key={j} className="px-5 py-4"><div className="h-4 bg-slate-800 rounded animate-pulse"/></td>
                ))}</tr>
              ))
            ) : tenants.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-16 text-center text-slate-500">
                No schools found.
                <button onClick={() => setShowOnboard(true)} className="text-orange-400 hover:text-orange-300 ml-2">Onboard one →</button>
              </td></tr>
            ) : tenants.map((t: any) => (
              <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-5 py-3.5">
                  <p className="font-medium text-slate-200">{t.name}</p>
                  <p className="text-xs font-mono text-slate-500">{t.slug}</p>
                </td>
                <td className="px-5 py-3.5">
                  <p className="text-xs text-orange-400">{t.contactEmail}</p>
                  {t.contactPhone && <p className="text-xs text-slate-500 mt-0.5">{t.contactPhone}</p>}
                </td>
                <td className="px-5 py-3.5">
                  <Badge label={t.status} variant={statusVariant(t.status)} />
                </td>
                <td className="px-5 py-3.5">
                  <Badge label={t.subscription?.plan?.tier ?? "—"} variant={tierVariant(t.subscription?.plan?.tier ?? "")} />
                  <p className="text-xs text-slate-500 mt-0.5">{t.subscription?.plan?.name}</p>
                </td>
                <td className="px-5 py-3.5 text-slate-400">{t._count?.students ?? 0}</td>
                <td className="px-5 py-3.5 text-xs text-slate-400">
                  {t.subscription?.trialEndsAt ? (
                    <span className={
                      new Date(t.subscription.trialEndsAt) < new Date() ? "text-red-400" :
                      (new Date(t.subscription.trialEndsAt).getTime() - Date.now()) < 7*86400000 ? "text-amber-400" :
                      "text-slate-400"
                    }>{formatDate(t.subscription.trialEndsAt)}</span>
                  ) : "—"}
                </td>
                <td className="px-5 py-3.5">
                  <button onClick={() => router.push(`/dashboard/tenants/${t.id}`)}
                    className="text-xs text-orange-400 hover:text-orange-300 font-medium transition-colors">
                    View →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && meta.lastPage > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-slate-500">
            Showing {((meta.page - 1) * meta.limit) + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg disabled:opacity-40 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage(p => Math.min(meta.lastPage, p + 1))} disabled={page === meta.lastPage}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg disabled:opacity-40 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
