// @schoolos/api-client is the canonical API layer.
// This file initialises it and re-exports for pages that haven't migrated yet.
// TODO: Remove apiClient usages in pages — use named endpoint APIs instead.

// @schoolos/api-client is the canonical API layer.
import { initApiClient, getClient } from '@schoolos/api-client';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000/api/v1';

initApiClient(API_URL);

//if (typeof window !== 'undefined') {
 // initApiClient(API_URL);
//}

export const apiClient = {
  get:    (url: string, config?: any) => getClient().get(url, config),
  post:   (url: string, data?: any, config?: any) => getClient().post(url, data, config),
  patch:  (url: string, data?: any, config?: any) => getClient().patch(url, data, config),
  put:    (url: string, data?: any, config?: any) => getClient().put(url, data, config),
  delete: (url: string, config?: any) => getClient().delete(url, config),
};

// Re-exporting from the package we just updated
export {
  authApi, studentsApi, attendanceApi, billingApi, academicsApi,
  timetableApi, notificationsApi, transportApi, homeworkApi,
  libraryApi, inventoryApi, certificatesApi, communicationApi,
  hrApi, receptionApi, payrollApi, admissionsApi, examsApi, sessionsApi,
  bulkApi, behaviorApi, staffApi,
} from '@schoolos/api-client';

export const setTokens   = (t: any)    => { 
  localStorage.setItem('accessToken', t.accessToken); 
  localStorage.setItem('refreshToken', t.refreshToken ?? ''); 
};
export const setTenantId = (id: string) => localStorage.setItem('tenantId', id);
