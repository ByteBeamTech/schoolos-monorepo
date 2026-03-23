import { create } from 'zustand';

export interface Student {
  id: string; admissionNumber: string; firstName: string; lastName: string;
  status: string; sectionId?: string; rollNumber?: string; academicYear: string;
  section?: { id: string; name: string; class: { id: string; name: string } };
  guardianLinks?: { guardian: { firstName: string; lastName: string; phone?: string } }[];
  createdAt: string;
}

interface StudentsStore {
  students:    Student[];
  total:       number;
  page:        number;
  loading:     boolean;
  search:      string;
  setStudents: (students: Student[], total: number) => void;
  setPage:     (page: number) => void;
  setSearch:   (search: string) => void;
  setLoading:  (loading: boolean) => void;
  reset:       () => void;
}

export const useStudentsStore = create<StudentsStore>((set) => ({
  students: [], total: 0, page: 1, loading: false, search: '',
  setStudents: (students, total) => set({ students, total }),
  setPage:     (page)    => set({ page }),
  setSearch:   (search)  => set({ search, page: 1 }),
  setLoading:  (loading) => set({ loading }),
  reset:       ()        => set({ students: [], total: 0, page: 1, search: '' }),
}));
