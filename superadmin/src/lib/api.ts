const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("sa_token") : null;
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
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
  get:    <T>(path: string)                       => request<T>(path),
  post:   <T>(path: string, body: unknown)        => request<T>(path, { method: "POST",  body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown)        => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string)                       => request<T>(path, { method: "DELETE" }),
};
