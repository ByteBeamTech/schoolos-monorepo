import { create } from 'zustand';

export interface GradeEntry { studentId: string; studentName: string; marks: Record<string, number>; total: number; percentage: number; grade: string; rank?: number }

interface GradebookStore {
  entries:  GradeEntry[];
  examId:   string;
  classId:  string;
  loading:  boolean;
  setEntries:(entries: GradeEntry[]) => void;
  setExamId: (id: string) => void;
  setClassId:(id: string) => void;
  setLoading:(loading: boolean) => void;
}

export const useGradebookStore = create<GradebookStore>((set) => ({
  entries: [], examId: '', classId: '', loading: false,
  setEntries: (entries) => set({ entries }),
  setExamId:  (examId)  => set({ examId }),
  setClassId: (classId) => set({ classId }),
  setLoading: (loading) => set({ loading }),
}));
