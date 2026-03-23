"use client";
import { useState } from "react";
import { Tag, Plus } from "lucide-react";

// Coupons stored client-side for now (pending CouponModel migration)
const MOCK_COUPONS = [
  { code: "SCHOOL50",  discount: 50,  type: "PERCENT", uses: 12, maxUses: 100, expiresAt: "2026-12-31", status: "ACTIVE"   },
  { code: "FLAT2000",  discount: 2000,type: "FLAT",    uses: 3,  maxUses: 50,  expiresAt: "2026-06-30", status: "ACTIVE"   },
  { code: "LAUNCH2025",discount: 30,  type: "PERCENT", uses: 48, maxUses: 50,  expiresAt: "2025-12-31", status: "EXPIRED"  },
];

export default function CouponsPage() {
  const [coupons, setCoupons]   = useState(MOCK_COUPONS);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ code: "", discount: "", type: "PERCENT", maxUses: "", expiresAt: "" });
  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    setCoupons(p => [...p, {
      code: form.code.toUpperCase(), discount: parseFloat(form.discount),
      type: form.type, uses: 0, maxUses: parseInt(form.maxUses),
      expiresAt: form.expiresAt, status: "ACTIVE",
    }]);
    setShowForm(false);
    setForm({ code: "", discount: "", type: "PERCENT", maxUses: "", expiresAt: "" });
  };

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Coupons</h1>
          <p className="text-slate-400 text-sm mt-1">Promo codes for discounts on SaaS subscriptions</p>
        </div>
        <button onClick={() => setShowForm(p => !p)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg font-medium transition-colors">
          <Plus className="w-4 h-4" /> New coupon
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 mb-5">
          <form onSubmit={create} className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Code *</label>
              <input required type="text" placeholder="SCHOOL50" value={form.code} onChange={f("code")}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-orange-500 uppercase" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Discount *</label>
              <input required type="number" placeholder="50" value={form.discount} onChange={f("discount")}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Type</label>
              <select value={form.type} onChange={f("type")}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-orange-500">
                <option value="PERCENT">Percent (%)</option>
                <option value="FLAT">Flat (₹)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Max uses</label>
              <input type="number" placeholder="100" value={form.maxUses} onChange={f("maxUses")}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Expires</label>
              <input type="date" value={form.expiresAt} onChange={f("expiresAt")}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-orange-500" />
            </div>
            <div className="md:col-span-5 flex gap-3">
              <button type="submit" className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg font-medium transition-colors">Create coupon</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-800 text-slate-400 text-sm rounded-lg">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-800">
            {["Code","Discount","Type","Used","Max uses","Usage %","Expires","Status"].map(h => (
              <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr></thead>
          <tbody className="divide-y divide-slate-800/50">
            {coupons.map((c) => (
              <tr key={c.code} className="hover:bg-slate-800/30">
                <td className="px-5 py-3.5 font-mono font-bold text-orange-400">{c.code}</td>
                <td className="px-5 py-3.5 text-slate-200 font-semibold">
                  {c.type === "PERCENT" ? `${c.discount}%` : `₹${c.discount.toLocaleString("en-IN")}`}
                </td>
                <td className="px-5 py-3.5 text-slate-500 text-xs">{c.type}</td>
                <td className="px-5 py-3.5 text-slate-300">{c.uses}</td>
                <td className="px-5 py-3.5 text-slate-400">{c.maxUses || "∞"}</td>
                <td className="px-5 py-3.5">
                  {c.maxUses ? (
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500 rounded-full" style={{ width: `${Math.round(c.uses / c.maxUses * 100)}%` }} />
                      </div>
                      <span className="text-xs text-slate-400">{Math.round(c.uses / c.maxUses * 100)}%</span>
                    </div>
                  ) : "—"}
                </td>
                <td className="px-5 py-3.5 text-xs text-slate-400">{c.expiresAt}</td>
                <td className="px-5 py-3.5">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    c.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-700 text-slate-400"
                  }`}>{c.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
