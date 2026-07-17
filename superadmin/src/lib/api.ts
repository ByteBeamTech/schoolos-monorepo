// superadmin/src/lib/api.ts

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// BUG 4 FIX: The superadmin app was sending Bearer tokens but never the
// x-tenant-id header. TenantMiddleware on the backend requires this header
// on every route except auth/(.*) and health. Without it every post-login
// API call gets a 401 "Missing tenant identifier" response — tables show
// empty and stats show zero even though data exists in the database.
const SUPERADMIN_TENANT = "schoolos-platform";

// UI-0.5: Centralized auth-failure handling. Previously this logic only
// existed in the now-deleted lib/use-api.ts, so only its one consumer
// (platform-layout.tsx's sidebar) got auto-logged-out on a real 401 —
// every other page's calls just surfaced a generic error string and left
// a dead session sitting in localStorage. Living here instead means every
// caller of api.get/post/patch/delete gets the same behavior uniformly,
// whether it goes through the useApi hook or is called directly. This is
// "one auth failure strategy" per UI-0.5 Task 1's own requirement — not a
// new feature, just moved to the one place all requests already pass
// through.
function handleAuthFailure() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("sa_token");
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

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
    if (res.status === 401) handleAuthFailure();
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

