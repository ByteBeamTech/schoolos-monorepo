"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useFilterParams } from "@/lib/use-filter-params";

interface Meta { total: number; page: number; limit: number; lastPage: number; hasNext: boolean; hasPrev: boolean; }

export function Pagination({ meta, loading }: { meta?: Meta | null; loading?: boolean }) {
  const { setFilter } = useFilterParams();
  if (!meta || meta.lastPage <= 1) return null;

  const pages = buildRange(meta.page, meta.lastPage);
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
      <p className="text-xs text-slate-500">
        {loading ? "Loading…" : (
          <>Showing <span className="font-semibold text-slate-700">
            {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)}
          </span> of <span className="font-semibold text-slate-700">{meta.total.toLocaleString()}</span></>
        )}
      </p>
      <div className="flex items-center gap-1">
        <button onClick={() => setFilter("page", String(meta.page - 1))} disabled={!meta.hasPrev || loading}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        {pages.map((p, i) => p === "…"
          ? <span key={`e${i}`} className="px-2 text-slate-400 text-sm">…</span>
          : <button key={p} onClick={() => setFilter("page", String(p))} disabled={loading}
              className={`min-w-[32px] h-8 px-2 rounded-lg text-sm font-medium transition-colors ${p === meta.page ? "bg-blue-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              {p}
            </button>
        )}
        <button onClick={() => setFilter("page", String(meta.page + 1))} disabled={!meta.hasNext || loading}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function buildRange(cur: number, last: number): (number | "…")[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  if (cur <= 4)  return [1, 2, 3, 4, 5, "…", last];
  if (cur >= last - 3) return [1, "…", last-4, last-3, last-2, last-1, last];
  return [1, "…", cur-1, cur, cur+1, "…", last];
}
