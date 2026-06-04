import { 
  Building2, MapPin, Landmark, ClipboardCheck, Users, 
  BarChart3, Trophy, Theater, Palette, Zap, GraduationCap, 
  Users2, BookOpen, RefreshCw, LucideIcon 
} from "lucide-react";

export const EVENT_SCOPE_OPTIONS = ['ALL_SCHOOL', 'CLASS', 'SECTION'] as const;
export type EventScope = typeof EVENT_SCOPE_OPTIONS[number];

export const AUDIENCE_OPTIONS = ['STUDENTS', 'STAFF', 'BOTH'] as const;
export type AudienceType = typeof AUDIENCE_OPTIONS[number];

export type CalendarViewMode = 'month' | 'agenda';

// ⚡ Standard Shared Week Days Array Constants
export const CALENDAR_WEEK_DAYS = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
] as const;

export interface CalendarImpact {
  blocksAttendance: boolean;
  isWorkingDay: boolean;
}

export const TYPE_CONFIG_MAP = {
  NATIONAL_HOLIDAY: { label: "National Holiday", bg: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400", dot: "bg-red-500", defaultColor: "#dc2626" },
  REGIONAL_HOLIDAY: { label: "Regional Holiday", bg: "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400", dot: "bg-orange-500", defaultColor: "#f97316" },
  SCHOOL_HOLIDAY: { label: "School Holiday", bg: "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400", dot: "bg-orange-600", defaultColor: "#ea580c" },
  EXAM: { label: "Examination", bg: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400", dot: "bg-amber-500", defaultColor: "#f59e0b" },
  PTM: { label: "PTM Meet", bg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400", dot: "bg-emerald-500", defaultColor: "#10b981" },
  RESULT_DAY: { label: "Result Day", bg: "bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400", dot: "bg-teal-500", defaultColor: "#06b6d4" },
  SPORTS_DAY: { label: "Sports Day", bg: "bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400", dot: "bg-purple-500", defaultColor: "#8b5cf6" },
  ANNUAL_FUNCTION: { label: "Annual Function", bg: "bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400", dot: "bg-purple-600", defaultColor: "#7c3aed" },
  CULTURAL_EVENT: { label: "Cultural Event", bg: "bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400", dot: "bg-purple-700", defaultColor: "#6d28d9" },
  ACTIVITY: { label: "Activity", bg: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400", dot: "bg-indigo-500", defaultColor: "#6366f1" },
  TRAINING: { label: "Staff Training", bg: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400", dot: "bg-slate-500", defaultColor: "#64748b" },
  STAFF_MEETING: { label: "Staff Meeting", bg: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400", dot: "bg-zinc-500", defaultColor: "#71717a" },
  SPECIAL_CLASS: { label: "Special Class", bg: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-400", dot: "bg-cyan-500", defaultColor: "#06b6d4" },
  WORKING_DAY_OVERRIDE: { label: "Working Day Override", bg: "bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400", dot: "bg-sky-500", defaultColor: "#0284c7" },
} as const;

export type CalendarEventType = keyof typeof TYPE_CONFIG_MAP;

// ⚡ High Fidelity Clean Lucide Vector Layout Mapping (No raw emojis for prod lala!)
export const TYPE_ICON_MAP: Record<CalendarEventType, LucideIcon> = {
  NATIONAL_HOLIDAY: Landmark,
  REGIONAL_HOLIDAY: MapPin,
  SCHOOL_HOLIDAY: Building2,
  EXAM: ClipboardCheck,
  PTM: Users,
  RESULT_DAY: BarChart3,
  SPORTS_DAY: Trophy,
  ANNUAL_FUNCTION: Theater,
  CULTURAL_EVENT: Palette,
  ACTIVITY: Zap,
  TRAINING: GraduationCap,
  STAFF_MEETING: Users2,
  SPECIAL_CLASS: BookOpen,
  WORKING_DAY_OVERRIDE: RefreshCw,
};

export interface AcademicCalendarEventTarget {
  id: string;
  eventId: string;
  classId: string | null;
  sectionId: string | null;
  houseId?: string | null;
  streamId?: string | null;
  class?: {
    id: string;
    name: string;
  };
  section?: {
    id: string;
    name: string;
  };
}

export interface AcademicCalendarEvent {
  id: string;
  tenantId: string;
  branchId: string | null;
  sessionId: string;
  title: string;
  description: string | null;
  type: CalendarEventType;
  scope: EventScope;
  audience: AudienceType;
  startDate: string;
  endDate: string;
  isWorkingDay: boolean;
  blocksAttendance: boolean;
  isPublished: boolean;
  color: string | null;
  recurrenceRule: string | null;
  targets?: AcademicCalendarEventTarget[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ⚡ High Performance Date Matrix Token with isoDate String Track
export interface CalendarDay {
  date: Date;
  isoDate: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: AcademicCalendarEvent[];
}

// ⚡ Color Token configured as advanced optional property for overrides fallback
export interface CalendarFormState {
  title: string;
  description: string;
  type: CalendarEventType;
  scope: EventScope;
  audience: AudienceType;
  startDate: string;
  endDate: string;
  isPublished: boolean;
  isWorkingDay: boolean;
  blocksAttendance: boolean;
  color?: string; 
  targets?: {
  classId?: string;
  sectionId?: string;
}[];
}

export interface EventTargetSummary {
  classNames: string[];
  sectionNames: string[];
}

// ⚡ Pristine Unified Global Helper to resolve dynamic fallbacks
export const getEventColor = (event: AcademicCalendarEvent): string => {
  return event.color ?? TYPE_CONFIG_MAP[event.type].defaultColor;
};
