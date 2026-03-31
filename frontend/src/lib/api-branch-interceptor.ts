/**
 * api-branch-interceptor.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Axios request interceptor that automatically adds ?branchId= to every GET
 * and x-branch-id header to every mutating request.
 *
 * USAGE: Call setupBranchInterceptor(axiosInstance) once — at app startup
 *        in layout.tsx or your api.ts file.
 *
 * IMPORTANT: The interceptor reads directly from Zustand store state
 *            (NOT via hook) — hooks can only be used in React components.
 */
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { useBranchStore } from './branch-store';

export function setupBranchInterceptor(client: AxiosInstance) {
  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      // Read branchId from store state (synchronous, outside React)
      const branchId = useBranchStore.getState().selectedBranchId;

      if (!branchId) return config;  // SUPER_ADMIN hasn't selected a branch yet

      // Add as query param for GET / DELETE
      if (config.method === 'get' || config.method === 'delete') {
        config.params = { branchId, ...(config.params ?? {}) };
      }

      // Add as header for POST / PUT / PATCH (body might be FormData)
      config.headers['x-branch-id'] = branchId;

      return config;
    },
    (error) => Promise.reject(error),
  );
}
