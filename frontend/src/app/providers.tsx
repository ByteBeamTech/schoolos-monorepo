'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { initApiClient } from '@schoolos/api-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

// Initialise once at module scope so it's ready before any component mounts
if (typeof window !== 'undefined') {
  initApiClient(API_URL);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
  }));

  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
