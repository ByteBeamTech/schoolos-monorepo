import { create } from 'zustand';

export interface AcademicClass { id: string; name: string; displayOrder: number; sections: Section[] }
export interface Section { id: string; name: string; capacity: number; classId: string; _count?: { students: number } }
export interface Subject { id: string; name: string; code?: string; isElective: boolean }
export interface AcademicSession { id: string; name: string; startDate: string; endDate: string; isCurrent: boolean; isLocked: boolean }

interface AcademicsStore {
  sessions:       AcademicSession[];
  currentSession: AcademicSession | null;
  classes:        AcademicClass[];
  subjects:       Subject[];
  activeSessionId:string;
  setSessions:    (sessions: AcademicSession[]) => void;
  setClasses:     (classes: AcademicClass[])    => void;
  setSubjects:    (subjects: Subject[])         => void;
  setActiveSession:(id: string)                 => void;
}

export const useAcademicsStore = create<AcademicsStore>((set, get) => ({
  sessions: [], currentSession: null, classes: [], subjects: [], activeSessionId: '',
  setSessions:     (sessions) => set({ sessions, currentSession: sessions.find(s => s.isCurrent) ?? null }),
  setClasses:      (classes)  => set({ classes }),
  setSubjects:     (subjects) => set({ subjects }),
  setActiveSession:(id)       => set({ activeSessionId: id }),
}));
