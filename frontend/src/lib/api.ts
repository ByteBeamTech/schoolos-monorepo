// @schoolos/api-client is the canonical API layer.
// This file initialises it and re-exports for pages that haven't migrated yet.
// TODO: Remove apiClient usages in pages — use named endpoint APIs instead.

import { initApiClient, getClient } from '@schoolos/api-client';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3000/api/v1';

// Initialise once at module load — safe for SSR (no-op if window undefined)
if (typeof window !== 'undefined') {
  initApiClient(API_URL);
}

// Legacy compat shim — wraps getClient() so existing apiClient.get/post calls keep working
export const apiClient = {
  get:    (url: string, config?: any) => getClient().get(url, config),
  post:   (url: string, data?: any, config?: any) => getClient().post(url, data, config),
  patch:  (url: string, data?: any, config?: any) => getClient().patch(url, data, config),
  put:    (url: string, data?: any, config?: any) => getClient().put(url, data, config),
  delete: (url: string, config?: any) => getClient().delete(url, config),
};

// Named API re-exports — use these in new/migrated pages
export {
  authApi, studentsApi, attendanceApi, billingApi, academicsApi,
  timetableApi, notificationsApi, transportApi, homeworkApi,
  libraryApi, inventoryApi, certificatesApi, communicationApi,
  hrApi, receptionApi, payrollApi, admissionsApi, examsApi, sessionsApi,
  bulkApi, behaviorApi,
} from '@schoolos/api-client';

// Auth helpers
export const setTokens   = (t: any)    => { localStorage.setItem('accessToken', t.accessToken); localStorage.setItem('refreshToken', t.refreshToken ?? ''); };
export const setTenantId = (id: string) => localStorage.setItem('tenantId', id);
