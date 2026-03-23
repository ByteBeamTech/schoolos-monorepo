import { create } from 'zustand';

export interface JoiningRequest { id: string; candidateName: string; position: string; status: string; currentLevel: number; createdAt: string; }
export interface StaffLeave      { id: string; leaveType: string; fromDate: string; toDate: string; totalDays: number; status: string; }

interface HRStore {
  joiningRequests: JoiningRequest[];
  leaveRequests:   StaffLeave[];
  setJoining:  (r: JoiningRequest[]) => void;
  setLeave:    (r: StaffLeave[])     => void;
}

export const useHRStore = create<HRStore>((set) => ({
  joiningRequests: [], leaveRequests: [],
  setJoining: (joiningRequests) => set({ joiningRequests }),
  setLeave:   (leaveRequests)   => set({ leaveRequests }),
}));
