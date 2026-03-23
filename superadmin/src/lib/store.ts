"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SAUser { id: string; email: string; role: string; }

interface SAStore {
  user:            SAUser | null;
  token:           string | null;
  isAuthenticated: boolean;
  login:  (user: SAUser, token: string) => void;
  logout: () => void;
}

export const useSAStore = create<SAStore>()(
  persist(
    (set) => ({
      user:            null,
      token:           null,
      isAuthenticated: false,
      login:  (user, token) => {
        localStorage.setItem("sa_token", token);
        set({ user, token, isAuthenticated: true });
      },
      logout: () => {
        localStorage.removeItem("sa_token");
        set({ user: null, token: null, isAuthenticated: false });
      },
    }),
    { name: "sa-auth" }
  )
);
