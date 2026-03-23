import React from 'react';
import { Settings as SettingsIcon, Save } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 data-testid="page-title" className="text-2xl font-bold text-white tracking-tight">Platform Settings</h1>
        <p className="text-slate-400 text-sm mt-1">Configure system-wide defaults and preferences</p>
      </div>

      <div className="space-y-6 max-w-2xl">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" /> General Settings
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Platform Name</label>
              <input
                type="text"
                defaultValue="SchoolOS"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Support Email</label>
              <input
                type="email"
                defaultValue="support@schoolos.com"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Default Trial Days</label>
              <input
                type="number"
                defaultValue="30"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Notification Channels</h2>
          <div className="space-y-3">
            {['Email Notifications', 'SMS Alerts', 'WhatsApp Messages', 'Push Notifications'].map((channel) => (
              <label key={channel} className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-slate-300">{channel}</span>
                <div className="w-11 h-6 bg-slate-700 rounded-full p-0.5 cursor-pointer">
                  <div className="w-5 h-5 bg-slate-500 rounded-full transition-transform" />
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Security</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Session Timeout (hours)</label>
              <input
                type="number"
                defaultValue="24"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="accent-orange-500 w-4 h-4" />
              <span className="text-sm text-slate-300">Require email verification for new users</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="accent-orange-500 w-4 h-4" />
              <span className="text-sm text-slate-300">Enable two-factor authentication for admins</span>
            </label>
          </div>
        </div>

        <button
          data-testid="save-settings-btn"
          className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg font-medium transition-colors"
        >
          <Save className="w-4 h-4" /> Save Settings
        </button>
      </div>
    </div>
  );
}
