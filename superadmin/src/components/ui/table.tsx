interface Col<T> { key: string; label: string; render: (row: T) => React.ReactNode; width?: string; }
interface Props<T> { cols: Col<T>[]; rows: T[]; loading?: boolean; empty?: string; onRow?: (row: T) => void; }

export function Table<T extends { id: string }>({ cols, rows, loading, empty = "No data", onRow }: Props<T>) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-100">
            {cols.map(c => (
              <th key={c.key} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ width: c.width }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {loading ? (
            [...Array(5)].map((_, i) => (
              <tr key={i}>
                {cols.map(c => (
                  <td key={c.key} className="px-5 py-4">
                    <div className="h-4 bg-slate-100 rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={cols.length} className="px-5 py-16 text-center text-slate-400 text-sm">{empty}</td>
            </tr>
          ) : rows.map(row => (
            <tr
              key={row.id}
              className={cn("hover:bg-slate-50 transition-colors", onRow ? "cursor-pointer" : "")}
              onClick={() => onRow?.(row)}
            >
              {cols.map(c => <td key={c.key} className="px-5 py-3.5">{c.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function cn(...c: (string | undefined | false)[]) { return c.filter(Boolean).join(" "); }
