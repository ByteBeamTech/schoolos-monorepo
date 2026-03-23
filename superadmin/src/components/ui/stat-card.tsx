interface Props { label: string; value: string | number; sub?: string; delta?: string; positive?: boolean; loading?: boolean; }
export function StatCard({ label, value, sub, delta, positive, loading }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{label}</p>
      {loading
        ? <div className="h-8 w-28 bg-slate-100 rounded animate-pulse mt-2" />
        : <p className="text-3xl font-bold text-slate-900 mt-1 tracking-tight">{value}</p>
      }
      <div className="flex items-center gap-2 mt-1">
        {delta && <span className={`text-xs font-medium ${positive ? "text-emerald-600" : "text-red-500"}`}>{delta}</span>}
        {sub   && <span className="text-xs text-slate-400">{sub}</span>}
      </div>
    </div>
  );
}
