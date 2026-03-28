"use client";
import { useState }       from "react";
import { Calendar }       from "lucide-react";
import { PageHeader }     from "@/components/ui/page-header";
import { useClasses, useTimetable, useApi } from "@/lib/hooks";

const DAYS   = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HOURS  = ["08:00","08:45","09:30","10:15","11:00","11:45","12:30","13:15","14:00","14:45"];
const COLORS = ["bg-blue-100 text-blue-800","bg-emerald-100 text-emerald-800","bg-purple-100 text-purple-800",
                 "bg-amber-100 text-amber-800","bg-rose-100 text-rose-800","bg-cyan-100 text-cyan-800",
                 "bg-orange-100 text-orange-800","bg-indigo-100 text-indigo-800"];

export default function TimetablePage() {
  const [sectionId, setSectionId] = useState("");
  const [sessionId, setSessionId] = useState("");

  const { data: sessions } = useApi<any[]>("/academic-sessions");
  const currentSession     = sessions?.find((s: any) => s.isCurrent) ?? sessions?.[0];
  const activeSession      = sessionId || currentSession?.id || "";

  const { data: classes }    = useClasses(activeSession);
  const { data: timetable, loading } = useTimetable(sectionId);

  const allSections = classes?.flatMap((c: any) =>
    (c.sections ?? []).map((s: any) => ({ ...s, className: c.name }))
  ) ?? [];

  // Map subjectId → color index for consistent coloring
  const subjectColorMap = new Map<string, number>();
  let colorIdx = 0;
  timetable?.days.forEach(d => d.slots.forEach(s => {
    if (!subjectColorMap.has(s.subjectId)) subjectColorMap.set(s.subjectId, colorIdx++ % COLORS.length);
  }));

  // Build a slot lookup: [dayOfWeek][periodNumber] → slot
  const slotMap = new Map<string, any>();
  timetable?.days.forEach(d =>
    d.slots.forEach(s => slotMap.set(`${s.dayOfWeek}-${s.periodNumber}`, s))
  );

  const maxPeriod = timetable
    ? Math.max(...timetable.days.flatMap(d => d.slots.map(s => s.periodNumber)), 0)
    : 0;

  return (
    <div>
      <PageHeader title="Timetable" subtitle="Weekly class schedule" />

      {/* Section selector */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Session</label>
            <select
              value={activeSession}
              onChange={(e) => setSessionId(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select session</option>
              {sessions?.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}{s.isCurrent ? " (Current)" : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Section</label>
            <select
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-16 text-center">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Select a section to view its timetable</p>
        </div>
      ) : loading ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8">
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />)}
          </div>
        </div>
      ) : !timetable || timetable.totalSlots === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-16 text-center">
          <p className="text-slate-500 font-medium">No timetable configured for this section</p>
          <p className="text-slate-400 text-sm mt-1">Add slots via the API or Swagger UI</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 font-semibold text-slate-500 w-24">Period</th>
                  {DAYS.map(d => (
                    <th key={d} className="text-center px-3 py-3 font-semibold text-slate-600 min-w-[110px]">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {[...Array(Math.max(maxPeriod, 8))].map((_, i) => {
                  const period = i + 1;
                  return (
                    <tr key={period} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 text-slate-400 font-medium">
                        <div>P{period}</div>
                        <div className="text-[10px] text-slate-300">{HOURS[i] ?? ""}</div>
                      </td>
                      {[1,2,3,4,5,6].map(day => {
                        const slot = slotMap.get(`${day}-${period}`);
                        const colorClass = slot ? COLORS[subjectColorMap.get(slot.subjectId) ?? 0] : "";
                        return (
                          <td key={day} className="px-2 py-2 text-center">
                            {slot ? (
                              <div className={`rounded-lg px-2 py-1.5 ${colorClass}`}>
                                <p className="font-semibold truncate">{slot.subjectId.substring(0, 8)}</p>
                                <p className="text-[10px] opacity-70">{slot.startTime}–{slot.endTime}</p>
                              </div>
                            ) : (
                              <div className="text-slate-200">—</div>
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
          <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
            {timetable.totalSlots} slots configured · {allSections.find(s => s.id === sectionId)?.className} {allSections.find(s => s.id === sectionId)?.name}
          </div>
        </div>
      )}
    </div>
  );
}
