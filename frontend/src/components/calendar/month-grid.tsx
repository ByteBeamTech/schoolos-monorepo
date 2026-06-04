"use client";

import React, { useMemo } from "react";
// ⚡ Fix: Removed missing fields 'CalendarDay' & 'CALENDAR_WEEK_DAYS' to align exactly with types.tsx contract
import { AcademicCalendarEvent, TYPE_CONFIG_MAP, getEventColor } from "./types";
import { Plus, EyeOff } from "lucide-react";

interface MonthGridProps {
  year: number;
  month: number;
  events: AcademicCalendarEvent[];
  onEventClick: (event: AcademicCalendarEvent) => void;
  onQuickAdd: (isoDateString: string) => void;
  onDayClick?: (isoDateString: string) => void;
}

const WEEKDAYS_LABELS_MAP = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const MonthGrid: React.FC<MonthGridProps> = ({
  year,
  month,
  events,
  onEventClick,
  onQuickAdd,
  onDayClick
}) => {
  
  const gridCellsCalculationsMatrix = useMemo(() => {
    const firstDayIndexOffset = new Date(year, month - 1, 1).getDay();
    const totalDaysInCurrentMonth = new Date(year, month, 0).getDate();
    const totalDaysInPriorMonth = new Date(year, month - 1, 0).getDate();

    const calculatedCells: {
      dateString: string;
      dayNumber: number;
      isCurrentMonth: boolean;
    }[] = [];

    // Prior month padding cells
    for (let i = firstDayIndexOffset - 1; i >= 0; i--) {
      const priorDayNum = totalDaysInPriorMonth - i;
      const targetMonthStr = month === 1 ? "12" : String(month - 1).padStart(2, "0");
      const targetYearStr = month === 1 ? String(year - 1) : String(year);
      
      calculatedCells.push({
        dateString: `${targetYearStr}-${targetMonthStr}-${String(priorDayNum).padStart(2, "0")}`,
        dayNumber: priorDayNum,
        isCurrentMonth: false
      });
    }

    // Current month cells
    for (let day = 1; day <= totalDaysInCurrentMonth; day++) {
      const activeMonthStr = String(month).padStart(2, "0");
      calculatedCells.push({
        dateString: `${year}-${activeMonthStr}-${String(day).padStart(2, "0")}`,
        dayNumber: day,
        isCurrentMonth: true
      });
    }

    // Future month padding slots
    const remainingGridPaddingSlots = (7 - (calculatedCells.length % 7)) % 7;
    for (let nextDay = 1; nextDay <= remainingGridPaddingSlots; nextDay++) {
      const targetMonthStr = month === 12 ? "01" : String(month + 1).padStart(2, "0");
      const targetYearStr = month === 12 ? String(year + 1) : String(year);
      
      calculatedCells.push({
        dateString: `${targetYearStr}-${targetMonthStr}-${String(nextDay).padStart(2, "0")}`,
        dayNumber: nextDay,
        isCurrentMonth: false
      });
    }

    return calculatedCells;
  }, [year, month]);

  const extractEventsMappedToCell = (isoDateString: string) => {
    const activeCellEpoch = new Date(isoDateString).getTime();
    
    return events.filter(ev => {
      const startEpoch = new Date(ev.startDate.split("T")[0]).getTime();
      const endEpoch = new Date(ev.endDate.split("T")[0]).getTime();
      return activeCellEpoch >= startEpoch && activeCellEpoch <= endEpoch;
    });
  };

  const activeCurrentDateMarkerString = useMemo(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  }, []);

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col font-sans select-none animate-in fade-in duration-150">
      
      {/* Weekdays Labels Header */}
      <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-center py-2.5">
        {WEEKDAYS_LABELS_MAP.map((label, index) => (
          <span 
            key={label} 
            className={`text-[10px] uppercase tracking-widest font-mono font-black ${
              index === 0 || index === 6 
                ? "text-slate-400 dark:text-slate-500" 
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Grid Matrix cells */}
      <div className="grid grid-cols-7 bg-slate-100/40 dark:bg-slate-950/20 divide-x divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
        {gridCellsCalculationsMatrix.map((cell, idx) => {
          const matchedCellEvents = extractEventsMappedToCell(cell.dateString);
          const isCellTodayNode = cell.dateString === activeCurrentDateMarkerString;

          return (
            <div
              key={`${cell.dateString}-${idx}`}
              onClick={() => cell.isCurrentMonth && onDayClick?.(cell.dateString)}
              className={`min-h-[105px] p-2 flex flex-col justify-between relative group/cell transition-colors border-t-0 border-l-0 ${
                cell.isCurrentMonth 
                  ? "bg-white dark:bg-slate-900 hover:bg-slate-50/40 dark:hover:bg-slate-800/10 cursor-pointer" 
                  : "bg-slate-50/30 dark:bg-slate-950/10 text-slate-300 dark:text-slate-700 pointer-events-none opacity-45"
              }`}
            >
              <div className="flex justify-between items-center w-full mb-1">
                <span 
                  className={`text-xs font-black p-1.5 min-w-[26px] h-[26px] rounded-lg flex items-center justify-center border transition-all ${
                    isCellTodayNode 
                      ? "bg-blue-600 border-blue-600 text-white shadow-sm font-black scale-105" 
                      : cell.isCurrentMonth
                        ? "text-slate-800 dark:text-slate-200 border-transparent bg-transparent"
                        : "text-slate-300 dark:text-slate-700 border-transparent bg-transparent"
                  }`}
                >
                  {cell.dayNumber}
                </span>

                {cell.isCurrentMonth && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation(); 
                      onQuickAdd(cell.dateString);
                    }}
                    aria-label={`Add event on ${cell.dateString}`}
                    className="p-1 rounded-md opacity-0 group-hover/cell:opacity-100 hover:bg-slate-200 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all shadow-3xs"
                  >
                    <Plus className="w-3 h-3 flex-shrink-0" />
                  </button>
                )}
              </div>

              {/* Event Chips container row */}
              <div className="w-full flex-1 flex flex-col gap-1 overflow-y-auto max-h-[72px] mt-1 pr-0.5 scrollbar-none">
                {matchedCellEvents.map(ev => {
                  const uiCfg = TYPE_CONFIG_MAP[ev.type];
                  const dynamicColorHex = getEventColor(ev);

                  return (
                    <div
                      key={ev.id}
                      onClick={(e) => {
                        e.stopPropagation(); 
                        onEventClick(ev);
                      }}
                      style={{ borderLeft: `3px solid ${dynamicColorHex}` }}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold font-sans tracking-tight truncate transition-all duration-150 transform hover:scale-[0.99] flex items-center justify-between gap-1 shadow-3xs border border-slate-100/50 dark:border-slate-800/50 ${
                        uiCfg?.bg || "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                      title={`${ev.title} (${uiCfg?.label || ev.type})`}
                    >
                      <span className="truncate flex-1 font-black leading-tight">{ev.title}</span>
                      {!ev.isPublished && (
                        <EyeOff className="w-2.5 h-2.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
