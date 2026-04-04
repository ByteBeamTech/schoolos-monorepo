"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  User, Users, HeartPulse, GraduationCap, ShieldCheck, 
  UploadCloud, ChevronRight, ChevronLeft, SkipForward, Link2 
} from "lucide-react";

// --- 🛡️ Validation Schema ---
const schema = z.object({
  fullName: z.string().min(3, "Name is required"),
  targetClass: z.string().min(1, "Class is required"),
  dob: z.string().min(1, "DOB is required"),
  gender: z.string().min(1, "Required"),
  phone: z.string().length(10, "10 digit phone required"),
  religion: z.string().min(1, "Required"),
  category: z.string().min(1, "Required"),
  siblingId: z.string().optional(),
  staffId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function AdmissionForm({ onComplete }: { onComplete?: () => void }) {
  const [step, setStep] = useState(1);
  const [appId, setAppId] = useState("");

  const { register, handleSubmit, formState: { errors }, trigger, watch } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: "onChange"
  });

  // --- 🛠️ Functions ---
  const handleNext = async () => {
    const fields: any = step === 1 
      ? ["fullName", "targetClass", "phone"] 
      : step === 2 
      ? ["dob", "gender", "religion", "category"] 
      : [];
    
    const isValid = await trigger(fields);
    if (isValid) {
      if (step === 1 && !appId) setAppId(`APP-26-${Math.floor(1000 + Math.random() * 9000)}`);
      setStep(s => Math.min(s + 1, 7));
    }
  };

  const onSubmit = (data: FormData) => {
    console.log("Pushing to SchoolOS CRM...", data);
    if (onComplete) onComplete();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full bg-[#F8FAFC] font-sans">
      
      {/* 🎫 Sleek App ID Header */}
      {appId && (
        <div className="mx-6 mt-4 bg-slate-900 rounded-2xl p-4 flex justify-between items-center text-white shadow-lg">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60">Ref ID: {appId}</p>
          <span className="text-[9px] font-black uppercase bg-indigo-600 px-3 py-1 rounded-lg">Step {step}/7</span>
        </div>
      )}

      {/* 👣 Progress Stepper */}
      <div className="px-8 py-4 flex gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7].map(s => (
          <div key={s} className={`h-1 flex-1 rounded-full transition-all ${step >= s ? "bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.4)]" : "bg-slate-200"}`} />
        ))}
      </div>

      {/* 🧩 Form Body */}
      <div className="flex-1 px-6 pb-4 overflow-y-auto">
        <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm min-h-[420px]">
          
          {step === 1 && (
            <div className="space-y-5 animate-in slide-in-from-right-4">
              <H title="Primary Information" icon={<User size={18} />} />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label="Student Full Name *" name="fullName" register={register} error={errors.fullName} placeholder="Legal Name" />
                <Select label="Target Class *" name="targetClass" register={register} options={["Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]} error={errors.targetClass} />
                <Input label="Parent Phone *" name="phone" register={register} error={errors.phone} placeholder="10 Digits" />
              </div>
              <div className="p-4 bg-indigo-50/50 rounded-2xl border-2 border-dashed border-indigo-100 grid grid-cols-2 gap-4">
                <Input label="Sibling ID" name="siblingId" register={register} placeholder="SCH-XXX" icon={<Link2 size={14} />} />
                <Input label="Staff ID" name="staffId" register={register} placeholder="STF-XXX" icon={<Users size={14} />} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5 animate-in slide-in-from-right-4">
              <H title="Personal Profile" icon={<ShieldCheck size={18} />} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Date of Birth *" name="dob" type="date" register={register} error={errors.dob} />
                <Select label="Gender *" name="gender" register={register} options={["Male", "Female", "Other"]} error={errors.gender} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select label="Religion *" name="religion" register={register} options={["Hindu", "Muslim", "Sikh", "Christian", "Other"]} error={errors.religion} />
                <Select label="Category *" name="category" register={register} options={["General", "OBC", "SC", "ST"]} error={errors.category} />
              </div>
            </div>
          )}

          {[3, 4, 5, 6].includes(step) && (
            <div className="py-16 text-center space-y-4 animate-in zoom-in-95">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto border text-indigo-500 shadow-sm">
                {step === 3 ? <Users size={24} /> : step === 4 ? <UploadCloud size={24} /> : step === 5 ? <HeartPulse size={24} /> : <GraduationCap size={24} />}
              </div>
              <h4 className="font-black text-slate-800 uppercase italic text-sm">Step {step}: {["Family", "Vault", "Health", "Academic"][step-3]}</h4>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Optional for Inquiry Stage</p>
            </div>
          )}

          {step === 7 && (
            <div className="py-12 text-center space-y-4 animate-in zoom-in-95">
              <ShieldCheck size={48} className="text-green-500 mx-auto" />
              <h2 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter">Review & Confirm</h2>
              <div className="p-4 bg-slate-50 rounded-2xl inline-block border border-slate-100">
                <p className="text-[9px] font-black text-slate-400 uppercase">Student Name</p>
                <p className="font-black text-indigo-600">{watch("fullName") || "N/A"}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 🔘 Navigation Footer */}
      <div className="p-5 border-t bg-white flex justify-between items-center sticky bottom-0">
        <button type="button" onClick={() => setStep(s => Math.max(s - 1, 1))} disabled={step === 1} className="text-slate-400 font-black uppercase text-[9px] tracking-widest disabled:opacity-0 hover:text-slate-900 transition-all">
          <ChevronLeft size={14} className="inline mr-1" /> Prev
        </button>
        <div className="flex gap-2">
          {step > 2 && step < 7 && (
            <button type="button" onClick={() => setStep(s => s + 1)} className="text-indigo-400 font-black uppercase text-[9px] tracking-widest px-5 py-3 rounded-xl border border-indigo-50">
              Skip Block
            </button>
          )}
          <button 
            type="button" 
            onClick={step === 7 ? handleSubmit(onSubmit) : handleNext} 
            className="bg-indigo-600 text-white font-black uppercase text-[10px] tracking-widest px-8 py-3.5 rounded-xl shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2"
          >
            {step === 7 ? "Confirm Inquiry" : "Next Step"} <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <style jsx>{`
        .input-field { width: 100%; height: 2.75rem; padding: 0 1rem; border-radius: 0.75rem; background-color: #F8FAFC; border: 1.5px solid transparent; font-weight: 700; font-size: 0.8rem; color: #334155; outline: none; transition: 0.2s; }
        .input-field:focus { background-color: white; border-color: #6366F1; box-shadow: 0 4px 12px rgba(99,102,241,0.08); }
        .label-style { text-transform: uppercase; font-size: 9px; font-weight: 800; color: #94A3B8; letter-spacing: 0.1em; margin-bottom: 2px; display: block; margin-left: 2px; }
      `}</style>
    </form>
  );
}

// --- 🛠️ UI Helpers ---
const H = ({ title, icon }: any) => (
  <div className="flex items-center gap-2 border-b border-slate-50 pb-3 mb-3">
    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">{icon}</div>
    <h3 className="text-sm font-black text-slate-800 uppercase italic tracking-tight">{title}</h3>
  </div>
);

const Input = ({ label, register, name, error, icon, ...props }: any) => (
  <div className="w-full space-y-0.5">
    <label className="label-style">{label}</label>
    <div className="relative">
      <input {...(register ? register(name) : {})} {...props} className={`input-field ${icon ? 'pl-9' : ''}`} />
      {icon && <div className="absolute left-3 top-3 text-slate-400">{icon}</div>}
    </div>
    {error && <p className="text-[8px] text-red-500 font-bold uppercase ml-1 mt-1">{error.message}</p>}
  </div>
);

const Select = ({ label, options, register, name, error }: any) => (
  <div className="w-full space-y-0.5">
    <label className="label-style">{label}</label>
    <select {...register(name)} className="input-field appearance-none">
      <option value="">Choose...</option>
      {options.map((o: any) => <option key={o} value={o}>{o}</option>)}
    </select>
    {error && <p className="text-[8px] text-red-500 font-bold uppercase ml-1 mt-1">{error.message}</p>}
  </div>
);
