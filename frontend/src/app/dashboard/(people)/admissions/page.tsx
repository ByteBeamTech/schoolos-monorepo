"use client";

import { useState } from "react";
import { UserPlus, X, Search, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { useAdmissions, useAdmissionStats } from "@/lib/hooks";
import AdmissionForm from "@/components/admission/AdmissionForm";

export default function AdmissionsCRM() {
  const [showForm, setShowForm] = useState(false);
  const { data: list, refetch, loading } = useAdmissions();
  const { data: stats, loading: sLoad } = useAdmissionStats();

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

      {/* 📊 Stats Section */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Total Leads" value={stats?.total ?? 0} color="blue" loading={sLoad} />
        <StatCard label="Screening" value={stats?.byStatus?.SCREENING ?? 0} color="purple" loading={sLoad} />
        <StatCard label="Waitlisted" value={stats?.byStatus?.WAITLISTED ?? 0} color="amber" loading={sLoad} />
        <StatCard label="Conversion" value={`${stats?.conversionRate ?? 0}%`} color="green" loading={sLoad} />
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
            ) : list?.length === 0 ? (
              <tr><td colSpan={5} className="py-20 text-center text-slate-300 font-black uppercase text-xs tracking-[0.3em]">No Inquiries Found</td></tr>
            ) : (
              list?.map((adm: any) => (
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
                    <button className="p-2 hover:bg-white rounded-lg transition-all text-slate-300 group-hover:text-indigo-600">
                      <ChevronRight size={18} />
                    </button>
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
