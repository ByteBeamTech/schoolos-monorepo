"use client";
/**
 * Inventory Page — Complete flow:
 *   Tab 1: Vendors        → list + add vendor
 *   Tab 2: Purchase Orders → list + create PO from vendor
 *   Tab 3: Stock           → list + GRN entry
 *   Tab 4: Issues          → issue item to student/staff + returns
 *   Tab 5: Assets          → assets + maintenance
 */
import { useState, useCallback } from "react";
import {
  Package, Plus, Building2, ShoppingCart,
  ArrowDownToLine, ArrowUpFromLine, Wrench, AlertTriangle,
} from "lucide-react";
import { PageHeader }  from "@/components/ui/page-header";
import { StatCard }    from "@/components/ui/stat-card";
import { Badge }       from "@/components/ui/badge";
import { useApi }      from "@/lib/hooks";
import { apiClient }   from "@/lib/api";

type Tab = "vendors" | "orders" | "stock" | "issues" | "assets";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "vendors",  label: "Vendors",         icon: <Building2 className="w-4 h-4" /> },
  { id: "orders",   label: "Purchase Orders", icon: <ShoppingCart className="w-4 h-4" /> },
  { id: "stock",    label: "Stock",           icon: <Package className="w-4 h-4" /> },
  { id: "issues",   label: "Issue Items",     icon: <ArrowUpFromLine className="w-4 h-4" /> },
  { id: "assets",   label: "Assets",          icon: <Wrench className="w-4 h-4" /> },
];

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>("stock");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Data hooks
  const { data: vendors,   loading: vLoad, refetch: rv } = useApi<any[]>("/inventory/vendors");
  const { data: orders,    loading: oLoad, refetch: ro } = useApi<any[]>("/inventory/purchase-orders");
  const { data: stock,     loading: sLoad, refetch: rs } = useApi<any[]>("/inventory/stock");
  const { data: lowStock,  loading: lLoad               } = useApi<any[]>("/inventory/stock/low");
  const { data: issues,    loading: iLoad, refetch: ri } = useApi<any[]>("/inventory/issues");
  const { data: assets,    loading: aLoad, refetch: ra } = useApi<any[]>("/inventory/assets");

  // Forms
  const [vendorForm, setVendorForm] = useState({ name: "", contactName: "", phone: "", email: "", category: "GENERAL", gstNumber: "" });
  const [poForm, setPoForm]         = useState({ vendorId: "", poNumber: "", expectedAt: "", notes: "" });
  const [stockEntryForm, setStockEntryForm] = useState({ stockItemId: "", quantity: "0", entryType: "PURCHASE", remarks: "" });
  const [issueForm, setIssueForm]   = useState({ stockItemId: "", issueType: "STUDENT", entityId: "", quantity: "1", purpose: "", returnDue: "" });
  const [assetForm, setAssetForm]   = useState({ name: "", category: "FURNITURE", serialNumber: "", purchaseDate: "", purchasePrice: "", location: "", condition: "GOOD" });

  const handleSave = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (tab === "vendors") {
        await apiClient.post("/inventory/vendors", vendorForm);
        rv();
      } else if (tab === "orders") {
        await apiClient.post("/inventory/purchase-orders", poForm);
        ro();
      } else if (tab === "stock") {
        await apiClient.post("/inventory/stock/entry", {
          ...stockEntryForm,
          quantity: Number(stockEntryForm.quantity),
        });
        rs();
      } else if (tab === "issues") {
        await apiClient.post("/inventory/issues", {
          ...issueForm,
          quantity: Number(issueForm.quantity),
        });
        ri();
      } else if (tab === "assets") {
        await apiClient.post("/inventory/assets", {
          ...assetForm,
          purchasePrice: assetForm.purchasePrice ? parseFloat(assetForm.purchasePrice) : undefined,
        });
        ra();
      }
      setShowForm(false);
    } catch (err: any) {
      alert(err?.response?.data?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [tab, vendorForm, poForm, stockEntryForm, issueForm, assetForm]);

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Vendor → PO → Stock → Issue — complete flow"
        action={
          <button
            onClick={() => setShowForm(p => !p)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add {tab === "vendors" ? "Vendor" : tab === "orders" ? "PO" : tab === "stock" ? "Stock Entry" : tab === "issues" ? "Issue" : "Asset"}
          </button>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard label="Vendors"        value={vendors?.length   ?? 0} icon={<Building2 className="w-5 h-5"/>} color="blue"   loading={vLoad} />
        <StatCard label="Open POs"       value={orders?.filter((o:any) => o.status !== 'RECEIVED' && o.status !== 'CANCELLED').length ?? 0} icon={<ShoppingCart className="w-5 h-5"/>} color="purple" loading={oLoad} />
        <StatCard label="Stock Items"    value={stock?.length     ?? 0} icon={<Package className="w-5 h-5"/>}  color="green"  loading={sLoad} />
        <StatCard label="Low Stock"      value={lowStock?.length  ?? 0} icon={<AlertTriangle className="w-5 h-5"/>} color="red" loading={lLoad} />
        <StatCard label="Active Issues"  value={issues?.filter((i:any) => i.status === 'ISSUED').length ?? 0} icon={<ArrowUpFromLine className="w-5 h-5"/>} color="amber" loading={iLoad} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 mb-5 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setShowForm(false); }}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.id ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Add Forms ───────────────────────────────────────────────────────── */}
      {showForm && (
        <div className="bg-white border border-blue-100 rounded-xl p-5 mb-5 shadow-sm">
          <h3 className="font-semibold text-slate-900 text-sm mb-4">
            Add {tab === "vendors" ? "Vendor" : tab === "orders" ? "Purchase Order" : tab === "stock" ? "Stock Entry (GRN)" : tab === "issues" ? "Issue Item" : "Asset"}
          </h3>

          <form onSubmit={handleSave}>
            {/* VENDOR FORM */}
            {tab === "vendors" && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { l: "Vendor Name *",  k: "name",        req: true,  obj: vendorForm, set: setVendorForm },
                  { l: "Contact Name",   k: "contactName", obj: vendorForm, set: setVendorForm },
                  { l: "Phone",         k: "phone",        obj: vendorForm, set: setVendorForm },
                  { l: "Email",         k: "email",        obj: vendorForm, set: setVendorForm },
                  { l: "GST Number",    k: "gstNumber",    obj: vendorForm, set: setVendorForm },
                  { l: "Category",      k: "category",     obj: vendorForm, set: setVendorForm },
                ].map(({ l, k, req, obj, set }) => (
                  <div key={k}>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{l}</label>
                    <input
                      type="text"
                      required={req}
                      value={(obj as any)[k]}
                      onChange={e => (set as any)((p: any) => ({ ...p, [k]: e.target.value }))}
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* PO FORM */}
            {tab === "orders" && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Vendor *</label>
                  <select
                    required
                    value={poForm.vendorId}
                    onChange={e => setPoForm(p => ({ ...p, vendorId: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select vendor</option>
                    {(vendors ?? []).map((v: any) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">PO Number *</label>
                  <input
                    required
                    value={poForm.poNumber}
                    onChange={e => setPoForm(p => ({ ...p, poNumber: e.target.value }))}
                    placeholder="PO-2026-001"
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Expected Delivery</label>
                  <input
                    type="date"
                    value={poForm.expectedAt}
                    onChange={e => setPoForm(p => ({ ...p, expectedAt: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Notes</label>
                  <textarea
                    rows={2}
                    value={poForm.notes}
                    onChange={e => setPoForm(p => ({ ...p, notes: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* STOCK ENTRY FORM */}
            {tab === "stock" && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Stock Item *</label>
                  <select
                    required
                    value={stockEntryForm.stockItemId}
                    onChange={e => setStockEntryForm(p => ({ ...p, stockItemId: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select item</option>
                    {(stock ?? []).map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name} (Qty: {s.quantity})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Entry Type *</label>
                  <select
                    value={stockEntryForm.entryType}
                    onChange={e => setStockEntryForm(p => ({ ...p, entryType: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {["PURCHASE", "RETURN", "ADJUSTMENT", "OPENING_BALANCE"].map(t => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Quantity *</label>
                  <input
                    type="number"
                    required
                    value={stockEntryForm.quantity}
                    onChange={e => setStockEntryForm(p => ({ ...p, quantity: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Remarks</label>
                  <input
                    value={stockEntryForm.remarks}
                    onChange={e => setStockEntryForm(p => ({ ...p, remarks: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* ISSUE FORM */}
            {tab === "issues" && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Stock Item *</label>
                  <select
                    required
                    value={issueForm.stockItemId}
                    onChange={e => setIssueForm(p => ({ ...p, stockItemId: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select item</option>
                    {(stock ?? []).filter((s: any) => s.quantity > 0).map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name} (Available: {s.quantity})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Issue To *</label>
                  <select
                    value={issueForm.issueType}
                    onChange={e => setIssueForm(p => ({ ...p, issueType: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="STUDENT">Student</option>
                    <option value="STAFF">Staff</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Entity ID (Student/Staff) *</label>
                  <input
                    required
                    value={issueForm.entityId}
                    onChange={e => setIssueForm(p => ({ ...p, entityId: e.target.value }))}
                    placeholder="Paste student or staff ID"
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Quantity *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={issueForm.quantity}
                    onChange={e => setIssueForm(p => ({ ...p, quantity: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Return Due</label>
                  <input
                    type="date"
                    value={issueForm.returnDue}
                    onChange={e => setIssueForm(p => ({ ...p, returnDue: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Purpose</label>
                  <input
                    value={issueForm.purpose}
                    onChange={e => setIssueForm(p => ({ ...p, purpose: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* ASSET FORM */}
            {tab === "assets" && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { l: "Asset Name *",     k: "name",          req: true  },
                  { l: "Serial Number",    k: "serialNumber"              },
                  { l: "Location",         k: "location"                  },
                  { l: "Purchase Price",   k: "purchasePrice", type: "number" },
                ].map(({ l, k, req, type }) => (
                  <div key={k}>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{l}</label>
                    <input
                      type={type ?? "text"}
                      required={req}
                      value={(assetForm as any)[k]}
                      onChange={e => setAssetForm(p => ({ ...p, [k]: e.target.value }))}
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Category</label>
                  <select
                    value={assetForm.category}
                    onChange={e => setAssetForm(p => ({ ...p, category: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {["FURNITURE", "ELECTRONICS", "VEHICLE", "SPORTS_EQUIPMENT", "LAB_EQUIPMENT"].map(c => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Condition</label>
                  <select
                    value={assetForm.condition}
                    onChange={e => setAssetForm(p => ({ ...p, condition: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {["GOOD", "FAIR", "POOR", "UNDER_REPAIR", "DISPOSED"].map(c => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Purchase Date</label>
                  <input
                    type="date"
                    value={assetForm.purchaseDate}
                    onChange={e => setAssetForm(p => ({ ...p, purchaseDate: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-4 pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Tables ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {/* VENDORS */}
        {tab === "vendors" && (
          <SimpleTable
            cols={["Vendor", "Contact", "Category", "GST", "Status"]}
            loading={vLoad}
            empty="No vendors yet"
            rows={vendors ?? []}
            renderRow={(v: any) => (
              <tr key={v.id} className="hover:bg-slate-50 divide-x divide-slate-50">
                <td className="px-5 py-3.5 font-medium text-slate-900">{v.name}</td>
                <td className="px-5 py-3.5 text-slate-500 text-sm">{v.contactName ?? "—"}<br/><span className="text-xs text-slate-400">{v.phone}</span></td>
                <td className="px-5 py-3.5 text-slate-500">{v.category ?? "—"}</td>
                <td className="px-5 py-3.5 font-mono text-xs text-slate-400">{v.gstNumber ?? "—"}</td>
                <td className="px-5 py-3.5"><Badge label={v.isActive ? "Active" : "Inactive"} variant={v.isActive ? "success" : "error"} /></td>
              </tr>
            )}
          />
        )}

        {/* PURCHASE ORDERS */}
        {tab === "orders" && (
          <SimpleTable
            cols={["PO Number", "Vendor", "Total", "Status", "Expected"]}
            loading={oLoad}
            empty="No purchase orders yet"
            rows={orders ?? []}
            renderRow={(o: any) => (
              <tr key={o.id} className="hover:bg-slate-50">
                <td className="px-5 py-3.5 font-mono text-sm text-slate-700">{o.poNumber}</td>
                <td className="px-5 py-3.5 text-slate-700">{o.vendor?.name ?? o.vendorId}</td>
                <td className="px-5 py-3.5 font-semibold text-slate-900">₹{Number(o.totalAmount).toLocaleString("en-IN")}</td>
                <td className="px-5 py-3.5">
                  <Badge label={o.status} variant={o.status === "RECEIVED" ? "success" : o.status === "CANCELLED" ? "error" : "warning"} />
                </td>
                <td className="px-5 py-3.5 text-xs text-slate-400">{o.expectedAt ? new Date(o.expectedAt).toLocaleDateString("en-IN") : "—"}</td>
              </tr>
            )}
          />
        )}

        {/* STOCK */}
        {tab === "stock" && (
          <SimpleTable
            cols={["Item", "Category", "Unit", "Qty", "Min Qty", "Status"]}
            loading={sLoad}
            empty="No stock items yet"
            rows={stock ?? []}
            renderRow={(s: any) => (
              <tr key={s.id} className={`hover:bg-slate-50 ${s.quantity <= s.minQuantity ? "bg-red-50/30" : ""}`}>
                <td className="px-5 py-3.5 font-medium text-slate-900">{s.name}<br/><span className="text-xs text-slate-400 font-mono">{s.sku}</span></td>
                <td className="px-5 py-3.5 text-slate-500">{s.category}</td>
                <td className="px-5 py-3.5 text-slate-500">{s.unit}</td>
                <td className="px-5 py-3.5 font-semibold text-slate-800">{s.quantity}</td>
                <td className="px-5 py-3.5 text-slate-500">{s.minQuantity}</td>
                <td className="px-5 py-3.5">
                  {s.quantity <= s.minQuantity
                    ? <Badge label="Low Stock" variant="error" />
                    : <Badge label="OK" variant="success" />}
                </td>
              </tr>
            )}
          />
        )}

        {/* ISSUES */}
        {tab === "issues" && (
          <SimpleTable
            cols={["Item", "Issued To", "Type", "Qty", "Purpose", "Return Due", "Status"]}
            loading={iLoad}
            empty="No issues yet"
            rows={issues ?? []}
            renderRow={(i: any) => (
              <tr key={i.id} className="hover:bg-slate-50">
                <td className="px-5 py-3.5 font-medium text-slate-900">{i.stockItem?.name ?? i.stockItemId}</td>
                <td className="px-5 py-3.5 font-mono text-xs text-slate-600">{i.entityId}</td>
                <td className="px-5 py-3.5"><Badge label={i.issueType} variant="neutral" /></td>
                <td className="px-5 py-3.5 font-semibold text-slate-800">{i.quantity}</td>
                <td className="px-5 py-3.5 text-slate-500 text-sm">{i.purpose ?? "—"}</td>
                <td className="px-5 py-3.5 text-xs text-slate-400">{i.returnDue ? new Date(i.returnDue).toLocaleDateString("en-IN") : "—"}</td>
                <td className="px-5 py-3.5">
                  <Badge label={i.status} variant={i.status === "RETURNED" ? "success" : i.status === "LOST" ? "error" : "warning"} />
                </td>
              </tr>
            )}
          />
        )}

        {/* ASSETS */}
        {tab === "assets" && (
          <SimpleTable
            cols={["Asset", "Category", "Serial", "Location", "Condition", "Last Maintenance"]}
            loading={aLoad}
            empty="No assets yet"
            rows={assets ?? []}
            renderRow={(a: any) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-5 py-3.5 font-medium text-slate-900">{a.name}</td>
                <td className="px-5 py-3.5 text-slate-500">{a.category}</td>
                <td className="px-5 py-3.5 font-mono text-xs text-slate-400">{a.serialNumber ?? "—"}</td>
                <td className="px-5 py-3.5 text-slate-500">{a.location ?? "—"}</td>
                <td className="px-5 py-3.5">
                  <Badge label={a.condition} variant={a.condition === "GOOD" ? "success" : a.condition === "FAIR" ? "warning" : "error"} />
                </td>
                <td className="px-5 py-3.5 text-xs text-slate-400">
                  {a.maintenanceLogs?.[0]?.performedAt ? new Date(a.maintenanceLogs[0].performedAt).toLocaleDateString("en-IN") : "—"}
                </td>
              </tr>
            )}
          />
        )}
      </div>
    </div>
  );
}

function SimpleTable({
  cols, loading, empty, rows, renderRow,
}: {
  cols: string[];
  loading: boolean;
  empty: string;
  rows: any[];
  renderRow: (row: any) => React.ReactNode;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-slate-50 border-b border-slate-100">
          {cols.map(h => (
            <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {loading ? (
          [...Array(5)].map((_, i) => (
            <tr key={i}>
              {[...Array(cols.length)].map((__, j) => (
                <td key={j} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
              ))}
            </tr>
          ))
        ) : rows.length === 0 ? (
          <tr>
            <td colSpan={cols.length} className="px-5 py-16 text-center text-slate-400 text-sm">{empty}</td>
          </tr>
        ) : (
          rows.map(renderRow)
        )}
      </tbody>
    </table>
  );
}
