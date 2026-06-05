'use client'

import { useState } from 'react'

import { httpBatchLink } from '@trpc/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { trpc } from './client'

export function TrpcProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
          headers: () => {
            const token =
              typeof window !== 'undefined'
                ? (
                    localStorage.getItem('sa_token') ||
                    localStorage.getItem('accessToken')
                  )
                : null

            return {
              'x-trpc-source': 'superadmin',
              ...(token
                ? { Authorization: `Bearer ${token}` }
                : {}),
            }
          },
        }),
      ],
    }),
  )

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  )
}
