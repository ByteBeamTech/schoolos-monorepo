"use client";
import { ChevronLeft, ChevronRight, Calendar, Plus, RefreshCw, Search, Filter, AlertCircle } from "lucide-react";
import { AcademicCalendarEvent, CalendarFormState, CalendarViewMode, CalendarEventType, TYPE_CONFIG_MAP } from "../../../components/calendar/types";
import { MonthGrid } from "../../../components/calendar/month-grid";
import { EventModal } from "../../../components/calendar/event-modal";
import { EventDrawer } from "../../../components/calendar/event-drawer";


import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useToast } from "@/lib/use-toast";
// ⚡ Fix 1: Unified API client import to automate headers, branch intercepts, and tenant tokens injection
import { apiClient } from "@/lib/api";

interface ClassNodeOption {
  id: string;
  name: string;
}

type EventFilter = "ALL" | CalendarEventType;

export default function AcademicCalendarPage() {
  const { toast } = useToast();
  
  // Calendar state
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth() + 1);
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  
  // Loaded records state
  const [eventsList, setEventsList] = useState<AcademicCalendarEvent[]>([]);
  const [classesMatrix, setClassesMatrix] = useState<ClassNodeOption[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  
  // Diagnostics states
  const [isSessionConfigured, setIsSessionConfigured] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<boolean>(false);
  
  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<EventFilter>("ALL");
  
  // Loading status and Concurrency Controls
  const [loadingData, setLoadingData] = useState(false);
  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fallbackCellDate, setFallbackCellDate] = useState<string>("");
  
  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingEventNode, setEditingEventNode] = useState<AcademicCalendarEvent | null>(null);

  // Load calendar data
  const triggerDataLoaderFetch = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    isFetchingRef.current = true;
    setLoadingData(true);
    setLoadError(false); 
    
    try {
      // ⚡ Fix 2: Migrated raw session fetch to structural apiClient layer lala
      // Pass single configurations to interceptors natively if your apiClient handles AxiosRequestConfig bounds
      const sessionData = await apiClient.get("/academic-sessions/current");
      
      const payloadContext = sessionData?.data !== undefined ? sessionData.data : sessionData;
      const currentSessionId = payloadContext?.id;

      if (!currentSessionId) {
        setIsSessionConfigured(false);
        return; 
      }

      setIsSessionConfigured(true);
      setActiveSessionId(currentSessionId);

      // ⚡ Fix 3 & 4: Replaced dangerous raw fetches with bulletproof integrated client routing pass
      const [eventsResponse, classesResponse] = await Promise.all([
        apiClient.get(`/academic-calendar/month?sessionId=${currentSessionId}&year=${currentYear}&month=${currentMonth}`),
        apiClient.get(`/academics/classes?sessionId=${currentSessionId}`)
      ]);

      const compiledEvents = Array.isArray(eventsResponse) ? eventsResponse : (eventsResponse?.data ?? []);
      const compiledClasses = Array.isArray(classesResponse) ? classesResponse : (classesResponse?.data ?? []);

      setEventsList(compiledEvents);
      setClassesMatrix(compiledClasses);
    } catch (error: any) {
      if (error.name === "AbortError" || error.message?.includes("aborted")) {
        console.log("Previous calendar data load request aborted successfully.");
        return;
      }
      
      console.error("Failed to load calendar data:", error);
      
      // Catch 404 block or specific empty records explicitly via network code mapping lala
      if (error.response?.status === 404) {
        setIsSessionConfigured(false);
      } else {
        setLoadError(true);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setLoadingData(false);
        isFetchingRef.current = false;
      }
    }
  }, [currentYear, currentMonth]);

  useEffect(() => {
    triggerDataLoaderFetch();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [triggerDataLoaderFetch]);

  // Filters compute execution pass
  const filteredEventsList = useMemo(() => {
    return eventsList.filter(ev => {
      const normQuery = searchQuery.toLowerCase();
      const matchesSearch = ev.title.toLowerCase().includes(normQuery) || 
                            (ev.description && ev.description.toLowerCase().includes(normQuery)) ||
                            ev.type.toLowerCase().includes(normQuery);
      
      const matchesType = selectedTypeFilter === "ALL" || ev.type === selectedTypeFilter;
      
      return matchesSearch && matchesType;
    });
  }, [eventsList, searchQuery, selectedTypeFilter]);

  // Month navigation
  const handleNavigatePriorMonth = () => {
    if (currentMonth === 1) {
      setCurrentYear(y => y - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth(m => m - 1);
    }
  };

  const handleNavigateNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentYear(y => y + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  };

  const handleTriggerQuickAddShortcut = (isoDateString: string) => {
    setEditingEventNode(null); 
    setFallbackCellDate(isoDateString);
    setIsModalOpen(true);
  };

  const handleTriggerEventInspection = (eventNode: AcademicCalendarEvent) => {
    setEditingEventNode(eventNode);
    setIsDrawerOpen(true);
  };

  // Commit form actions
  const handleModalFormSubmitCommit = async (formData: CalendarFormState) => {
    if (!activeSessionId) return;

    try {
      const payloadDto = { ...formData, sessionId: activeSessionId };

      // ⚡ Fix 5: Discarded response parsing boilerplate and leveraged clean programmatical mutations methods loops
      if (editingEventNode) {
        await apiClient.patch(`/academic-calendar/${editingEventNode.id}`, payloadDto);
      } else {
        await apiClient.post("/academic-calendar", payloadDto);
      }

      toast.success(editingEventNode ? "Event updated successfully." : "Event created successfully.");
      setIsModalOpen(false);
      setEditingEventNode(null);
      triggerDataLoaderFetch();
    } catch (error) {
      console.error("Failed to save calendar event:", error);
      toast.error("Failed to save calendar entry changes.");
      throw error;
    }
  };

  // Status adjustments mapping
  const handleExecuteDrawerStateMutation = async (
    eventId: string, 
    actionEndpoint: "publish" | "unpublish" | "delete"
  ) => {
    try {
      // ⚡ Fix 6: Seamless endpoint selection using apiClient's implicit error propagation routing engine
      if (actionEndpoint === "delete") {
        await apiClient.delete(`/academic-calendar/${eventId}`);
      }
      
      if (actionEndpoint === "publish") {
        await apiClient.patch(`/academic-calendar/${eventId}/publish`);
      }
      
      if (actionEndpoint === "unpublish") {
        await apiClient.patch(`/academic-calendar/${eventId}/unpublish`);
      }
      
      toast.success(
        actionEndpoint === "delete" ? "Event deleted permanently." : 
        actionEndpoint === "publish" ? "Event published live." : "Event reverted to draft."
      );
      
      triggerDataLoaderFetch();
    } catch (error) {
      console.error("Failed executing calendar drawer alteration track:", error);
      toast.error("Unable to perform requested action. Please refresh.");
    }
  };

  const resolvedMonthLabelName = new Date(currentYear, currentMonth - 1).toLocaleString("en-US", { month: "long" });

  if (!isSessionConfigured) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center font-sans space-y-4">
        <AlertCircle className="w-12 h-12 text-amber-500 flex-shrink-0" />
        <h3 className="text-base font-black text-slate-900 dark:text-slate-100">No Active Academic Session</h3>
        <p className="text-xs text-slate-500 max-w-sm font-medium leading-normal">
          Please configure or create an active academic session inside the School Settings control panel to continue calendar operations.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 font-sans antialiased text-slate-900 dark:text-slate-100 min-h-screen">
      
      {/* Header ribbon */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2 text-slate-900 dark:text-slate-50">
            <Calendar className="w-5 h-5 text-slate-800 dark:text-slate-200" /> School Calendar
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
            Manage school events, holidays and specific class schedules.
          </p>
        </div>

        <div className="flex items-center gap-2 select-none">
	<button
  type="button"
  disabled={loadingData || !activeSessionId}
  onClick={async () => {
    try {
      const result = await apiClient.post(
        `/academic-calendar/seed?sessionId=${activeSessionId}`
      );


      const seeded = result.data?.seeded ?? 0;

toast.success(
  seeded > 0
    ? `${seeded} national holidays seeded`
    : "National holidays already exist for this session"
);

      triggerDataLoaderFetch();
    } catch (error) {
      console.error(error);
      toast.error(
        "Failed to seed national holidays"
      );
    }
  }}
  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold"
>
  Seed National Holidays
</button>
          <button
            type="button"
            disabled={loadingData}
            onClick={triggerDataLoaderFetch}
            className="p-2.5 border rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-3xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? "animate-spin text-blue-500" : ""}`} />
          </button>

          <button
            type="button"
            onClick={() => { setEditingEventNode(null); setFallbackCellDate(""); setIsModalOpen(true); }}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md transition-all"
          >
            <Plus className="w-4 h-4 flex-shrink-0" /> Create Event
          </button>
        </div>
      </div>

      {/* Network Failure Banner */}
      {loadError && (
        <div className="p-4 rounded-xl border border-rose-200/40 bg-rose-50/50 dark:bg-rose-950/10 text-rose-700 dark:text-rose-400 flex items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-150 shadow-3xs text-xs font-bold leading-none">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Unable to refresh calendar. Showing previously loaded data.</span>
          </div>
          <button type="button" onClick={triggerDataLoaderFetch} className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg uppercase tracking-wider font-mono text-[10px]">
            Retry Sync
          </button>
        </div>
      )}

      {/* Filters bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/50 dark:bg-slate-800/20 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800/80">
        <div className="sm:col-span-2 relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input 
            type="text"
            placeholder="Search events by title or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border rounded-xl dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-slate-400 font-medium bg-white"
          />
        </div>
        <div className="relative flex items-center">
          <Filter className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <select
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value as EventFilter)}
            className="w-full pl-9 pr-4 py-2 text-xs border rounded-xl dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none font-bold bg-white"
          >
            <option value="ALL">All Event Types</option>
            {Object.keys(TYPE_CONFIG_MAP).map(key => (
              <option key={key} value={key}>{TYPE_CONFIG_MAP[key as keyof typeof TYPE_CONFIG_MAP]?.label || key}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-4 rounded-2xl shadow-3xs">
        <div className="flex items-center gap-2 justify-between sm:justify-start w-full sm:w-auto">
          <div className="flex items-center border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-3xs bg-slate-50/50 dark:bg-slate-950/20">
            <button type="button" onClick={handleNavigatePriorMonth} className="p-2 hover:bg-white dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => { const d = new Date(); setCurrentYear(d.getFullYear()); setCurrentMonth(d.getMonth() + 1); }} className="px-3.5 py-2 text-xs font-mono font-black text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800">
              Today
            </button>
            <button type="button" onClick={handleNavigateNextMonth} className="p-2 hover:bg-white dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-slate-800">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 font-mono tracking-tight pl-2">
            {resolvedMonthLabelName} {currentYear}
          </h3>
        </div>

        <div className="flex items-center border border-slate-200/80 p-1 bg-slate-50/60 dark:bg-slate-950/40 rounded-xl shadow-inner select-none text-[10px] uppercase font-black tracking-wider w-full sm:w-auto justify-center dark:border-slate-800">
          <button type="button" onClick={() => setViewMode("month")} className={`px-3 py-1.5 rounded-lg font-mono transition-all duration-150 ${viewMode === "month" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 border border-slate-200/60 dark:border-slate-700" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"}`}>
            Grid View
          </button>
          <button type="button" onClick={() => setViewMode("agenda")} className={`px-3 py-1.5 rounded-lg font-mono transition-all duration-150 ${viewMode === "agenda" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 border border-slate-200/60 dark:border-slate-700" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"}`}>
            Agenda View
          </button>
        </div>
      </div>

      {/* Month workspace renderer */}
      <div className="relative">
        {loadingData && (
          <div className="absolute inset-0 bg-white/40 dark:bg-slate-950/20 backdrop-blur-3xs z-30 flex items-center justify-center transition-all pointer-events-none">
            <div className="p-3.5 border rounded-xl bg-white dark:bg-slate-900 shadow-xl flex items-center gap-2 text-xs font-black font-mono">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" /> Loading calendar...
            </div>
          </div>
        )}

        {viewMode === "month" ? (
          <MonthGrid
            year={currentYear}
            month={currentMonth}
            events={filteredEventsList}
            onEventClick={handleTriggerEventInspection}
            onQuickAdd={handleTriggerQuickAddShortcut}
            onDayClick={handleTriggerQuickAddShortcut}
          />
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden p-5 sm:p-6 space-y-4 shadow-3xs animate-in fade-in duration-150">
            <span className="font-mono text-[10px] uppercase font-black tracking-widest text-slate-400 block mb-1">Agenda View</span>
            
            {filteredEventsList.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredEventsList.map(ev => {
                  const uiMeta = TYPE_CONFIG_MAP[ev.type];
                  return (
                    <div key={ev.id} onClick={() => handleTriggerEventInspection(ev)} className="py-3 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/40 dark:hover:bg-slate-800/20 px-2 rounded-xl transition-colors group">
                      <div className="flex flex-col gap-1 min-w-0 flex-1 pr-2">
                        <span className="font-black text-slate-900 dark:text-slate-100 tracking-tight text-xs break-words group-hover:text-blue-600 dark:group-hover:text-blue-400">{ev.title}</span>
                        <span className="text-[10px] text-slate-400 font-mono font-medium">Dates: {new Date(ev.startDate).toLocaleDateString("en-IN")} - {new Date(ev.endDate).toLocaleDateString("en-IN")}</span>
                      </div>
                      {uiMeta && <span className={`px-2.5 py-0.5 border rounded-full text-[9px] font-black uppercase tracking-wider flex-shrink-0 shadow-3xs ${uiMeta.bg}`}>{uiMeta.label}</span>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-slate-400 dark:text-slate-500 font-medium py-10 text-center italic">
                {eventsList.length > 0 && filteredEventsList.length === 0 
                  ? "No matching events found for the active search criteria." 
                  : "No events scheduled for this period."}
              </p>
            )}
          </div>
        )}
      </div>

      <EventModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingEventNode(null); }}
        onSubmit={handleModalFormSubmitCommit}
        classes={classesMatrix}
        initialEvent={editingEventNode} 
        fallbackDate={fallbackCellDate}
      />

      <EventDrawer
        event={editingEventNode}
        isOpen={isDrawerOpen}
        onClose={() => { setIsDrawerOpen(false); setEditingEventNode(null); }}
        onAction={handleExecuteDrawerStateMutation}
        onEditTrigger={(ev) => {
          setEditingEventNode(ev); 
          setIsDrawerOpen(false);
          setIsModalOpen(true); 
        }}
      />
    </div>
  );
}
