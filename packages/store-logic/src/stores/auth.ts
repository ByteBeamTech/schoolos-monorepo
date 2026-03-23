import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string; email: string; firstName: string; lastName: string;
  role: string; tenantId: string; tenantSlug: string;
}

interface AuthStore {
  user:            AuthUser | null;
  token:           string | null;
  refreshToken:    string | null;
  isAuthenticated: boolean;
  login:  (user: AuthUser, token: string, refreshToken?: string) => void;
  logout: () => void;
  updateUser: (partial: Partial<AuthUser>) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null, token: null, refreshToken: null, isAuthenticated: false,
      login: (user, token, refreshToken) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken',  token);
          localStorage.setItem('refreshToken', refreshToken ?? '');
          localStorage.setItem('tenantId',     user.tenantSlug);
        }
        set({ user, token, refreshToken: refreshToken ?? null, isAuthenticated: true });
      },
      logout: () => {
        if (typeof window !== 'undefined') localStorage.clear();
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
      },
      updateUser: (partial) => set(s => ({ user: s.user ? { ...s.user, ...partial } : null })),
    }),
    { name: 'schoolos-auth' }
  )
);
