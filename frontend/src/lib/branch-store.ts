import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export const useBranchStore = create<any>()(persist((set) => ({
  selectedBranchId: null,
  selectBranch: (id: string) => set({ selectedBranchId: id }),
}), { name: 'branch-storage' }));
