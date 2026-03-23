import { create } from 'zustand';

export interface TimetableSlot { id: string; sectionId: string; subjectId: string; teacherId: string; dayOfWeek: number; periodNumber: number; startTime: string; endTime: string; isActive: boolean }
export interface WeeklyTimetable { sectionId: string; totalSlots: number; days: { day: number; dayName: string; slots: TimetableSlot[] }[] }

interface TimetableStore {
  timetable:    WeeklyTimetable | null;
  sectionId:    string;
  sessionId:    string;
  setTimetable: (t: WeeklyTimetable) => void;
  setSectionId: (id: string) => void;
  setSessionId: (id: string) => void;
}

export const useTimetableStore = create<TimetableStore>((set) => ({
  timetable: null, sectionId: '', sessionId: '',
  setTimetable: (timetable)  => set({ timetable }),
  setSectionId: (sectionId)  => set({ sectionId }),
  setSessionId: (sessionId)  => set({ sessionId }),
}));
