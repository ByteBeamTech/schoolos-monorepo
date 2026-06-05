"use client";
// superadmin/src/app/(platform)/dashboard/impersonate/page.tsx
// FULL REPLACEMENT
// FIX: was calling GET /tenants?limit=200 — endpoint is /onboarding/tenants
// FIX: tenantList derived from tenants?.data — correct for paginated response shape

import { useState }  from "react";
import { useApi }    from "@/lib/hooks";
import { api }       from "@/lib/api";
import { KeyRound, ExternalLink, AlertTriangle, Search } from "lucide-react";

export default function ImpersonatePage() {
  // FIX: was "/tenants?limit=200&status=ACTIVE" → 404
  // Correct path is /onboarding/tenants (same route, confirmed in OnboardingController)
  const { data: tenants } = useApi<any>("/onboarding/tenants?limit=200&status=ACTIVE");

  const [selectedTenant, setSelectedTenant] = useState("");
  const [reason,         setReason]         = useState("");
  const [search,         setSearch]         = useState("");
  const [loading,        setLoading]        = useState(false);
  const [result,         setResult]         = useState<any>(null);

  // paginated response: { data: Tenant[], total, page, limit }
  const tenantList: any[] = tenants?.data ?? [];

  // client-side filter so the SA can type to narrow down quickly
  const filtered = search.trim()
    ? tenantList.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.slug.toLowerCase().includes(search.toLowerCase())
      )
    : tenantList;

  const doImpersonate = async () => {
    if (!selectedTenant) { alert("Select a tenant"); return; }
    if (!reason.trim())  { alert("Reason is required — it's logged in audit trail"); return; }
    if (!confirm(
      `You will log in as the SCHOOL_ADMIN of the selected school.\n\nReason: ${reason}\n\nThis action is logged. Continue?`
    )) return;

    setLoading(true);
    try {
      // FIX: this route was missing from SuperadminController — now added in fix1
      const res = await api.post(`/superadmin/impersonate/${selectedTenant}`, { reason });
      setResult(res as any);
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">Shadow Login</h1>
        <p className="text-slate-400 text-sm mt-1">
          Log into any school's dashboard as their admin. Every session is logged.
        </p>
      </div>

      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-300">Impersonation is fully audited</p>
          <p className="text-xs text-amber-500 mt-0.5">
            Every session is logged in the tenant's audit trail with your identity, reason, and timestamp.
            The session expires in 30 minutes automatically.
          </p>
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 max-w-lg">
        <div className="space-y-4">

          {/* School search + select */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Target school *
            </label>
            {/* Search box to filter the dropdown */}
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search schools…"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-4 py-2 text-slate-200 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-600"
              />
            </div>
            <select
              value={selectedTenant}
              onChange={e => setSelectedTenant(e.target.value)}
              size={5}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 text-sm focus:outline-none focus:border-orange-500"
            >
              <option value="">— select school —</option>
              {filtered.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.slug})
                </option>
              ))}
            </select>
            {tenantList.length === 0 && (
              <p className="text-xs text-slate-600 mt-1">Loading schools…</p>
            )}
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Reason (required, logged in audit) *
            </label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Support ticket #1234 — billing issue investigation"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-600"
            />
          </div>

          <button
            onClick={doImpersonate}
            disabled={loading || !selectedTenant || !reason.trim()}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg font-medium disabled:opacity-40 transition-colors"
          >
            <KeyRound className="w-4 h-4" />
            {loading ? "Generating session…" : "Generate 30-min session"}
          </button>
        </div>

        {/* Result panel */}
        {result && (
          <div className="mt-5 bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4">
            <p className="text-sm font-semibold text-emerald-400 mb-3">✓ Session created</p>
            <div className="space-y-1.5 text-xs text-slate-300">
              <p><span className="text-slate-500">School:</span> {result.tenantSlug}</p>
              <p><span className="text-slate-500">Logging in as:</span> {result.userEmail}</p>
              <p><span className="text-slate-500">Expires:</span> {result.expiresInMin} minutes</p>
            </div>
            <a
              href={result.frontendUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 flex items-center gap-2 text-xs text-orange-400 hover:text-orange-300 font-medium transition-colors"
            >
              Open school dashboard <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
