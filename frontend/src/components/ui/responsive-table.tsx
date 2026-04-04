/**
 * responsive-table.tsx — src/components/ui/responsive-table.tsx
 *
 * On ≥768px: renders a standard <table>
 * On  <768px: renders stacked cards (one per row)
 *
 * Usage:
 *   <ResponsiveTable
 *     columns={[
 *       { key: "name",   label: "Student",    primary: true },
 *       { key: "adm",    label: "Adm. No.",   mono: true },
 *       { key: "class",  label: "Class" },
 *       { key: "status", label: "Status",     render: (v) => <Badge label={v} /> },
 *     ]}
 *     rows={students}
 *     loading={loading}
 *     emptyTitle="No students yet"
 *     emptyMessage="Add your first student to get started."
 *     onRowClick={(row) => router.push(`/dashboard/students/${row.id}`)}
 *   />
 */
"use client";
import { Users } from "lucide-react";

export interface TableColumn<T = any> {
  key:      string;              // keyof row object, or a custom key
  label:    string;
  primary?: boolean;             // bold on mobile card header
  mono?:    boolean;             // monospace font
  hide?:    "mobile" | "never";  // hide on mobile
  render?:  (value: any, row: T) => React.ReactNode;
  width?:   string;              // e.g. "120px"
}

interface Props<T = any> {
  columns:     TableColumn<T>[];
  rows:        T[];
  loading?:    boolean;
  emptyTitle?: string;
  emptyMessage?:string;
  emptyIcon?:  React.ReactNode;
  onRowClick?: (row: T) => void;
  getRowKey?:  (row: T) => string;
  actions?:    (row: T) => React.ReactNode;
  skeletonRows?: number;
}

function getValue(row: any, key: string): any {
  return key.split(".").reduce((obj, k) => obj?.[k], row);
}

export function ResponsiveTable<T extends Record<string, any>>({
  columns, rows, loading, emptyTitle = "No data",
  emptyMessage, emptyIcon, onRowClick, getRowKey, actions,
  skeletonRows = 6,
}: Props<T>) {

  const visibleCols = columns.filter(c => c.hide !== "mobile" || true);
  const mobileCols  = columns.filter(c => c.hide !== "mobile");
  const desktopCols = columns;

  if (loading) {
    return (
      <div className="table-wrap">
        {/* Desktop skeleton */}
        <table className="hidden md:table w-full">
          <thead>
            <tr>
              {desktopCols.map(c => (
                <th key={c.key} style={{ width: c.width }}>{c.label}</th>
              ))}
              {actions && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {[...Array(skeletonRows)].map((_, i) => (
              <tr key={i}>
                {desktopCols.map(c => (
                  <td key={c.key}>
                    <div className="skeleton h-4" style={{ width: c.primary ? "140px" : "80px" }} />
                  </td>
                ))}
                {actions && <td><div className="skeleton h-4 w-20" /></td>}
              </tr>
            ))}
          </tbody>
        </table>
        {/* Mobile skeleton */}
        <div className="md:hidden divide-y" style={{ borderColor: "var(--border-light)" }}>
          {[...Array(skeletonRows)].map((_, i) => (
            <div key={i} className="p-4 space-y-2">
              <div className="skeleton h-4 w-32" />
              <div className="skeleton h-3 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="table-wrap">
        <div className="empty-state">
          <div className="empty-state-icon">
            {emptyIcon ?? <Users className="w-6 h-6" />}
          </div>
          <p className="empty-state-title">{emptyTitle}</p>
          {emptyMessage && <p className="empty-state-desc">{emptyMessage}</p>}
        </div>
      </div>
    );
  }

  const rowKey = getRowKey ?? ((row: T) => row.id ?? JSON.stringify(row));

  return (
    <div className="table-wrap">
      {/* ── Desktop table ─────────────────────────────────────────────────── */}
      <div className="hidden md:block overflow-x-auto">
        <table>
          <thead>
            <tr>
              {desktopCols.map(c => (
                <th key={c.key} style={{ width: c.width }}>{c.label}</th>
              ))}
              {actions && <th style={{ textAlign: "right" }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr
                key={rowKey(row)}
                onClick={() => onRowClick?.(row)}
                style={{ cursor: onRowClick ? "pointer" : "default" }}
              >
                {desktopCols.map(c => {
                  const val = getValue(row, c.key);
                  return (
                    <td key={c.key} style={{
                      fontFamily: c.mono ? "var(--font-mono, monospace)" : undefined,
                      fontWeight: c.primary ? "600" : undefined,
                      color:      c.primary ? "var(--text-primary)" : undefined,
                      fontSize:   c.mono ? "12px" : undefined,
                    }}>
                      {c.render ? c.render(val, row) : (val ?? "—")}
                    </td>
                  );
                })}
                {actions && (
                  <td style={{ textAlign: "right" }} onClick={e => e.stopPropagation()}>
                    {actions(row)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Mobile cards ──────────────────────────────────────────────────── */}
      <div className="md:hidden">
        {rows.map(row => {
          const primaryCol = mobileCols.find(c => c.primary);
          const otherCols  = mobileCols.filter(c => !c.primary && c.hide !== "mobile");
          return (
            <div
              key={rowKey(row)}
              onClick={() => onRowClick?.(row)}
              className="p-4 border-b"
              style={{
                borderColor: "var(--border-light)",
                cursor:      onRowClick ? "pointer" : "default",
              }}
            >
              {/* Primary info */}
              {primaryCol && (
                <div className="mb-2">
                  <p style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>
                    {primaryCol.render
                      ? primaryCol.render(getValue(row, primaryCol.key), row)
                      : getValue(row, primaryCol.key) ?? "—"}
                  </p>
                </div>
              )}
              {/* Secondary fields in a grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "6px 16px" }}>
                {otherCols.slice(0, 4).map(c => {
                  const val = getValue(row, c.key);
                  return (
                    <div key={c.key}>
                      <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)", marginBottom: 2 }}>
                        {c.label}
                      </p>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: c.mono ? "monospace" : undefined }}>
                        {c.render ? c.render(val, row) : (val ?? "—")}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Actions */}
              {actions && (
                <div className="mt-3 pt-2.5 border-t flex justify-end"
                  style={{ borderColor: "var(--border-light)" }}
                  onClick={e => e.stopPropagation()}>
                  {actions(row)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
