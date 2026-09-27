"use client";

import { useState } from "react";
import { UserPlus, X, ChevronRight, ArrowRight, UserCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { useAdmissions, useAdmissionStats } from "@/lib/hooks";
import AdmissionForm from "@/components/admission/AdmissionForm";
import { apiClient } from "@/lib/api";

export default function AdmissionsCRM() {
  const [showForm, setShowForm] = useState(false);
  const { data: list, refetch, loading } = useAdmissions();
  const { data: stats, loading: sLoad } = useAdmissionStats();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [convertTarget, setConvertTarget] = useState<any | null>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [convertForm, setConvertForm] = useState({ sectionId: "", rollNumber: "" });
  const [actionError, setActionError] = useState("");

  const mergedList = Array.isArray(list) ? list : [];
  const mergedStats = stats ?? {
    total: 0,
    byStatus: {},
    conversionRate: 0,
  };

  const nextStatus: Record<string, string> = {
    INQUIRY: "UNDER_REVIEW",
    UNDER_REVIEW: "DOCUMENT_UPLOAD",
    DOCUMENT_UPLOAD: "VERIFICATION",
    VERIFICATION: "FEE_DEPOSIT",
  };

  const advance = async (admission: any) => {
    const toStatus = nextStatus[admission.status];
    if (!toStatus) return;
    setBusyId(admission.id);
    setActionError("");
    try {
      await apiClient.post(`/admissions/${admission.id}/transition`, { toStatus });
      await refetch();
    } catch (error: any) {
      setActionError(error?.response?.data?.message ?? "Could not update admission status.");
    } finally {
      setBusyId(null);
    }
  };

  const openConversion = async (admission: any) => {
    setBusyId(admission.id);
    setActionError("");
    try {
      const response = await apiClient.get(`/academics/sections?classId=${admission.applyingClassId}`);
      setSections(Array.isArray(response.data) ? response.data : []);
      setConvertTarget(admission);
      setConvertForm({ sectionId: "", rollNumber: "" });
    } catch (error: any) {
      setActionError(error?.response?.data?.message ?? "Could not load sections.");
    } finally {
      setBusyId(null);
    }
  };

  const convert = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!convertTarget) return;
    setBusyId(convertTarget.id);
    setActionError("");
    try {
      await apiClient.post(`/admissions/${convertTarget.id}/convert`, convertForm);
      setConvertTarget(null);
      await refetch();
    } catch (error: any) {
      setActionError(error?.response?.data?.message ?? "Could not enroll student.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-6 space-y-8 bg-[#F8FAFC] min-h-screen">
      
      {/* 🚀 7-Step Master Form Drawer */}
      {showForm && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex justify-end animate-in fade-in">
          <div className="w-full max-w-5xl bg-white h-full shadow-2xl relative animate-in slide-in-from-right-10 duration-500 overflow-hidden flex flex-col">
            <button 
              onClick={() => setShowForm(false)} 
              className="absolute top-6 right-6 p-3 bg-white rounded-full shadow-lg hover:rotate-90 transition-all z-[110]"
            >
              <X size={24} />
            </button>
            <AdmissionForm onComplete={() => { setShowForm(false); refetch(); }} />
          </div>
        </div>
      )}

      {convertTarget && (
        <div className="fixed inset-0 z-[120] bg-slate-900/60 flex items-center justify-center p-6">
          <form onSubmit={convert} className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-slate-900">Enroll {convertTarget.firstName} {convertTarget.lastName}</h2>
              <button type="button" onClick={() => setConvertTarget(null)}><X size={18} /></button>
            </div>
            <p className="text-xs text-slate-500">Select the section and assign the student a roll number.</p>
            <select required value={convertForm.sectionId} onChange={e => setConvertForm(p => ({ ...p, sectionId: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Select section</option>
              {sections.map(section => <option key={section.id} value={section.id}>{section.name}</option>)}
            </select>
            <input required value={convertForm.rollNumber} onChange={e => setConvertForm(p => ({ ...p, rollNumber: e.target.value }))} placeholder="Roll number" className="w-full border rounded-lg px-3 py-2 text-sm" />
            {actionError && <p className="text-sm text-red-600">{actionError}</p>}
            <button disabled={busyId === convertTarget.id} className="w-full bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-bold disabled:opacity-50">
              {busyId === convertTarget.id ? "Enrolling..." : "Create student"}
            </button>
          </form>
        </div>
      )}

      {/* 🔝 Header Section */}
      <PageHeader
        title="Admissions CRM"
        subtitle="Manage school inquiries & leads"
        action={
          <button 
            onClick={() => setShowForm(true)} 
            className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl hover:bg-indigo-700 transition-all active:scale-95"
          >
            <UserPlus size={18} /> New Inquiry
          </button>
        }
      />
      {actionError && !convertTarget && <div className="bg-red-50 text-red-700 border border-red-100 rounded-xl px-4 py-3 text-sm">{actionError}</div>}

      {/* 📊 Stats Section */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Total Leads" value={mergedStats.total ?? 0} color="blue" loading={sLoad} />
        <StatCard label="Inquiries" value={mergedStats.byStatus?.INQUIRY ?? mergedStats.byStatus?.SCREENING ?? 0} color="purple" loading={sLoad} />
        <StatCard label="Waitlisted" value={mergedStats.byStatus?.WAITLISTED ?? 0} color="amber" loading={sLoad} />
        <StatCard label="Conversion" value={`${mergedStats.conversionRate ?? 0}%`} color="green" loading={sLoad} />
      </div>

      {/* 📋 CRM Listing Table */}
      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100">
              {["Student Details", "Contact", "Class", "Status", "Action"].map((h) => (
                <th key={h} className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={5} className="py-20 text-center animate-pulse font-black text-slate-300 uppercase tracking-widest">Loading Leads...</td></tr>
            ) : mergedList.length === 0 ? (
              <tr><td colSpan={5} className="py-20 text-center text-slate-300 font-black uppercase text-xs tracking-[0.3em]">No Inquiries Found</td></tr>
            ) : (
              mergedList.map((adm: any) => (
                <tr key={adm.id} className="hover:bg-indigo-50/30 transition-all group cursor-pointer">
                  <td className="px-8 py-5">
                    <p className="font-black text-slate-800 text-sm">{adm.firstName} {adm.lastName}</p>
                    <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Ref: {adm.applicationNo || 'DRAFT'}</p>
                  </td>
                  <td className="px-8 py-5 text-xs font-bold text-slate-500">{adm.phone}</td>
                  <td className="px-8 py-5">
                    <span className="px-4 py-2 bg-slate-100 rounded-xl text-[10px] font-black uppercase text-slate-500 tracking-tighter">
                      Class {adm.applyingForClass}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest ${
                      adm.status === 'SCREENING' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                    }`}>
                      {adm.status}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      {nextStatus[adm.status] && (
                        <button onClick={() => advance(adm)} disabled={busyId === adm.id} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold disabled:opacity-50">
                          <ArrowRight size={13} /> {busyId === adm.id ? "Saving" : "Advance"}
                        </button>
                      )}
                      {adm.status === "FEE_DEPOSIT" && !adm.enrolledStudentId && (
                        <button onClick={() => openConversion(adm)} disabled={busyId === adm.id} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-100 text-emerald-700 text-[10px] font-bold disabled:opacity-50">
                          <UserCheck size={13} /> Enroll
                        </button>
                      )}
                      <ChevronRight size={18} className="text-slate-300 group-hover:text-indigo-600" />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
