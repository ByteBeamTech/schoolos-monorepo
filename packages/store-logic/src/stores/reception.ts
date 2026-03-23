import { create } from 'zustand';

export interface Complaint { id: string; ticketNumber: string; complainantName: string; category: string; subject: string; priority: string; status: string; createdAt: string; }
export interface Visitor   { id: string; passNumber: string; visitorName: string; phone: string; purpose: string; personToMeet: string; checkIn: string; status: string; }

interface ReceptionStore {
  complaints:   Complaint[];
  visitors:     Visitor[];
  setComplaints:(c: Complaint[]) => void;
  setVisitors:  (v: Visitor[])   => void;
}

export const useReceptionStore = create<ReceptionStore>((set) => ({
  complaints: [], visitors: [],
  setComplaints: (complaints) => set({ complaints }),
  setVisitors:   (visitors)   => set({ visitors }),
}));
