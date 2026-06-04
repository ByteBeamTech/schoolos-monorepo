"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Trash2, Megaphone, EyeOff, Lock, Calendar, Layers, 
  Shield, HelpCircle, X, CheckCircle2, User, Clock, 
  Hash, Edit3, AlertCircle, ChevronDown, ChevronUp 
} from "lucide-react";
import { AcademicCalendarEvent, TYPE_CONFIG_MAP, TYPE_ICON_MAP, getEventColor } from "./types";
import { useToast } from "@/lib/use-toast";

interface EventDrawerProps {
  event: AcademicCalendarEvent | null;
  isOpen: boolean;
  onClose: () => void;
  onAction: (id: string, endpoint: "publish" | "unpublish" | "delete") => Promise<void>;
  onEditTrigger?: (event: AcademicCalendarEvent) => void;
}

const formatSystemDateToken = (isoString: string): string => {
  if (!isoString) return "";
  return new Date(isoString.split('T')[0]).toLocaleDateString("en-IN", {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const resolveTargetLabelToken = (inputString: string): string => {
  if (!inputString) return "";
  return inputString
    .replace(/^(house_|stream_)/i, "")
    .replace(/_stream$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export const EventDrawer: React.FC<EventDrawerProps> = ({ 
  event, 
  isOpen,
  onClose, 
  onAction,
  onEditTrigger
}) => {
  const { toast } = useToast();
  const [activeAction, setActiveAction] = useState<"publish" | "unpublish" | "delete" | null>(null);
  const [showDeleteGuardModal, setShowDeleteGuardModal] = useState(false);
  const [showAdvancedMetadata, setShowAdvancedMetadata] = useState(false);
  
  const panelRef = useRef<HTMLDivElement>(null);
  const primaryActionButtonRef = useRef<HTMLButtonElement>(null);

  // ⚡ Fix 6: Removed redundant useMemo layer for clean, straightforward evaluation mapping lala
  const headingIdRef = event 
    ? `drawer-heading-${event.id}` 
    : "drawer-heading-fallback-token";

  useEffect(() => {
    if (!isOpen) return;

    const handleFocusTrap = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !panelRef.current) return;
      
      const focusableElements = panelRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (!focusableElements || focusableElements.length === 0) return;
      
      const firstEl = focusableElements[0] as HTMLElement;
      const lastEl = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          lastEl.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastEl) {
          firstEl.focus();
          e.preventDefault();
        }
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    
    window.addEventListener("keydown", handleFocusTrap);
    const delayTimer = setTimeout(() => primaryActionButtonRef.current?.focus(), 50);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleFocusTrap);
      clearTimeout(delayTimer);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !activeAction) {
        if (showDeleteGuardModal) setShowDeleteGuardModal(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose, activeAction, showDeleteGuardModal]);

  if (!isOpen || !event) return null;
  
  const uiCfg = TYPE_CONFIG_MAP[event.type];
  const DynamicVectorIcon = TYPE_ICON_MAP[event.type];
  const resolvedColor = getEventColor(event);

  const handleExecuteAction = async (endpoint: "publish" | "unpublish" | "delete") => {
    if (activeAction) return;
    setActiveAction(endpoint);
    
    try {
      await onAction(event.id, endpoint);
      toast.success(
        endpoint === "delete" ? "Calendar event deleted permanently." :
        endpoint === "publish" ? "Calendar event is now live." : "Event reverted to draft pipeline."
      );
      setShowDeleteGuardModal(false);
      onClose();
    } catch (error) {
      console.error(`Action pipeline execution trace failure [${endpoint}] ->`, error);
      toast.error(`Failed to execute operation. Please check your network connection.`);
    } finally {
      setActiveAction(null);
    }
  };

  // ⚡ Fix 1 & 2: Structural fallback mapping conforming cleanly to future explicit relations lala
  const sessionDisplayName = (event as any).session?.name || event.sessionId || "Current Academic Session";
  const creatorDisplayName = (event as any).creator?.fullName || (event.createdBy && !/^[0-9a-z]{25}$/i.test(event.createdBy) ? event.createdBy : "School Administrator");

  return (
    <div 
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingIdRef}
      className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex justify-end animate-in fade-in duration-150 font-sans"
    >
      <div onClick={() => !activeAction && onClose()} className="absolute inset-0 -z-10 cursor-pointer" />

      <div 
        className="w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200/80 dark:border-slate-800 shadow-2xl h-full flex flex-col justify-between animate-in slide-in-from-right duration-200"
        style={{ borderTop: `5px solid ${resolvedColor}` }}
      >
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs font-bold leading-none">
          
          {/* Header Layout Deck */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <div className="space-y-1">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono">
                Event Details
              </h4>
              <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-[11px] font-medium">
                <span>Status:</span>
                {event.isPublished ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                    <CheckCircle2 className="w-3 h-3 flex-shrink-0" /> Published
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-500 font-bold flex items-center gap-0.5">
                    Draft
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-1.5">
              {onEditTrigger && (
                <button
                  type="button"
                  disabled={!!activeAction}
                  onClick={() => { onEditTrigger(event); onClose(); }}
                  className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-300 font-bold transition-colors shadow-3xs flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
              )}
              <button 
                type="button" 
                disabled={!!activeAction}
                onClick={onClose} 
                aria-label="Close details dialog"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-3xs transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Icon Title Dynamic Core Header */}
          <div className="flex items-start gap-3 bg-slate-50/40 dark:bg-slate-800/20 p-3 border rounded-2xl border-slate-100 dark:border-slate-800/80 shadow-3xs">
            {DynamicVectorIcon && (
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 shadow-3xs flex-shrink-0">
                <DynamicVectorIcon className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              </div>
            )}
            <div className="space-y-2 flex-1 min-w-0">
              <h3 id={headingIdRef} className="text-sm font-black text-slate-900 dark:text-slate-50 tracking-tight leading-snug break-words">
                {event.title}
              </h3>
              {uiCfg && (
                <span className={`inline-flex items-center px-2 py-0.5 border rounded-full text-[9px] font-black uppercase tracking-wider shadow-3xs ${uiCfg.bg}`}>
                  {uiCfg.label}
                </span>
              )}
            </div>
          </div>

          {/* Properties Rows Data Matrix Grid (⚡ Pass 4: Conversational terms enforced perfectly lala) */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
            
            <div className="flex justify-between items-center py-2 gap-4">
              <span className="text-slate-400 dark:text-slate-500 flex items-center gap-1.5 font-medium flex-shrink-0"><Calendar className="w-3.5 h-3.5 flex-shrink-0" /> Date Range</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800/40 px-2.5 py-1 border border-slate-100 dark:border-slate-800 rounded-lg shadow-3xs text-right break-words max-w-xs">
                {formatSystemDateToken(event.startDate)}
                {event.startDate.split('T')[0] !== event.endDate.split('T')[0] && ` - ${formatSystemDateToken(event.endDate)}`}
              </span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="text-slate-400 dark:text-slate-500 flex items-center gap-1.5 font-medium"><Layers className="w-3.5 h-3.5 flex-shrink-0" /> Audience</span>
              <span className="uppercase tracking-wide text-slate-600 dark:text-slate-400 px-2 py-0.5 border border-slate-100 dark:border-slate-800 rounded-md bg-slate-50/50 dark:bg-slate-800/30">
                {event.audience === 'BOTH' ? 'Students & Staff' : event.audience}
              </span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="text-slate-400 dark:text-slate-500 flex items-center gap-1.5 font-medium">Day Schedule Type</span>
              {event.isWorkingDay ? (
                <span className="text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/40 px-2 py-0.5 rounded-lg text-[10px] tracking-wide uppercase font-black">
                  Regular Working Day
                </span>
              ) : (
                <span className="text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20 border border-orange-200/40 px-2 py-0.5 rounded-lg text-[10px] tracking-wide uppercase font-black">
                  School Holiday
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2 py-2.5">
              <span className="text-slate-400 dark:text-slate-500 font-medium block">Target Classes</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {event.targets && event.targets.length > 0 ? (
                  event.targets.map((t) => {
                    const rawTargetValue = t.class?.name || t.section?.name || t.houseId || t.streamId || "";
                    // ⚡ Fix 5: Gracefully map explicit 'Target Group' as fallback description text loops safely
                    const resolvedReadableLabel = resolveTargetLabelToken(rawTargetValue) || "Target Group";
                    
                    return (
                      <span 
                        key={t.id} 
                        className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold font-mono text-[10px] rounded-lg text-slate-600 dark:text-slate-400 shadow-3xs"
                      >
                        {resolvedReadableLabel}
                      </span>
                    );
                  })
                ) : (
                  <span className="text-slate-400 dark:text-slate-500 font-normal italic text-[11px] flex items-center gap-1 pl-0.5">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> General Event (Applies to Whole School)
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 py-2.5">
              <span className="text-slate-400 dark:text-slate-500 font-medium block">Attendance Impact</span>
              {event.blocksAttendance ? (
                <div className="p-2.5 rounded-xl border border-rose-200/40 bg-rose-50/50 dark:bg-rose-950/10 text-rose-700 dark:text-rose-400 flex items-start gap-1.5 leading-normal shadow-3xs">
                  <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="block font-black uppercase text-[9px] tracking-wide">Attendance Tracking Paused</span>
                    {/* ⚡ Fix 3: Removed technical dev text to describe branch targets using soft language blocks */}
                    <span className="font-medium text-[11px] block text-slate-600 dark:text-slate-300">
                      Attendance marking procedures are suspended for {event.scope === 'ALL_SCHOOL' ? 'the entire school' : 'selected classes'}.
                    </span>
                  </div>
                </div>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium text-[11px] block pl-0.5">
                  Standard marking procedures remain active. No blocks found.
                </span>
              )}
            </div>
          </div>

          {event.description && (
            <div className="p-3.5 border border-slate-200/80 dark:border-slate-800 rounded-xl bg-slate-50/40 dark:bg-slate-950/20 text-xs font-medium text-slate-500 dark:text-slate-400 leading-relaxed shadow-3xs">
              <span className="font-mono text-[9px] uppercase font-black tracking-widest text-slate-400 mb-1.5 block">Description</span>
              <span className="leading-normal block break-words">{event.description}</span>
            </div>
          )}

          {/* ⚡ Fix 4: Re-labeled section header to 'Additional Information' for friendlier user perception */}
          <div className="border border-slate-100 dark:border-slate-800/80 rounded-xl overflow-hidden shadow-3xs bg-slate-50/20 dark:bg-slate-950/10">
            <button
              type="button"
              onClick={() => setShowAdvancedMetadata(!showAdvancedMetadata)}
              className="w-full px-3.5 py-2.5 flex justify-between items-center text-left text-slate-400 dark:text-slate-500 select-none hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
            >
              <span className="font-mono text-[9px] uppercase font-black tracking-widest">Additional Information</span>
              {showAdvancedMetadata ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showAdvancedMetadata && (
              <div className="px-3.5 pb-3.5 pt-1.5 space-y-2 border-t border-dashed border-slate-100 dark:border-slate-800/60 font-mono text-[10px] text-slate-500 dark:text-slate-400 animate-in slide-in-from-top-1 duration-150">
                <div className="flex justify-between"><span className="font-medium flex items-center gap-1"><Layers className="w-3 h-3" /> Academic Session:</span><span className="font-bold text-slate-700 dark:text-slate-300">{sessionDisplayName}</span></div>
                <div className="flex justify-between"><span className="font-medium flex items-center gap-1"><User className="w-3 h-3" /> Created By:</span><span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[180px]">{creatorDisplayName}</span></div>
                <div className="flex justify-between"><span className="font-medium flex items-center gap-1"><Clock className="w-3 h-3" /> Created On:</span><span className="font-bold text-slate-700 dark:text-slate-300">{formatSystemDateToken(event.createdAt)}</span></div>
                <div className="flex justify-between"><span className="font-medium flex items-center gap-1"><Clock className="w-3 h-3" /> Last Updated:</span><span className="font-bold text-slate-700 dark:text-slate-300">{formatSystemDateToken(event.updatedAt)}</span></div>
                <div className="flex justify-between border-t dark:border-slate-800/60 pt-2 mt-1.5"><span className="font-medium flex items-center gap-1"><Hash className="w-3 h-3" /> Reference ID:</span><span className="font-bold text-slate-400 select-all tracking-tight text-[9px] truncate max-w-[160px]">{event.id}</span></div>
              </div>
            )}
          </div>

        </div>

        {/* Action Bottom deck controls row */}
        <div className="flex gap-2 border-t border-slate-100 dark:border-slate-800 pt-4 bg-slate-50/40 dark:bg-slate-800/10 p-4 sm:p-5 relative overflow-hidden flex-shrink-0 shadow-md">
          
          {/* ⚡ Fix 5: Reset copy string securely to a crisp, standard confirmation warning, stripping animation bounces out */}
          {showDeleteGuardModal ? (
            <div className="absolute inset-0 bg-white dark:bg-slate-900 p-4 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-150 z-20 select-none">
              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5 leading-tight">
                  <p className="font-black text-slate-900 dark:text-slate-100 text-[11px]">Delete event permanently?</p>
                  <p className="text-slate-400 font-normal text-[10px]">This action cannot be undone.</p>
                </div>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  disabled={activeAction === "delete"}
                  onClick={() => setShowDeleteGuardModal(false)}
                  className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={activeAction === "delete"}
                  onClick={() => handleExecuteAction("delete")}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-sm"
                >
                  {activeAction === "delete" ? "Deleting..." : "Delete Event"}
                </button>
              </div>
            </div>
          ) : null}

          {/* Core dynamic operational controls buttons layer */}
          {!event.isPublished ? (
            <button 
              ref={primaryActionButtonRef}
              type="button"
              disabled={!!activeAction}
              onClick={() => handleExecuteAction("publish")} 
              className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 rounded-xl font-bold uppercase tracking-wider text-[10px] disabled:opacity-40 shadow-md transition-all duration-150 flex items-center justify-center gap-1.5"
            >
              <Megaphone className="w-3.5 h-3.5" /> 
              {activeAction === "publish" ? "Publishing..." : "Publish Event"}
            </button>
          ) : (
            <button 
              ref={primaryActionButtonRef}
              type="button"
              disabled={!!activeAction}
              onClick={() => handleExecuteAction("unpublish")} 
              className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border dark:border-slate-700 rounded-xl font-bold uppercase tracking-wider text-[10px] disabled:opacity-40 transition-all duration-150 flex items-center justify-center gap-1.5"
            >
              <EyeOff className="w-3.5 h-3.5" /> 
              {activeAction === "unpublish" ? "Reverting..." : "Revert to Draft"}
            </button>
          )}
          
          <button 
            type="button"
            disabled={!!activeAction}
            onClick={() => setShowDeleteGuardModal(true)} 
            aria-label="Delete event"
            className="p-2.5 border border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/20 disabled:opacity-40 transition-all shadow-3xs flex items-center gap-1 font-bold text-[10px] uppercase tracking-wider"
          >
            <Trash2 className="w-4 h-4 flex-shrink-0" /> <span className="hidden sm:inline">Delete</span>
          </button>
        </div>
        
      </div>
    </div>
  );
};
