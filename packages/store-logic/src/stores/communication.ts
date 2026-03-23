import { create } from 'zustand';

export interface Announcement { id: string; title: string; body: string; isPinned: boolean; publishedAt?: string; }
export interface Circular      { id: string; title: string; body: string; publishedAt?: string; }

interface CommunicationStore {
  announcements:    Announcement[];
  circulars:        Circular[];
  setAnnouncements: (a: Announcement[]) => void;
  setCirculars:     (c: Circular[])     => void;
}

export const useCommunicationStore = create<CommunicationStore>((set) => ({
  announcements: [], circulars: [],
  setAnnouncements: (announcements) => set({ announcements }),
  setCirculars:     (circulars)     => set({ circulars }),
}));
