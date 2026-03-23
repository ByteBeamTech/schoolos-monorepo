import { create } from 'zustand';

export interface Exam { id: string; name: string; type: string; startDate: string; endDate: string; isPublished: boolean; sessionId: string; _count?: { schedules: number; marks: number } }
export interface ExamSchedule { id: string; subjectId: string; classId: string; date: string; startTime: string; endTime: string; maxMarks: number; passMarks: number }
export interface Mark { studentId: string; scheduleId: string; marksObtained?: number; isAbsent: boolean }

interface ExaminationsStore {
  exams:          Exam[];
  selectedExam:   (Exam & { schedules: ExamSchedule[] }) | null;
  marks:          Record<string, { marksObtained: string; isAbsent: boolean }>;
  sessionFilter:  string;
  setExams:       (exams: Exam[]) => void;
  selectExam:     (exam: any)    => void;
  setMark:        (studentId: string, data: { marksObtained: string; isAbsent: boolean }) => void;
  setSessionFilter:(id: string)  => void;
  resetMarks:     ()             => void;
}

export const useExaminationsStore = create<ExaminationsStore>((set) => ({
  exams: [], selectedExam: null, marks: {}, sessionFilter: '',
  setExams:       (exams)        => set({ exams }),
  selectExam:     (selectedExam) => set({ selectedExam, marks: {} }),
  setMark:        (studentId, data) => set(s => ({ marks: { ...s.marks, [studentId]: data } })),
  setSessionFilter:(sessionFilter) => set({ sessionFilter }),
  resetMarks:     ()               => set({ marks: {} }),
}));
