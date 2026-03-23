// Central axios instance used by all endpoints
import axios, { AxiosInstance } from 'axios';

let _client: AxiosInstance | null = null;

export function initApiClient(baseURL: string) {
  _client = axios.create({ baseURL, timeout: 15000, headers: { 'Content-Type': 'application/json' } });

  _client.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
      const token  = localStorage.getItem('accessToken');
      const tenant = localStorage.getItem('tenantId');
      if (token)  config.headers.Authorization    = `Bearer ${token}`;
      if (tenant) config.headers['x-tenant-id']  = tenant;
    }
    return config;
  });

  _client.interceptors.response.use(
    res => res,
    err => {
      if (err?.response?.status === 401 && typeof window !== 'undefined') {
        if (window.location.pathname !== '/login') {
          localStorage.clear();
          window.location.href = '/login';
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
