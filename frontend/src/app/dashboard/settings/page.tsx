"use client";
import { useState }     from "react";
import { PageHeader }   from "@/components/ui/page-header";
import { useAuthStore } from "@/lib/store";
import { useApi }       from "@/lib/hooks";
import { apiClient }    from "@/lib/api";
import { Save, Key, Shield, Globe } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { data: sessions } = useApi<any[]>("/academic-sessions");
  const currentSession = sessions?.find((s: any) => s.isCurrent);

  const [tab, setTab] = useState<"profile"|"security"|"system">("profile");

  // Password change
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg,    setPwMsg]    = useState("");

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) { setPwMsg("Passwords do not match"); return; }
    if (pwForm.next.length < 8)         { setPwMsg("Password must be at least 8 characters"); return; }
    setPwSaving(true); setPwMsg("");
    try {
      await apiClient.post("/auth/change-password", {
        currentPassword: pwForm.current,
        newPassword:     pwForm.next,
      });
      setPwMsg("Password changed successfully ✓");
      setPwForm({ current: "", next: "", confirm: "" });
    } catch (err: any) {
      setPwMsg(err?.response?.data?.message ?? "Failed to change password");
    } finally {
      setPwSaving(false);
    }
  };

  const tabs = [
    { id: "profile",  label: "Profile",       icon: Globe  },
    { id: "security", label: "Security",       icon: Shield },
    { id: "system",   label: "System Info",    icon: Key    },
  ] as const;

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your account and platform configuration" />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 mb-6">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === id ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* ── PROFILE TAB ── */}
      {tab === "profile" && (
        <div className="max-w-xl space-y-5">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
            <h2 className="font-semibold text-slate-900 mb-5">Your Account</h2>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-bold">
                {(user as any)?.firstName?.[0] ?? "A"}{(user as any)?.lastName?.[0] ?? ""}
              </div>
              <div>
                <p className="font-semibold text-slate-900">{(user as any)?.firstName} {(user as any)?.lastName}</p>
                <p className="text-sm text-slate-500">{(user as any)?.email}</p>
                <p className="text-xs text-blue-600 font-medium mt-0.5">{(user as any)?.role?.replace("_", " ")}</p>
              </div>
            </div>
            <div className="space-y-3 border-t border-slate-100 pt-4">
              {[
                { label: "Role",    value: (user as any)?.role?.replace(/_/g, " ") ?? "—" },
                { label: "Tenant",  value: localStorage.getItem("tenantId") ?? "—" },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-medium text-slate-900 font-mono text-xs">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SECURITY TAB ── */}
      {tab === "security" && (
        <div className="max-w-md">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
            <h2 className="font-semibold text-slate-900 mb-5">Change Password</h2>
            <form onSubmit={changePassword} className="space-y-4">
              {[
                { label: "Current Password", key: "current" },
                { label: "New Password",     key: "next"    },
                { label: "Confirm New Password", key: "confirm" },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>
                  <input type="password" required
                    value={(pwForm as any)[key]}
                    onChange={e => setPwForm(p => ({ ...p, [key]: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
              {pwMsg && (
                <p className={`text-sm ${pwMsg.includes("✓") ? "text-emerald-600" : "text-red-500"}`}>{pwMsg}</p>
              )}
              <button type="submit" disabled={pwSaving}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors">
                <Save className="w-4 h-4" />
                {pwSaving ? "Saving..." : "Change Password"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── SYSTEM TAB ── */}
      {tab === "system" && (
        <div className="max-w-2xl space-y-5">
          {/* Current session */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Active Session</h2>
            {currentSession ? (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Session Name", value: currentSession.name },
                  { label: "Session ID",   value: currentSession.id.substring(0, 16) + "..." },
                  { label: "Start Date",   value: new Date(currentSession.startDate).toLocaleDateString("en-IN") },
                  { label: "End Date",     value: new Date(currentSession.endDate).toLocaleDateString("en-IN") },
                  { label: "Status",       value: currentSession.isLocked ? "Locked" : "Active" },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-0.5">{label}</p>
                    <p className="text-sm font-medium text-slate-900 font-mono">{value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-400 text-sm">
                No active session. <a href="/dashboard/sessions" className="text-blue-600 hover:underline">Create one →</a>
              </div>
            )}
          </div>

          {/* API info */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
            <h2 className="font-semibold text-slate-900 mb-4">API Configuration</h2>
            <div className="space-y-3">
              {[
                { label: "API Base URL",  value: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1" },
                { label: "Swagger Docs", value: (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1") + "/docs" },
                { label: "Environment",  value: process.env.NODE_ENV ?? "development" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between gap-4">
                  <span className="text-sm text-slate-500 flex-shrink-0">{label}</span>
                  <span className="text-sm font-mono text-slate-700 break-all text-right">{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <a
                href={(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1") + "/docs"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                Open Swagger UI →
              </a>
            </div>
          </div>

          {/* Integrations status */}
	  {/* Notification Settings */}
<div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
  <div className="flex items-center justify-between mb-4">
    <h2 className="font-semibold text-slate-900">
      Communication & Notifications
    </h2>

    <a
      href="/dashboard/notifications/settings"
      className="text-xs text-blue-600 hover:text-blue-800"
    >
      Configure →
    </a>
  </div>

  <div className="space-y-3">

    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-700">
        SMS Provider
      </span>

      <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
        Manage
      </span>
    </div>

    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-700">
        Email Provider
      </span>

      <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
        Manage
      </span>
    </div>

    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-700">
        WhatsApp Provider
      </span>

      <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
        Manage
      </span>
    </div>

    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-700">
        Delivery Policies
      </span>

      <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700">
        Advanced
      </span>
    </div>

  </div>
</div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900">Integrations</h2>
              <a href="/dashboard/settings/integrations" className="text-xs text-blue-600 hover:text-blue-800">Configure →</a>
            </div>
            <div className="space-y-3">
              {[
                { name: "Razorpay (Student Billing)", env: "RAZORPAY_STUDENT_KEY_ID",   configured: false },
                { name: "SendGrid (Email)",           env: "SENDGRID_API_KEY",           configured: false },
                { name: "Twilio (SMS/WhatsApp)",      env: "TWILIO_ACCOUNT_SID",         configured: false },
                { name: "AWS S3 (File Storage)",      env: "AWS_ACCESS_KEY_ID",          configured: false },
                { name: "Firebase (Push)",            env: "FIREBASE_PROJECT_ID",        configured: false },
              ].map(({ name, configured }) => (
                <div key={name} className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">{name}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    configured
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}>
                    {configured ? "Configured" : "Not configured"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
