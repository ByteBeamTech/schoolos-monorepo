import { create } from 'zustand';

interface Toast { id: string; message: string; type: 'success' | 'error' | 'warning' | 'info'; duration?: number }

interface UIStore {
  sidebarOpen:   boolean;
  toasts:        Toast[];
  globalLoading: boolean;
  toggleSidebar: ()                    => void;
  addToast:      (toast: Omit<Toast, 'id'>) => void;
  removeToast:   (id: string)          => void;
  setLoading:    (loading: boolean)    => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: true, toasts: [], globalLoading: false,
  toggleSidebar: ()        => set(s => ({ sidebarOpen: !s.sidebarOpen })),
  addToast:      (toast)   => set(s => ({ toasts: [...s.toasts, { ...toast, id: Date.now().toString() }] })),
  removeToast:   (id)      => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
  setLoading:    (globalLoading) => set({ globalLoading }),
}));
