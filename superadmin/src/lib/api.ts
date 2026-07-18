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
// whether it goes through the useApi hook or is called directly.
function handleAuthFailure() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("sa_token");
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

// Regression fix (found via real usage after UI-0.5 shipped): naively
// force-logging-out on *every* 401 was wrong. Several backend routes
// (tenant-admin.controller.ts's toggle-feature, support.controller.ts's
// admin/* routes) had the exact SA-1A bug pattern — missing
// @SuperadminRoute(), so the global JwtGuard rejects a perfectly valid
// superadmin token with "Invalid token signature" before RolesGuard even
// runs. Under blanket-logout, every one of those pre-existing backend bugs
// silently became "click this button, get logged out" — destroying the
// user's session and context for a problem a fresh login can't actually
// fix (the route is still broken either way).
//
// Fix: only force logout when the session is *actually* expired. We
// determine this by decoding the token's own `exp` claim client-side and
// comparing it to the current time — this is authoritative and doesn't
// depend on the backend's error message wording, which is fragile (see
// core/auth/guards/jwt.guard.ts's handleRequest — it only ever throws a
// human-readable string, e.g. "Invalid token signature.", "Access token
// expired...", never a structured code). Any other 401 (wrong-guard,
// malformed request, etc.) now just surfaces as an inline error and keeps
// the session alive, since forcing a logout wouldn't fix a server-side
// route misconfiguration anyway.
//
// TODO (tech debt, flagged not fixed): if the backend ever returns a
// structured error code (e.g. { code: 'TOKEN_EXPIRED' }) instead of only
// a message string, prefer that here directly instead of this decode.
function decodeJwtExpiryMs(token: string): number | null {
  try {
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null; // malformed/undecodable token
  }
}

function isSessionActuallyExpired(token: string | null): boolean {
  if (!token) return true;               // nothing to keep alive
  const expMs = decodeJwtExpiryMs(token);
  if (expMs === null) return true;        // can't verify — treat as invalid
  return Date.now() >= expMs;
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
    if (res.status === 401 && isSessionActuallyExpired(token)) handleAuthFailure();
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

