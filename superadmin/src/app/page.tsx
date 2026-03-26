// app/page.tsx
// BUG 5 FIX: The original `redirect('/dashboard')` fired on the server
// before the client could hydrate the Zustand auth store. Unauthenticated
// users got flashed to /dashboard, then immediately bounced to /login by
// ProtectedRoute — causing a visible flash and a hydration mismatch.
//
// Fix: render nothing on the server; let the client-side ProtectedRoute
// in (platform)/layout.tsx handle the redirect after hydration.
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSAStore } from '@/lib/store';

export default function Root() {
  const router          = useRouter();
  const isAuthenticated = useSAStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [isAuthenticated, router]);

  // Render nothing — redirect happens client-side after store hydrates
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
