"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router          = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Hydration guard — Zustand persist loads from localStorage async.
  // Without this, isAuthenticated is false for ~1 render cycle on refresh,
  // causing an immediate redirect to /login even when the user IS logged in.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.replace("/login");
    }
  }, [hydrated, isAuthenticated, router]);

  // Show nothing until Zustand has loaded from localStorage
  if (!hydrated) return null;

  // Still authenticated — render children
  if (isAuthenticated) return <>{children}</>;

  // Not authenticated — show nothing while redirect happens
  return null;
}
