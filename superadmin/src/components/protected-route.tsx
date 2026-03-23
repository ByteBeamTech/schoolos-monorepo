"use client";
import { useEffect, useState } from "react";
import { useRouter }           from "next/navigation";
import { useSAStore }          from "@/lib/store";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router          = useRouter();
  const isAuthenticated = useSAStore((s) => s.isAuthenticated);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => { setHydrated(true); }, []);
  useEffect(() => {
    if (hydrated && !isAuthenticated) router.replace("/login");
  }, [hydrated, isAuthenticated, router]);

  if (!hydrated || !isAuthenticated) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  return <>{children}</>;
}
