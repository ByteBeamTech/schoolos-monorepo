"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSAStore } from "@/lib/store";

export default function LoginPage() {
  const router = useRouter();
  const login  = useSAStore((s) => s.login);
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": "schoolos-platform",
        },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Invalid credentials"); return; }
      if (data.user?.role !== "SUPER_ADMIN") { setError("Access denied — SUPER_ADMIN role required"); return; }
      login(data.user, data.accessToken);
      router.push("/dashboard");
    } catch {
      setError("Cannot reach server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-orange-500 rounded-xl mb-4">
            <span className="text-white text-xl font-bold">S</span>
          </div>
          <p className="font-bold text-white text-xl">SchoolOS</p>
          <p className="text-orange-400 text-xs font-semibold tracking-widest uppercase mt-1">Platform Console</p>
        </div>
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-7">
          <h1 className="text-lg font-bold text-white mb-1">Sign in</h1>
          <p className="text-slate-400 text-sm mb-6">Platform admin access only</p>
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-lg mb-5">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Email</label>
              <input
                type="email" autoFocus required
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@schoolos.com"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Password</label>
              <input
                type="password" required
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
