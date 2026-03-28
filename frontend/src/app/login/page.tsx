"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { authApi } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();

  const [step,    setStep]    = useState<1 | 2>(1);
  const [slug,    setSlug]    = useState("");
  const [email,   setEmail]   = useState("");
  const [password,setPassword]= useState("");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) { setStep(2); return; }

    setLoading(true);
    setError("");
    try {
      const data = await authApi.login({ email, password }, slug);

      // Store tokens
      localStorage.setItem("accessToken",  data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken ?? "");
      localStorage.setItem("tenantId",     slug);

      login(
        { ...data.user, tenantSlug: slug },
        data.accessToken,
        data.refreshToken,
      );

      router.push("/dashboard");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err.message ?? "Login failed. Check credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/30 mb-4">
            <svg viewBox="0 0 24 24" className="w-9 h-9 text-white fill-current">
              <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">SchoolOS</h1>
          <p className="text-blue-300 text-sm mt-1">
            {step === 1 ? "Enter your school ID to continue" : `Signing in to ${slug}`}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">

            {step === 1 ? (
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  School ID
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={e => setSlug(e.target.value.toLowerCase().trim())}
                  placeholder="e.g. greenwood-school"
                  required
                  autoFocus
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all"
                />
                <p className="text-slate-500 text-xs mt-2">
                  Your school's unique identifier (provided during onboarding)
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="admin@school.com"
                    required
                    autoFocus
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all"
                  />
                </div>
              </>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 mt-2"
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {loading ? "Signing in..." : step === 1 ? "Next →" : "Sign In"}
            </button>

            {step === 2 && (
              <button
                type="button"
                onClick={() => { setStep(1); setError(""); setEmail(""); setPassword(""); }}
                className="w-full py-2 text-slate-400 hover:text-slate-300 text-sm transition-colors"
              >
                ← Back to school selection
              </button>
            )}
          </form>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          © {new Date().getFullYear()} SchoolOS · Operating System for School Chains
        </p>
      </div>
    </div>
  );
}
