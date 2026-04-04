"use client";
/**
 * Payroll — /dashboard/payroll/page.tsx
 *
 * Tab 1: Run Payroll
 * • Select month/year → shows all staff with salary structures
 * • Generate payslips for all or selected staff
 * • Present days override per staff
 * • Approve → Mark Paid workflow
 *
 * Tab 2: Payslips
 * • List all payslips for selected month
 * • Filter by status (Draft/Approved/Paid)
 * • Download individual payslip PDF
 *
 * Tab 3: Salary Structures
 * • List all staff salary structures
 * • Add/edit structure
 */
import { useState, useMemo } from "react";
import { IndianRupee, Plus, CheckCircle, X, Download, Users, FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard }   from "@/components/ui/stat-card";
import { Badge }      from "@/components/ui/badge";
import { useApi, usePayslips, usePayrollStats, usePayrollStructures } from "@/lib/hooks";
import { apiClient }  from "@/lib/api";
import { useToast }   from "@/lib/use-toast";

type Tab = "run" | "payslips" | "structures";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

function fmt(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function statusVariant(s: string) {
  if (s === "PAID")      return "success" as const;
  if (s === "APPROVED") return "info"     as const;
  if (s === "DRAFT")    return "warning" as const;
  return "neutral" as const;
}

export default function PayrollPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("run");

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());

  const { data: payslips,   loading: pLoad, refetch: refetchPayslips }   = usePayslips(month, year);
  const { data: stats,      loading: sLoad, refetch: refetchStats }       = usePayrollStats(month, year);
  const { data: structures, loading: strLoad, refetch: refetchStructures } = usePayrollStructures();
  const { data: staff }     = useApi<any[]>("/staff");

  // Run payroll state
  const [selected,      setSelected]      = useState<Set<string>>(new Set());
  const [presentDays,   setPresentDays]   = useState<Record<string, string>>({});
  const [generating,    setGenerating]    = useState(false);
  const [approving,     setApproving]     = useState<string | null>(null);
  const [markingPaid,   setMarkingPaid]   = useState<string | null>(null);
  const [downloading,   setDownloading]   = useState<string | null>(null);

  // Structure form
  const [showStructForm, setShowStructForm] = useState(false);
  const [structSaving,   setStructSaving]   = useState(false);
  const [structForm, setStructForm] = useState({
    staffId: "", basicSalary: "", hra: "", da: "", ta: "",
    otherAllowances: "", pfEmployee: "", esi: "", tds: "", effectiveFrom: "",
  });

  // Staff that don't yet have a payslip this month
  const staffWithoutPayslip = useMemo(() => {
    if (!structures || !payslips) return structures ?? [];
    const generated = new Set(payslips.map((p: any) => p.staffId));
    return (structures ?? []).filter((s: any) => !generated.has(s.staffId));
  }, [structures, payslips]);

  const toggleSelect = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () =>
    setSelected(prev => prev.size === staffWithoutPayslip.length ? new Set() : new Set(staffWithoutPayslip.map((s: any) => s.staffId)));

  const generatePayslips = async () => {
    const toGenerate = selected.size > 0
      ? staffWithoutPayslip.filter((s: any) => selected.has(s.staffId))
      : staffWithoutPayslip;

    if (!toGenerate.length) { toast.error("No staff to generate payslips for"); return; }
    setGenerating(true);
    try {
      let done = 0, skipped = 0;
      for (const s of toGenerate) {
        try {
          await apiClient.post("/payroll/payslips/generate", {
            staffId: s.staffId,
            month, year,
            presentDays: presentDays[s.staffId] ? parseInt(presentDays[s.staffId]) : undefined,
          });
          done++;
        } catch { skipped++; }
      }
      toast.success(`Generated ${done} payslips${skipped ? `, ${skipped} skipped` : ""}`);
      refetchPayslips(); refetchStats(); setSelected(new Set());
    } catch (err: any) {
      toast.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const approve = async (id: string) => {
    setApproving(id);
    try {
      await apiClient.patch(`/payroll/payslips/${id}/approve`, {});
      toast.success("Payslip approved");
      refetchPayslips(); refetchStats();
    } catch (err: any) { toast.error(err); }
    finally { setApproving(null); }
  };

  const markPaid = async (id: string) => {
    setMarkingPaid(id);
    try {
      await apiClient.patch(`/payroll/payslips/${id}/mark-paid`, {});
      toast.success("Payslip marked as paid");
      refetchPayslips(); refetchStats();
    } catch (err: any) { toast.error(err); }
    finally { setMarkingPaid(null); }
  };

  const downloadPayslip = async (id: string, staffName: string) => {
    setDownloading(id);
    try {
      const res = await apiClient.get(`/payroll/payslips/${id}/pdf`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a"); a.href = url;
      a.download = `payslip-${staffName}-${MONTHS[month-1]}-${year}.pdf`;
      a.click(); window.URL.revokeObjectURL(url);
    } catch (err: any) { toast.error(err); }
    finally { setDownloading(null); }
  };

  const saveStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    setStructSaving(true);
    try {
      const payload = {
        staffId:         structForm.staffId,
        basicSalary:     parseFloat(structForm.basicSalary),
        hra:             parseFloat(structForm.hra)             || 0,
        da:              parseFloat(structForm.da)              || 0,
        ta:              parseFloat(structForm.ta)              || 0,
        otherAllowances: parseFloat(structForm.otherAllowances) || 0,
        pfEmployee:      parseFloat(structForm.pfEmployee)      || 0,
        esi:             parseFloat(structForm.esi)             || 0,
        tds:             parseFloat(structForm.tds)             || 0,
        effectiveFrom:   structForm.effectiveFrom,
      };
      await apiClient.post("/payroll/structures", payload);
      toast.success("Salary structure saved");
      setShowStructForm(false);
      setStructForm({ staffId:"",basicSalary:"",hra:"",da:"",ta:"",otherAllowances:"",pfEmployee:"",esi:"",tds:"",effectiveFrom:"" });
      refetchStructures();
    } catch (err: any) { toast.error(err); }
    finally { setStructSaving(false); }
  };

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div>
      <PageHeader title="Payroll" subtitle={`${MONTHS[month-1]} ${year} — Salary management`} />

      {/* Month/Year picker */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select value={month} onChange={e => setMonth(+e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          {MONTHS.map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(+e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Stats - FIXED MAPPING FOR 0404 VERSION */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Staff"   value={(stats as any)?.total ?? 0}                   icon={<Users className="w-5 h-5"/>}        color="blue"   loading={sLoad}/>
        <StatCard label="Generated"     value={(stats as any)?.draft ?? 0}                   icon={<FileText className="w-5 h-5"/>}      color="purple" loading={sLoad}/>
        <StatCard label="Approved"      value={(stats as any)?.paid ?? 0}                    icon={<CheckCircle className="w-5 h-5"/>}  color="green"  loading={sLoad}/>
        <StatCard label="Net Payout"    value={fmt((stats as any)?.totalNet ?? 0)}           icon={<IndianRupee className="w-5 h-5"/>}  color="amber"  loading={sLoad}/>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 mb-5">
        {(["run","payslips","structures"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {t === "run" ? "Run Payroll" : t === "payslips" ? "Payslips" : "Salary Structures"}
          </button>
        ))}
      </div>

      {/* ── TAB: RUN PAYROLL ────────────────────────────────────────────────── */}
      {tab === "run" && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <p className="text-sm font-semibold text-slate-800">{MONTHS[month-1]} {year} — Pending generation</p>
              <p className="text-xs text-slate-400 mt-0.5">{staffWithoutPayslip.length} staff without payslips this month</p>
            </div>
            <div className="flex gap-2">
              <button onClick={toggleAll} className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
                {selected.size === staffWithoutPayslip.length ? "Deselect All" : "Select All"}
              </button>
              <button onClick={generatePayslips} disabled={generating || !staffWithoutPayslip.length}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors">
                {generating && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
                {generating ? "Generating…" : `Generate ${selected.size > 0 ? selected.size : "All"} Payslips`}
              </button>
            </div>
          </div>
          {strLoad ? (
            <div className="p-6 space-y-3">{[...Array(5)].map((_,i) => <div key={i} className="h-12 bg-slate-100 rounded animate-pulse"/>)}</div>
          ) : staffWithoutPayslip.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3"/>
              <p className="text-slate-600 font-medium">All payslips generated for {MONTHS[month-1]} {year}</p>
              <p className="text-slate-400 text-sm mt-1">Switch to the Payslips tab to approve and mark as paid.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-3 w-8"><input type="checkbox" checked={selected.size === staffWithoutPayslip.length && staffWithoutPayslip.length > 0} onChange={toggleAll} className="rounded"/></th>
                  {["Staff Member","Basic","HRA","DA","Gross","Deductions","Net","Present Days"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {staffWithoutPayslip.map((s: any) => {
                  const gross = [s.basicSalary, s.hra, s.da, s.ta, s.otherAllowances].reduce((a, v) => a + Number(v || 0), 0);
                  const deds  = [s.pfEmployee, s.esi, s.tds].reduce((a, v) => a + Number(v || 0), 0);
                  const net   = gross - deds;
                  const staffMember = (staff ?? []).find((st: any) => st.id === s.staffId);
                  return (
                    <tr key={s.id} className={`hover:bg-slate-50 transition-colors ${selected.has(s.staffId) ? "bg-blue-50/40" : ""}`}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selected.has(s.staffId)} onChange={() => toggleSelect(s.staffId)} className="rounded"/>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900 text-xs">
                          {staffMember?.user?.firstName ?? "—"} {staffMember?.user?.lastName ?? ""}
                        </p>
                        <p className="text-slate-400 text-[10px]">{staffMember?.employeeId ?? s.staffId.slice(0, 8)}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{fmt(Number(s.basicSalary))}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{fmt(Number(s.hra))}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{fmt(Number(s.da))}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800 text-xs">{fmt(gross)}</td>
                      <td className="px-4 py-3 text-red-500 text-xs">-{fmt(deds)}</td>
                      <td className="px-4 py-3 font-bold text-emerald-600 text-sm">{fmt(net)}</td>
                      <td className="px-4 py-3">
                        <input type="number" min="0" max="31"
                          placeholder="26"
                          value={presentDays[s.staffId] ?? ""}
                          onChange={e => setPresentDays(p => ({ ...p, [s.staffId]: e.target.value }))}
                          className="w-16 px-2 py-1 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── TAB: PAYSLIPS ───────────────────────────────────────────────────── */}
      {tab === "payslips" && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          {pLoad ? (
            <div className="p-6 space-y-3">{[...Array(6)].map((_,i) => <div key={i} className="h-12 bg-slate-100 rounded animate-pulse"/>)}</div>
          ) : !payslips?.length ? (
            <div className="p-12 text-center text-slate-400 text-sm">No payslips generated for {MONTHS[month-1]} {year}.<br/>Go to the Run Payroll tab to generate them.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {["Staff","Present/Working","Gross","Deductions","Net","Status","Actions"].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(payslips ?? []).map((p: any) => {
                  const staffMember = (staff ?? []).find((s: any) => s.id === p.staffId);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-900">{staffMember?.user?.firstName ?? "—"} {staffMember?.user?.lastName ?? ""}</p>
                        <p className="text-xs text-slate-400">{staffMember?.designation ?? staffMember?.employeeId ?? ""}</p>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 text-sm">{p.presentDays}/{p.workingDays}</td>
                      <td className="px-5 py-3.5 text-slate-700 font-medium">{fmt(Number(p.grossSalary))}</td>
                      <td className="px-5 py-3.5 text-red-500">-{fmt(Number(p.pfDeduction) + Number(p.esiDeduction) + Number(p.tdsDeduction))}</td>
                      <td className="px-5 py-3.5 font-bold text-emerald-600">{fmt(Number(p.netSalary))}</td>
                      <td className="px-5 py-3.5"><Badge label={p.status} variant={statusVariant(p.status)}/></td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          {p.status === "DRAFT" && (
                            <button onClick={() => approve(p.id)} disabled={approving === p.id}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50 transition-colors">
                              {approving === p.id ? "…" : "Approve"}
                            </button>
                          )}
                          {p.status === "APPROVED" && (
                            <button onClick={() => markPaid(p.id)} disabled={markingPaid === p.id}
                              className="text-xs text-emerald-600 hover:text-emerald-800 font-medium disabled:opacity-50 transition-colors">
                              {markingPaid === p.id ? "…" : "Mark Paid"}
                            </button>
                          )}
                          <button onClick={() => downloadPayslip(p.id, staffMember?.user?.firstName ?? "staff")} disabled={downloading === p.id}
                            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 font-medium disabled:opacity-50 transition-colors">
                            {downloading === p.id ? <span className="w-3 h-3 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"/> : <Download className="w-3.5 h-3.5"/>}
                            PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── TAB: SALARY STRUCTURES ──────────────────────────────────────────── */}
      {tab === "structures" && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => setShowStructForm(p => !p)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors">
              <Plus className="w-4 h-4"/> Add Structure
            </button>
          </div>

          {showStructForm && (
            <div className="bg-white border border-blue-100 rounded-xl p-5 mb-5 shadow-sm">
              <h3 className="font-semibold text-slate-900 text-sm mb-4">New Salary Structure</h3>
              <form onSubmit={saveStructure} className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Staff Member *</label>
                  <select required value={structForm.staffId} onChange={e => setStructForm(p => ({...p, staffId: e.target.value}))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select staff…</option>
                    {(staff ?? []).map((s: any) => (
                      <option key={s.id} value={s.id}>{s.user?.firstName} {s.user?.lastName} — {s.designation}</option>
                    ))}
                  </select>
                </div>
                {[
                  { l:"Basic Salary *", k:"basicSalary", req:true },
                  { l:"HRA",             k:"hra" },
                  { l:"DA",              k:"da" },
                  { l:"TA",              k:"ta" },
                  { l:"Other Allowances", k:"otherAllowances" },
                  { l:"PF (Employee %)", k:"pfEmployee" },
                  { l:"ESI (%)",         k:"esi" },
                  { l:"TDS (flat ₹)",    k:"tds" },
                ].map(({ l, k, req }) => (
                  <div key={k}>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{l}</label>
                    <input type="number" min="0" required={req} value={(structForm as any)[k]}
                      onChange={e => setStructForm(p => ({...p, [k]: e.target.value}))}
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Effective From *</label>
                  <input type="date" required value={structForm.effectiveFrom}
                    onChange={e => setStructForm(p => ({...p, effectiveFrom: e.target.value}))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                </div>
                <div className="md:col-span-4 flex gap-3 pt-2 border-t border-slate-100">
                  <button type="submit" disabled={structSaving}
                    className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors flex items-center gap-2">
                    {structSaving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
                    {structSaving ? "Saving…" : "Save Structure"}
                  </button>
                  <button type="button" onClick={() => setShowStructForm(false)} className="px-5 py-2 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 transition-colors">Cancel</button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {["Staff","Basic","HRA","DA","TA","Gross","PF","ESI","TDS","Net","Effective"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {strLoad ? (
                  [...Array(5)].map((_,i) => <tr key={i}>{[...Array(11)].map((_,j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse"/></td>)}</tr>)
                ) : !(structures ?? []).length ? (
                  <tr><td colSpan={11} className="px-5 py-12 text-center text-slate-400 text-sm">No salary structures added yet.</td></tr>
                ) : (
                  (structures ?? []).map((s: any) => {
                    const staffMember = (staff ?? []).find((st: any) => st.id === s.staffId);
                    const gross = [s.basicSalary,s.hra,s.da,s.ta,s.otherAllowances].reduce((a,v) => a+Number(v||0),0);
                    const deds  = [s.pfEmployee,s.esi,s.tds].reduce((a,v) => a+Number(v||0),0);
                    return (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900 text-xs">{staffMember?.user?.firstName ?? "—"} {staffMember?.user?.lastName ?? ""}</p>
                          <p className="text-[10px] text-slate-400">{staffMember?.designation ?? ""}</p>
                        </td>
                        {[s.basicSalary,s.hra,s.da,s.ta].map((v,i) => (
                          <td key={i} className="px-4 py-3 text-slate-600 text-xs">{fmt(Number(v))}</td>
                        ))}
                        <td className="px-4 py-3 font-semibold text-slate-800 text-xs">{fmt(gross)}</td>
                        {[s.pfEmployee,s.esi,s.tds].map((v,i) => (
                          <td key={i} className="px-4 py-3 text-slate-500 text-xs">{fmt(Number(v))}</td>
                        ))}
                        <td className="px-4 py-3 font-bold text-emerald-600 text-xs">{fmt(gross - deds)}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{new Date(s.effectiveFrom).toLocaleDateString("en-IN")}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
