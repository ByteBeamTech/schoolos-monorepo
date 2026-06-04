"use client";

import React, { useState, useEffect, useRef } from "react";
import { Check, Layers, Layout, Calendar, Eye, Activity, X } from "lucide-react";
import { TYPE_CONFIG_MAP, CalendarEventType, EventScope, AudienceType, CalendarFormState, AUDIENCE_OPTIONS, AcademicCalendarEvent } from "./types";

interface ClassOption {
  id: string;
  name: string;
}

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CalendarFormState) => Promise<void>;
  classes: ClassOption[];
  initialEvent: AcademicCalendarEvent | null; 
  fallbackDate?: string;
}

interface InternalFormState {
  title: string;
  description: string;
  type: CalendarEventType;
  scope: EventScope;
  audience: AudienceType;
  startDate: string;
  endDate: string;
  isPublished: boolean;
  blocksAttendance: boolean;
  isWorkingDay: boolean;
  color: string;
}

const DEFAULT_TYPE: CalendarEventType = "SCHOOL_HOLIDAY";

const HOLIDAY_TYPES = [
  "NATIONAL_HOLIDAY",
  "REGIONAL_HOLIDAY",
  "SCHOOL_HOLIDAY"
] as const;

const getFormDefaults = (targetDate = ""): InternalFormState => {
  const meta = TYPE_CONFIG_MAP[DEFAULT_TYPE];
  return {
    title: "",
    description: "",
    type: DEFAULT_TYPE,
    scope: "ALL_SCHOOL",
    audience: "BOTH",
    startDate: targetDate,
    endDate: targetDate,
    isPublished: false,
    blocksAttendance: true,
    isWorkingDay: false,
    color: meta?.defaultColor || "#ea580c"
  };
};

