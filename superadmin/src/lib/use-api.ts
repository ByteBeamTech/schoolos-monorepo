'use client';

import useSWR from 'swr';
import { api } from './api';

export function useApi<T>(path: string | null) {
  const { data, error, isLoading, mutate } = useSWR<T>(
    path,
    (url: string) => api.get<T>(url),
    {
      revalidateOnFocus: true,
      refreshInterval: 30000,
      dedupingInterval: 10000,
      shouldRetryOnError: true,
      errorRetryCount: 3,
      errorRetryInterval: 5000,
    }
  );

  const normalizedError =
    error instanceof Error ? error.message : null;

  // Optional: auto logout on auth failure
  if (normalizedError === 'Unauthorized') {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sa_token');
      window.location.href = '/login';
    }
  }

  return {
    data,
    loading: isLoading,
    error: normalizedError,
    refresh: mutate,
  };
}
