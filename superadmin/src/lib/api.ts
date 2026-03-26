// superadmin/src/lib/api.ts

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// BUG 4 FIX: The superadmin app was sending Bearer tokens but never the
// x-tenant-id header. TenantMiddleware on the backend requires this header
// on every route except auth/(.*) and health. Without it every post-login
// API call gets a 401 "Missing tenant identifier" response — tables show
// empty and stats show zero even though data exists in the database.
const SUPERADMIN_TENANT = "schoolos-platform";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("sa_token") : null;
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type":  "application/json",
      "x-tenant-id":   SUPERADMIN_TENANT,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  get:    <T>(path: string)                => request<T>(path),
  post:   <T>(path: string, body: unknown) => request<T>(path, { method: "POST",   body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH",  body: JSON.stringify(body) }),
  delete: <T>(path: string)               => request<T>(path, { method: "DELETE" }),
};
