"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authApi } from "@/lib/api";

type Step = "email" | "otp" | "newpassword" | "done";

export default function ForgotPasswordPage() {
  const router       = useRouter();
  const params       = useSearchParams();
  const tenantSlug   = params.get("school") ?? "";

  const [step,        setStep]        = useState<Step>("email");
  const [slug,        setSlug]        = useState(tenantSlug);
  const [email,       setEmail]       = useState("");
  const [otp,         setOtp]         = useState("");
  const [password,    setPassword]    = useState("");
  const [confirmPw,   setConfirmPw]   = useState("");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      await authApi.forgotPassword(email, slug);
      setStep("otp");
    } catch (err: any) {
      // Show success regardless to prevent email enumeration
      setStep("otp");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPw) { setError("Passwords do not match."); return; }
    if (password.length < 8)   { setError("Password must be at least 8 characters."); return; }
    setLoading(true); setError("");
    try {

	    const data = await authApi.resetPassword({
  email,
  tenantId: slug,
  otp,
  newPassword: password,
});

      // Auto-login after reset
      if (data.accessToken) {
        localStorage.setItem("accessToken",  data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken ?? "");
        localStorage.setItem("tenantId",     slug);
        router.push("/dashboard");
      } else {
        setStep("done");
      }
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Invalid code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/30 mb-4">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-white fill-current">
              <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">SchoolOS</h1>
          <p className="text-blue-300 text-sm mt-1">
            {step === "email"       && "Reset your password"}
            {step === "otp"         && "Enter your reset code"}
            {step === "newpassword" && "Set a new password"}
            {step === "done"        && "Password updated!"}
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 shadow-2xl">

          {/* STEP 1: Email */}
          {step === "email" && (
            <form onSubmit={requestOtp} className="space-y-4">
              {!tenantSlug && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">School ID</label>
                  <input
                    required value={slug} onChange={e => setSlug(e.target.value.toLowerCase().trim())}
                    placeholder="greenwood-school"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-400 transition-all"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Email Address</label>
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="admin@school.com"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-400 transition-all"
                />
              </div>
              {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {loading ? "Sending..." : "Send reset code"}
              </button>
              <Link href="/login" className="block text-center text-slate-400 hover:text-slate-300 text-sm transition-colors">
                ← Back to sign in
              </Link>
            </form>
          )}

          {/* STEP 2: OTP */}
          {step === "otp" && (
            <div className="space-y-4">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3">
                <p className="text-blue-300 text-sm">A 6-digit code was sent to <strong>{email}</strong>. Check your inbox (and spam folder).</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">6-Digit Code</label>
                <input
                  value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 text-sm text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:border-blue-400 transition-all"
                />
              </div>
              <button
                onClick={() => otp.length === 6 && setStep("newpassword")}
                disabled={otp.length < 6}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm transition-all disabled:opacity-40"
              >
                Verify Code →
              </button>
              <button onClick={requestOtp} className="w-full py-2 text-slate-400 hover:text-slate-300 text-sm">
                Resend code
              </button>
            </div>
          )}

          {/* STEP 3: New Password */}
          {step === "newpassword" && (
            <form onSubmit={resetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">New Password</label>
                <input
                  type="password" required value={password} onChange={e => setPassword(e.target.value)} minLength={8}
                  placeholder="Min. 8 characters"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-400 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Confirm Password</label>
                <input
                  type="password" required value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Repeat your password"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-400 transition-all"
                />
              </div>
              {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {loading ? "Saving..." : "Set new password"}
              </button>
            </form>
          )}

          {/* STEP 4: Done */}
          {step === "done" && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-white font-semibold">Password updated!</p>
              <p className="text-slate-400 text-sm">You can now sign in with your new password.</p>
              <Link href="/login" className="block w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm text-center transition-all">
                Sign in →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