export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  classes,
  initialEvent,
  fallbackDate = "",
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [backedUpTargetsMemory, setBackedUpTargetsMemory] = useState<string[]>([]);
  
  const firstInputRef = useRef<HTMLInputElement>(null);
  const modalHeadingId = initialEvent ? `event-modal-${initialEvent.id}` : "event-modal-create";

  const [form, setForm] = useState<InternalFormState>(() => getFormDefaults(fallbackDate));

  // Edit hydration framework tracking stream layer
  useEffect(() => {
    if (!isOpen) return;

    if (initialEvent) {
      const extractedTargets = initialEvent.targets?.map((t) => t.classId).filter(Boolean) as string[] ?? [];
      setForm({
        title: initialEvent.title,
        description: initialEvent.description || "",
        type: initialEvent.type,
        scope: initialEvent.scope,
        audience: initialEvent.audience,
        startDate: initialEvent.startDate.split('T')[0],
        endDate: initialEvent.endDate.split('T')[0],
        isPublished: initialEvent.isPublished,
        blocksAttendance: initialEvent.blocksAttendance,
        isWorkingDay: initialEvent.isWorkingDay,
        color: initialEvent.color || TYPE_CONFIG_MAP[initialEvent.type]?.defaultColor || ""
      });
      setSelectedTargets(extractedTargets);
      setBackedUpTargetsMemory(extractedTargets);
    } else {
      setForm(getFormDefaults(fallbackDate));
      setSelectedTargets([]);
      setBackedUpTargetsMemory([]);
    }
    
    setSubmitAttempted(false);
    const timer = setTimeout(() => firstInputRef.current?.focus(), 30);
    return () => clearTimeout(timer);
  }, [isOpen, initialEvent, fallbackDate]);

  // View viewport scroll management locking
  useEffect(() => {
    if (!isOpen) return;
    const originalStyle = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [isOpen]);

  // Keydown escape layout hook dismiss parameters
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose, submitting]);

  // Keep type changes rules automated sync active
  useEffect(() => {
    if (initialEvent) return;

    const defaultMeta = TYPE_CONFIG_MAP[form.type];
    if (defaultMeta) {
      const isHoliday = (HOLIDAY_TYPES as readonly string[]).includes(form.type);
      setForm(prev => {
        if (prev.color === defaultMeta.defaultColor && prev.blocksAttendance === isHoliday && prev.isWorkingDay === !isHoliday) {
          return prev;
        }
        return {
          ...prev,
          color: defaultMeta.defaultColor,
          blocksAttendance: isHoliday,
          isWorkingDay: !isHoliday
        };
      });
    }
  }, [form.type, initialEvent]);

  // Derived calculations matrix pass
  const dateValidationError = form.startDate && form.endDate && new Date(form.endDate) < new Date(form.startDate)
    ? "End date cannot be before start date."
    : null;

  const targetValidationError = form.scope === 'CLASS' && selectedTargets.length === 0
    ? "Please select at least one class."
    : null;

  const updateField = <K extends keyof InternalFormState>(field: K, value: InternalFormState[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  /**
   * ⚡ Fix 3 & 4: Airtight target preservation logic
   * Keeps class selection safely cached in backedUpTargetsMemory when switching scopes.
   */
  const handleScopeSwitchTrigger = (newScope: EventScope) => {
    if (form.scope === "CLASS" && newScope !== "CLASS" && selectedTargets.length > 0) {
      const confirmed = window.confirm("Changing scope will remove your selected classes. Continue?");
      if (!confirmed) return; // Prevent dropdown toggle kalesh
      
      setSelectedTargets([]);
    }
    
    if (newScope === "CLASS" && selectedTargets.length === 0 && backedUpTargetsMemory.length > 0) {
      setSelectedTargets(backedUpTargetsMemory);
    }
    
    updateField("scope", newScope);
  };

  if (!isOpen) return null;

  const handleFormSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    
    if (submitting || dateValidationError || targetValidationError) return;

    setSubmitting(true);
    try {
      await onSubmit({
        title: form.title,
        description: form.description,
        type: form.type,
        scope: form.scope,
        audience: form.audience,
        startDate: form.startDate,
        endDate: form.endDate,
        isPublished: form.isPublished,
        isWorkingDay: form.isWorkingDay,
        blocksAttendance: form.blocksAttendance,
        color: form.color || undefined,
        targets:
  form.scope === 'CLASS'
    ? selectedTargets.map((id) => ({
        classId: id,
      }))
    : []
      });
    } catch (error) {
      console.error("Failed to save calendar event:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const isHolidayType = (HOLIDAY_TYPES as readonly string[]).includes(form.type);

  return (
    <div 
      onClick={() => !submitting && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby={modalHeadingId}
      className={`fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150 font-sans transition-all ${submitting ? "cursor-wait opacity-95" : ""}`}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 max-w-md w-full overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
      >
        
        {/* Header Title Panel Controls Grid */}
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[9px] flex justify-between items-center bg-slate-50/40 dark:bg-slate-800/20">
          <h3 id={modalHeadingId} className="flex items-center gap-1.5 font-mono">
            <Layout className="w-3.5 h-3.5 text-slate-400" /> {initialEvent ? "Modify Calendar Event" : "Create Calendar Event"}
          </h3>
          <button 
            type="button" 
            disabled={submitting}
            onClick={onClose} 
            aria-label="Close dialog"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-3xs transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Dynamic Fields Node Streaming Box Layout */}
        <form onSubmit={handleFormSubmission} className="p-5 overflow-y-auto space-y-5 text-xs font-bold divide-y divide-slate-100 dark:divide-slate-800/60 leading-none">
          
          {/* SECTION I: GENERAL DATA BLOCK */}
          <div className="space-y-3 pt-0">
            <span className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">1. General Information</span>
            <input 
              ref={firstInputRef}
              type="text" required placeholder="Enter event title *" 
              className="w-full px-3.5 py-2.5 border rounded-xl dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-slate-400 font-bold" 
              value={form.title} onChange={e => updateField("title", e.target.value)} 
            />
            <textarea 
              rows={2} placeholder="Description (optional details)..." 
              className="w-full px-3.5 py-2.5 border rounded-xl font-medium dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400 leading-normal text-slate-600 dark:text-slate-300" 
              value={form.description} onChange={e => updateField("description", e.target.value)} 
            />
          </div>

          {/* SECTION II: TIMELINE SCHEDULING LIMITS */}
          <div className="space-y-3 pt-4">
            <span className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-slate-400" /> 2. Schedule Duration</span>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[9px] text-slate-400 dark:text-slate-500 mb-1.5 uppercase font-mono">Start Date</label>
                <input type="date" required className="w-full px-3 py-2.5 border rounded-xl font-mono bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none" value={form.startDate} onChange={e => updateField("startDate", e.target.value)} />
              </div>
              <div>
                <label className="block text-[9px] text-slate-400 dark:text-slate-500 mb-1.5 uppercase font-mono">End Date</label>
                <input type="date" required className="w-full px-3 py-2.5 border rounded-xl font-mono bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none" value={form.endDate} onChange={e => updateField("endDate", e.target.value)} />
              </div>
            </div>
            {submitAttempted && dateValidationError && (
              <p className="text-[10px] text-rose-600 dark:text-rose-400 font-medium leading-normal animate-pulse">{dateValidationError}</p>
            )}
          </div>

          {/* SECTION III: TYPE & SCOPING CONTROLS (⚡ Fix 1 & 2: Reverted dropdown back to V1 safe routes & corrected visibility label to Event Scope) */}
          <div className="space-y-3 pt-4">
            <span className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1"><Eye className="w-3.5 h-3.5 text-slate-400" /> 3. Event Type & Scope</span>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[9px] text-slate-400 dark:text-slate-500 mb-1.5 uppercase">Event Type</label>
                <select className="w-full px-3 py-2.5 border rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:outline-none font-bold text-slate-800 dark:text-slate-200" value={form.type} onChange={e => updateField("type", e.target.value as CalendarEventType)}>
                  {Object.keys(TYPE_CONFIG_MAP).map(t => <option key={t} value={t}>{TYPE_CONFIG_MAP[t as CalendarEventType]?.label ?? t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[9px] text-slate-400 dark:text-slate-500 mb-1.5 uppercase">Event Scope</label>
                {/* ⚡ Reverted Option A: Removed unimplemented fields to prevent backend validation breaks */}
                <select 
                  className="w-full px-3 py-2.5 border rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:outline-none font-bold text-slate-800 dark:text-slate-200" 
                  value={form.scope} 
                  onChange={e => handleScopeSwitchTrigger(e.target.value as EventScope)}
                >
                  <option value="ALL_SCHOOL">Whole School</option>
                  <option value="CLASS">Selected Classes</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[9px] text-slate-400 dark:text-slate-500 mb-1.5 uppercase">Target Audience</label>
              <select className="w-full px-3 py-2.5 border rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:outline-none font-bold text-slate-800 dark:text-slate-200" value={form.audience} onChange={e => updateField("audience", e.target.value as AudienceType)}>
                {AUDIENCE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          </div>

          {/* SECTION IV: CLASS MAPPING CHIPS SELECTORS GRID */}
          {form.scope === 'CLASS' && (
            <div className="space-y-2 pt-4 animate-in slide-in-from-top-2 duration-200">
              <span className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1"><Layers className="w-3 h-3 text-blue-500" /> 4. Select Target Classes</span>
              <div className="p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/30 dark:bg-slate-950/20 max-h-32 overflow-y-auto grid grid-cols-2 gap-2 shadow-inner scrollbar-none">
                {classes && classes.length > 0 ? (
                  classes.map(c => {
                    const isActive = selectedTargets.includes(c.id);
                    return (
                      <button 
                        type="button" 
                        key={c.id} 
                        onClick={() => {
                          const nextTargets = selectedTargets.includes(c.id) ? selectedTargets.filter(id => id !== c.id) : [...selectedTargets, c.id];
                          setSelectedTargets(nextTargets);
                          setBackedUpTargetsMemory(nextTargets);
                        }}
                        className={`p-2.5 rounded-xl border text-left font-bold text-xs flex justify-between items-center transition-all ${isActive ? "bg-slate-900 border-slate-900 text-white dark:bg-slate-100 dark:border-slate-100 dark:text-slate-900 shadow-3xs scale-[0.98]" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-400 text-slate-700 dark:text-slate-300 hover:border-slate-400"}`}
                      >
                        <span className="truncate flex-1 pr-1">{c.name}</span>
                        {isActive && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                      </button>
                    );
                  })
                ) : (
                  <p className="col-span-2 text-slate-400 font-normal py-4 text-center italic">No classes available.</p>
                )}
              </div>
              {submitAttempted && targetValidationError && (
                <p className="text-[10px] text-rose-600 dark:text-rose-400 font-medium leading-normal mt-1">{targetValidationError}</p>
              )}
            </div>
          )}

          {/* SECTION V: BEHAVIOURAL CONTROLS AUTOMATION SETTINGS */}
          <div className="space-y-4 pt-4">
            <span className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1"><Activity className="w-3.5 h-3.5 text-slate-400" /> 5. Attendance Settings & Styles</span>
            <div className="grid grid-cols-1 gap-2.5 bg-slate-50/50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 shadow-3xs">
              <label className={`flex items-center justify-between cursor-pointer select-none group/toggle ${isHolidayType ? "opacity-60 pointer-events-none" : ""}`}>
                <div className="flex flex-col gap-0.5">
                  <span className="text-slate-800 dark:text-slate-200">Block Attendance</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal leading-tight">Disables student attendance registers for these dates</span>
                </div>
                <input type="checkbox" disabled={isHolidayType} checked={form.blocksAttendance} onChange={e => updateField("blocksAttendance", e.target.checked)} className="rounded text-slate-900 border-slate-300 focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer" />
              </label>

              <label className={`flex items-center justify-between cursor-pointer select-none border-t border-slate-200/60 dark:border-slate-700/60 pt-2.5 group/toggle ${isHolidayType ? "opacity-60 pointer-events-none" : ""}`}>
                <div className="flex flex-col gap-0.5">
                  <span className="text-slate-800 dark:text-slate-200">Is School Working Day</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal leading-tight">Mark dates active for regular academic activities calendar</span>
                </div>
                <input type="checkbox" disabled={isHolidayType} checked={form.isWorkingDay} onChange={e => updateField("isWorkingDay", e.target.checked)} className="rounded text-slate-900 border-slate-300 focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer" />
              </label>

              <div className={`flex items-center justify-between border-t border-slate-200/60 dark:border-slate-700/60 pt-2.5 ${isHolidayType ? "opacity-40 pointer-events-none" : ""}`}>
                <div className="flex flex-col gap-0.5">
                  <span className="text-slate-800 dark:text-slate-200">Custom Event Color</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal leading-tight">Apply custom color tags badge visual style override</span>
                </div>
                <input type="color" disabled={isHolidayType} className="w-8 h-6 rounded-md border border-slate-200 dark:border-slate-700 cursor-pointer p-0 bg-transparent" value={form.color} onChange={e => updateField("color", e.target.value)} />
              </div>
            </div>

            <label className="flex items-center gap-2 py-1 select-none cursor-pointer group/publish">
              <input type="checkbox" checked={form.isPublished} onChange={e => updateField("isPublished", e.target.checked)} className="rounded text-slate-900 border-slate-300 focus:ring-0 w-4 h-4" />
              <span className="text-slate-600 dark:text-slate-400 group-hover/publish:text-slate-800 dark:group-hover/publish:text-slate-200 transition-colors">Publish event immediately to Parent Portal and Mobile Apps</span>
            </label>
          </div>

          {/* ACTION BUTTONS FOOTER CONTROLS PANEL */}
          <div className="flex justify-end gap-2 pt-4 border-t bg-slate-50/50 dark:bg-slate-800/10 -mx-5 -mb-5 p-5">
            <button type="button" disabled={submitting} onClick={onClose} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-bold uppercase transition-colors rounded-xl">Cancel</button>
            <button type="submit" disabled={submitting} className="px-5 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-bold uppercase tracking-wider shadow-md min-w-[130px] text-center">
              {submitting ? "Saving..." : initialEvent ? "Update Event" : "Create Event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
