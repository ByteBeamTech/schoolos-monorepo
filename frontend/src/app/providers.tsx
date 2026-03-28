'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect }               from 'react';
import { initApiClient }                     from '@schoolos/api-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://192.168.1.50:3000/api/v1';

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
  }));

  useEffect(() => {
    initApiClient(API_URL);
  }, []);

  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
