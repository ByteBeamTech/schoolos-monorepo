'use client'

import { useState } from 'react'

import { httpBatchLink } from '@trpc/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { trpc } from './client'

export function TrpcProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  const [trpcClient]  = useState(() =>
    trpc.createClient({
      links: [httpBatchLink({ url: '/api/trpc', headers: () => ({ 'x-trpc-source': 'superadmin' }) })],
    }),
  )
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  )
}
