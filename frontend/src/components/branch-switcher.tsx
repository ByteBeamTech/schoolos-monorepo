"use client";
/**
 * BranchSwitcher — shown in the Sidebar for SUPER_ADMIN only.
 *
 * Features:
 *  • Loads all branches on mount
 *  • Persists selection via Zustand (survives page refresh)
 *  • Shows active branch name in sidebar
 *  • "All Branches" option resets the filter
 */
import { useEffect, useRef, useState } from "react";
import { Building2, ChevronDown, Check, X } from "lucide-react";
import { useBranchStore } from "@/lib/branch-store";
import { useApi }         from "@/lib/hooks";

export function BranchSwitcher() {
  const { data: branches, loading } = useApi<any[]>("/school-management/branches");
  const {
    selectedBranch,
    setBranches,
    selectBranch,
    clearSelection,
  } = useBranchStore();

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Load branches into store
  useEffect(() => {
    if (branches && branches.length > 0) {
      setBranches(branches.map(b => ({
        id:     b.id,
        name:   b.name,
        code:   b.code,
        status: b.status,
        city:   b.address?.city,
      })));
    }
  }, [branches, setBranches]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const branchList = useBranchStore(s => s.branches);

  return (
    <div ref={ref} className="relative px-3 mb-3">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(p => !p)}
        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
          selectedBranch
            ? "bg-blue-50 text-blue-700 border border-blue-200"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
        }`}
      >
        <Building2 className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 text-left truncate font-medium">
          {loading ? "Loading…" : selectedBranch?.name ?? "All Branches"}
        </span>
        {selectedBranch && (
          <button
            onClick={(e) => { e.stopPropagation(); clearSelection(); }}
            className="p-0.5 hover:bg-blue-100 rounded transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-3 right-3 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-lg z-50 overflow-hidden">
          {/* All Branches */}
          <button
            onClick={() => { clearSelection(); setOpen(false); }}
            className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors ${
              !selectedBranch ? "bg-slate-50 text-blue-600 font-medium" : "text-slate-700"
            }`}
          >
            <Building2 className="w-4 h-4 text-slate-400" />
            <span className="flex-1 text-left">All Branches</span>
            {!selectedBranch && <Check className="w-3.5 h-3.5 text-blue-600" />}
          </button>

          <div className="h-px bg-slate-100 mx-3" />

          {/* Branch list */}
          <div className="max-h-64 overflow-y-auto">
            {branchList.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-400">No branches found</p>
            ) : (
              branchList.map((branch: any) => (
                <button
                  key={branch.id}
                  onClick={() => { selectBranch(branch); setOpen(false); }}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors ${
                    selectedBranch?.id === branch.id ? "bg-blue-50 text-blue-600" : "text-slate-700"
                  }`}
                >
                  <span className="flex-1 text-left">
                    <span className="font-medium">{branch.name}</span>
                    {branch.city && (
                      <span className="ml-1.5 text-xs text-slate-400">{branch.city}</span>
                    )}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    branch.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                  }`}>
                    {branch.status}
                  </span>
                  {selectedBranch?.id === branch.id && (
                    <Check className="w-3.5 h-3.5 text-blue-600" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
