import React from "react";
import { Megaphone, Calendar, Shield, AlertCircle, HelpCircle } from "lucide-react";

export type CalendarEventType =
  | "ACADEMIC_MILESTONE"
  | "EXAMINATION"
  | "PARENT_TEACHER_MEETING"
  | "SPORTS_DAY"
  | "CULTURAL_EVENT"
  | "NATIONAL_HOLIDAY"
  | "REGIONAL_HOLIDAY"
  | "SCHOOL_HOLIDAY";

export type EventScope = "ALL_SCHOOL" | "CLASS" | "SECTION" | "STREAM" | "HOUSE" | "CUSTOM";
export type AudienceType = "STUDENTS" | "STAFF" | "BOTH";
export type CalendarViewMode = "month" | "agenda";

export interface CalendarTargetDto {
  id: string;
  eventId: string;
  classId?: string;
  sectionId?: string;
  streamId?: string;
  houseId?: string;
  class?: { id: string; name: string };
  section?: { id: string; name: string };
}

export interface AcademicCalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  type: CalendarEventType;
  scope: EventScope;
  audience: AudienceType;
  startDate: string; 
  endDate: string;   
  isPublished: boolean;
  blocksAttendance: boolean;
  isWorkingDay: boolean;
  color?: string | null;
  sessionId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  targets?: CalendarTargetDto[];
}

export interface CalendarFormState {
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
  color?: string;
  targets?: {
  classId?: string;
  sectionId?: string;
}[];
}

export const AUDIENCE_OPTIONS: AudienceType[] = ["BOTH", "STUDENTS", "STAFF"];

export interface TypeUiConfig {
  label: string;
  bg: string;
  border: string;
  text: string;
  defaultColor: string;
}

export const TYPE_CONFIG_MAP: Record<CalendarEventType, TypeUiConfig> = {
  ACADEMIC_MILESTONE: { label: "Milestone", bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200", text: "text-blue-700", defaultColor: "#2563eb" },
  EXAMINATION: { label: "Examination", bg: "bg-indigo-50 dark:bg-indigo-950/30", border: "border-indigo-200", text: "text-indigo-700", defaultColor: "#4f46e5" },
  PARENT_TEACHER_MEETING: { label: "PTM Meet", bg: "bg-purple-50 dark:bg-purple-950/30", border: "border-purple-200", text: "text-purple-700", defaultColor: "#9333ea" },
  SPORTS_DAY: { label: "Sports Events", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200", text: "text-emerald-700", defaultColor: "#059669" },
  CULTURAL_EVENT: { label: "Festival/Cultural", bg: "bg-pink-50 dark:bg-pink-950/30", border: "border-pink-200", text: "text-pink-700", defaultColor: "#db2777" },
  NATIONAL_HOLIDAY: { label: "National Holiday", bg: "bg-rose-50 dark:bg-rose-950/40", border: "border-rose-200", text: "text-rose-700", defaultColor: "#dc2626" },
  REGIONAL_HOLIDAY: { label: "Regional Holiday", bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200", text: "text-red-700", defaultColor: "#ef4444" },
  SCHOOL_HOLIDAY: { label: "School Holiday", bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200", text: "text-amber-700", defaultColor: "#d97706" },
};

// Internal functional component placeholder to safely bypass SVG bundling traces
const ActivityIcon: React.FC<any> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
);

export const TYPE_ICON_MAP: Record<CalendarEventType, React.ComponentType<any>> = {
  ACADEMIC_MILESTONE: Calendar,
  EXAMINATION: Shield,
  PARENT_TEACHER_MEETING: AlertCircle,
  SPORTS_DAY: ActivityIcon,
  CULTURAL_EVENT: HelpCircle,
  NATIONAL_HOLIDAY: Megaphone,
  REGIONAL_HOLIDAY: Megaphone,
  SCHOOL_HOLIDAY: Megaphone,
};

export const getEventColor = (event: AcademicCalendarEvent): string => {
  return event.color || TYPE_CONFIG_MAP[event.type]?.defaultColor || "#64748b";
};
