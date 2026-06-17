"use client";

import { useState, useEffect } from "react";
import { Calendar, Loader2, Save, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { apiClient } from "@/lib/api"; 
import {
  useClasses,
  useTimetable,
  useApi,
  useStaff,
  useSubjects,
} from "@/lib/hooks";

const DAYS   = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HOURS  = ["08:00","08:45","09:30","10:15","11:00","11:45","12:30","13:15","14:00","14:45"];

const COLORS = [
  "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", 
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300", 
  "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", 
  "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300", 
  "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300", 
  "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300"
];

const PERIOD_TIMES: Record<number, { start: string; end: string }> = {
  1: { start: "08:00", end: "08:45" },
  2: { start: "08:45", end: "09:30" },
  3: { start: "09:30", end: "10:15" },
  4: { start: "10:15", end: "11:00" },
  5: { start: "11:00", end: "11:45" },
  6: { start: "11:45", end: "12:30" },
  7: { start: "12:30", end: "13:15" },
  8: { start: "13:15", end: "14:00" },
  9: { start: "14:00", end: "14:45" },
  10: { start: "14:45", end: "15:30" },
};

export default function TimetablePage() {
  const [sectionId, setSectionId] = useState("");
  const [sessionId, setSessionId] = useState("");

  const { data: sessions } = useApi<any[]>("/academic-sessions");
  const currentSession     = sessions?.find((s: any) => s.isCurrent) ?? sessions?.[0];
  const activeSession      = sessionId || currentSession?.id || "";

  const { data: classes }  = useClasses(activeSession);
  const { data: staff }    = useStaff(); 
  const { data: subjects } = useSubjects();
  
  const { data: timetable, loading, refetch } = useTimetable(sectionId);

  const [editMode, setEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [grid, setGrid] = useState<Record<string, { subjectId: string; teacherId: string }>>({});

  const allSections = classes?.flatMap((c: any) =>
    (c.sections ?? []).map((s: any) => ({ ...s, className: c.name }))
  ) ?? [];

  const subjectMap = new Map(subjects?.map((s: any) => [s.id, s.name]));

  const subjectColorMap = new Map<string, number>();
  let colorIdx = 0;
  timetable?.days?.forEach((d: any) => d.slots.forEach((s: any) => {
    if (!subjectColorMap.has(s.subjectId)) {
      subjectColorMap.set(s.subjectId, colorIdx++ % COLORS.length);
    }
  }));

  const slotMap = new Map<string, any>();
  timetable?.days?.forEach((d: any) =>
    d.slots.forEach((s: any) => slotMap.set(`${s.dayOfWeek}-${s.periodNumber}`, s))
  );

  const maxPeriod = timetable?.days
    ? Math.max(...timetable.days.flatMap((d: any) => d.slots.map((s: any) => s.periodNumber)), 0)
    : 0;

  useEffect(() => {
    if (!timetable?.days) return;
    const initialGrid: Record<string, any> = {};
    timetable.days.forEach((d: any) => {
      d.slots.forEach((s: any) => {
        initialGrid[`${s.dayOfWeek}-${s.periodNumber}`] = {
          subjectId: s.subjectId,
          teacherId: s.teacherId,
        };
      });
    });
    setGrid(initialGrid);
  }, [timetable, editMode]);

  const updateSlot = (day: number, period: number, field: "subjectId" | "teacherId", value: string) => {
    setGrid((prev) => ({
      ...prev,
      [`${day}-${period}`]: {
        ...prev[`${day}-${period}`],
        [field]: value,
      },
    }));
  };

  const saveTimetable = async () => {
    try {
      setIsSaving(true);
      const slots = Object.entries(grid)
        .filter(([_, v]) => v?.subjectId && v?.teacherId)
        .map(([key, value]) => {
          const [day, period] = key.split("-");
          
          return {
            subjectId: value.subjectId,
            teacherId: value.teacherId,
            dayOfWeek: Number(day),
            periodNumber: Number(period),
            startTime: PERIOD_TIMES[Number(period)]?.start || "00:00",
            endTime: PERIOD_TIMES[Number(period)]?.end || "00:00",
          };
        });

      await apiClient.put(`/timetable/section/${sectionId}`, {
        slots,
      });

      setEditMode(false);
      if (refetch) await refetch(); 
      
    } catch (err: any) {
      console.error("Failed to save timetable:", err);
      alert(err?.response?.data?.message ?? "Failed to save timetable. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="text-slate-900 dark:text-slate-100">
      <PageHeader title="Timetable" subtitle="Weekly class schedule" />

      {/* Section selector */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 mb-6 transition-colors">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Session</label>
            <select
              value={activeSession}
              onChange={(e) => setSessionId(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100 transition-colors"
            >
              <option value="">Select session</option>
              {sessions?.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}{s.isCurrent ? " (Current)" : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Section</label>
            <select
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              disabled={editMode}
              className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100 disabled:opacity-50 transition-colors"
            >
              <option value="">Select section</option>
              {allSections.map((s: any) => (
                <option key={s.id} value={s.id}>{s.className} — {s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!sectionId ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-12 sm:p-16 text-center transition-colors">
          <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Select a section to view its timetable</p>
        </div>
      ) : loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-8 transition-colors">
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />)}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-semibold text-slate-700 dark:text-slate-200">
              {allSections.find(s => s.id === sectionId)?.className} {allSections.find(s => s.id === sectionId)?.name}
            </h3>
            
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <button
                onClick={() => setEditMode(!editMode)}
                disabled={isSaving}
                className="flex-1 sm:flex-none flex justify-center items-center gap-2 px-4 py-2 text-sm font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors disabled:opacity-50"
              >
                {editMode ? <X className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
                {editMode ? "Cancel" : "Edit Timetable"}
              </button>

              {editMode && (
                <button
                  onClick={saveTimetable}
                  disabled={isSaving}
                  className="flex-1 sm:flex-none flex justify-center items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto overflow-y-hidden pb-2 webkit-scrolling-touch">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                  <th className="text-left px-4 py-3 font-semibold text-slate-500 dark:text-slate-400 w-24">Period</th>
                  {DAYS.map(d => (
                    <th key={d} className="text-center px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 min-w-[150px]">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {[...Array(Math.max(maxPeriod, 8))].map((_, i) => {
                  const period = i + 1;
                  return (
                    <tr key={period} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-2.5 text-slate-400 dark:text-slate-500 font-medium">
                        <div>P{period}</div>
                        <div className="text-[10px] text-slate-300 dark:text-slate-600">{HOURS[i] ?? ""}</div>
                      </td>
                      {[1, 2, 3, 4, 5, 6].map((day) => {
                        const slotKey = `${day}-${period}`;
                        const slot = slotMap.get(slotKey);
                        const colorClass = slot ? COLORS[subjectColorMap.get(slot.subjectId) ?? 0] : "";
                        
                        return (
                          <td key={day} className="px-2 py-2 text-center align-top">
                            {editMode ? (
                              <div className="space-y-1.5">
                                <select
                                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded text-xs p-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-200"
                                  value={grid[slotKey]?.subjectId || ""}
                                  onChange={(e) => updateSlot(day, period, "subjectId", e.target.value)}
                                >
                                  <option value="">Subject</option>
                                  {subjects?.map((s: any) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                  ))}
                                </select>

                                <select
                                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded text-xs p-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-200"
                                  value={grid[slotKey]?.teacherId || ""}
                                  onChange={(e) => updateSlot(day, period, "teacherId", e.target.value)}
                                >
                                  <option value="">Teacher</option>
                                  {staff?.map((t: any) => (
                                    <option key={t.id} value={t.id}>
                                      {t.user?.firstName} {t.user?.lastName}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : slot ? (
                              <div className={`rounded-lg px-2 py-1.5 ${colorClass} h-full flex flex-col justify-center border border-transparent dark:border-slate-700/50 transition-colors`}>
                                <p className="font-semibold truncate">
                                  {subjectMap.get(slot.subjectId) || slot.subjectId}
                                </p>
                                <p className="text-[10px] opacity-70 mt-0.5">{slot.startTime}–{slot.endTime}</p>
                              </div>
                            ) : (
                              <div className="text-slate-200 dark:text-slate-700 py-2">—</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 transition-colors">
            {timetable?.totalSlots || 0} slots configured
          </div>
        </div>
      )}
    </div>
  );
}
