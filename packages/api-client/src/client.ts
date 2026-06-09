// Central axios instance used by all endpoints
import axios, { AxiosInstance } from 'axios';

let _client: AxiosInstance | null = null;
let _isRefreshing = false;
let _failedQueue: Array<{ resolve: (v: any) => void; reject: (e: any) => void }> = [];

function processQueue(error: any, token: string | null = null) {
  _failedQueue.forEach(p => error ? p.reject(error) : p.resolve(token));
  _failedQueue = [];
}

export function initApiClient(baseURL: string) {
  _client = axios.create({ baseURL, timeout: 15000, headers: { 'Content-Type': 'application/json' } });

  _client.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
      const token  = localStorage.getItem('accessToken');
      const tenant = localStorage.getItem('tenantId');
      const branch = localStorage.getItem('branchId') || (() => {
        try {
          const raw = localStorage.getItem('branch-storage');
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          return parsed?.state?.selectedBranchId ?? null;
        } catch { return null; }
      })();
      if (token)  config.headers.Authorization   = `Bearer ${token}`;
      if (tenant) config.headers['x-tenant-id'] = tenant;
      if (branch) config.headers['x-branch-id'] = branch;
    }
    return config;
  });

  _client.interceptors.response.use(
    res => res,
    async err => {
      const originalRequest = err.config;
      if (err?.response?.status === 401 && !originalRequest._retry && typeof window !== 'undefined') {
        if (window.location.pathname === '/login') return Promise.reject(err);

        if (_isRefreshing) {
          return new Promise((resolve, reject) => {
            _failedQueue.push({ resolve, reject });
          }).then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return _client!(originalRequest);
          });
        }

        originalRequest._retry = true;
        _isRefreshing = true;

        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          localStorage.clear();
          window.location.href = '/login';
          return Promise.reject(err);
        }

        try {
          const res = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
          const newToken = res.data.accessToken;
          localStorage.setItem('accessToken', newToken);
          if (res.data.refreshToken) localStorage.setItem('refreshToken', res.data.refreshToken);
          processQueue(null, newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return _client!(originalRequest);
        } catch (refreshErr) {
          processQueue(refreshErr, null);
          localStorage.clear();
          window.location.href = '/login';
          return Promise.reject(refreshErr);
        } finally {
          _isRefreshing = false;
        }
      }
      return Promise.reject(err);
    }
  );

  return _client;
}

export function getClient(): AxiosInstance {
  if (!_client) throw new Error('API client not initialized. Call initApiClient(baseURL) first.');
  return _client;
}
