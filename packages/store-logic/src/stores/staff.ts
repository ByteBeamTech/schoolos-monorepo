import { create } from 'zustand';

export interface StaffMember { id: string; employeeId: string; designation: string; department?: string; isActive: boolean; user: { id: string; firstName: string; lastName: string; email: string; role: string } }

interface StaffStore {
  staff:      StaffMember[];
  search:     string;
  department: string;
  setStaff:   (staff: StaffMember[]) => void;
  setSearch:  (search: string) => void;
  setDept:    (dept: string)   => void;
}

export const useStaffStore = create<StaffStore>((set) => ({
  staff: [], search: '', department: '',
  setStaff:  (staff)   => set({ staff }),
  setSearch: (search)  => set({ search }),
  setDept:   (department) => set({ department }),
}));
