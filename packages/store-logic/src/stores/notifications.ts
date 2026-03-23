import { create } from 'zustand';

export interface Notification {
  id: string; channel: string; status: string; subject?: string;
  body: string; createdAt: string; sentAt?: string; failReason?: string;
}

interface NotificationsStore {
  notifications: Notification[];
  stats:         { total: number; sent: number; failed: number; pending: number; deliveryRate: number } | null;
  channelFilter: string;
  setNotifications:(notifs: Notification[]) => void;
  setStats:      (stats: any) => void;
  setFilter:     (channel: string) => void;
}

export const useNotificationsStore = create<NotificationsStore>((set) => ({
  notifications: [], stats: null, channelFilter: '',
  setNotifications: (notifications) => set({ notifications }),
  setStats:         (stats)         => set({ stats }),
  setFilter:        (channelFilter) => set({ channelFilter }),
}));
