import { create } from 'zustand';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'ON_LEAVE' | 'HOLIDAY';

export interface AttendanceRecord {
  id: string; studentId: string; date: string; status: AttendanceStatus;
  period?: number; remarks?: string;
  student: { id: string; firstName: string; lastName: string; admissionNumber: string; rollNumber?: string };
}

interface AttendanceStore {
  records:       AttendanceRecord[];
  date:          string;
  sectionId:     string;
  sessionId:     string;
  marks:         Record<string, AttendanceStatus>;
  submitted:     boolean;
  setDate:       (date: string) => void;
  setSectionId:  (id: string)   => void;
  setSessionId:  (id: string)   => void;
  setMark:       (studentId: string, status: AttendanceStatus) => void;
  markAll:       (status: AttendanceStatus, studentIds: string[]) => void;
  setRecords:    (records: AttendanceRecord[]) => void;
  setSubmitted:  (v: boolean) => void;
  reset:         () => void;
}

const today = () => new Date().toISOString().split('T')[0];

export const useAttendanceStore = create<AttendanceStore>((set) => ({
  records: [], date: today(), sectionId: '', sessionId: '', marks: {}, submitted: false,
  setDate:      (date)      => set({ date, submitted: false }),
  setSectionId: (sectionId) => set({ sectionId, marks: {}, submitted: false }),
  setSessionId: (sessionId) => set({ sessionId }),
  setMark:      (studentId, status) => set(s => ({ marks: { ...s.marks, [studentId]: status } })),
  markAll:      (status, studentIds) => set(() => {
    const marks: Record<string, AttendanceStatus> = {};
    studentIds.forEach(id => { marks[id] = status; });
    return { marks };
  }),
  setRecords:   (records)   => set({ records }),
  setSubmitted: (submitted) => set({ submitted }),
  reset:        ()          => set({ records: [], marks: {}, submitted: false }),
}));
