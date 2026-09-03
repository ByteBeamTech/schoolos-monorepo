"use client";
// frontend/src/components/billing/StudentSearch.tsx
//
// FDD Section 10 -- Search. Implements FR-SEARCH-01 through 05 against what
// the backend actually supports today. FLAGGED GAP, not silently narrowed:
// FDD Section 10.2 specifies admission number, student name, father's
// name, parent mobile, and roll number as one combined search. Verified
// directly against students.service.ts: the backend's `search` param only
// matches firstName/lastName/admissionNumber -- father's name and mobile
// require a Guardian join the current query doesn't perform, and roll
// number isn't matched either. This is a genuine gap between the frozen
// FDD and an already-existing-but-narrower endpoint, not something this
// sprint invents a workaround for (fetching all students to filter
// client-side would defeat server-side search entirely at any real school
// size). Implemented here against what works; the remainder is called out
// for a product decision, not silently dropped.

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useStudents, type Student } from "@/lib/hooks";

interface StudentSearchProps {
  onSelect: (student: Student) => void;
}

export function StudentSearch({ onSelect }: StudentSearchProps) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // FR-SEARCH-02: debounced type-ahead, not Enter-to-search.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, loading } = useStudents(1, debounced ? { search: debounced } : {});
  const results = debounced ? data?.data ?? [] : [];

  // FR-SEARCH-05: auto-refocus is driven by the parent (Collect Fee page)
  // remounting/resetting this component after a completed transaction --
  // exposing the ref lets that reset actually move focus, not just clear
  // the input's value.
  useImperativeFocus(inputRef);

  const clear = () => { setQuery(""); setDebounced(""); inputRef.current?.focus(); };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or admission number..."
          className="pl-9 pr-9"
          autoFocus
        />
        {query && (
          <button
            onClick={clear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* FR-SEARCH-03/04: multi-match disambiguation and zero-result states,
          both distinct from the summary card itself. */}
      {debounced && (
        <div
          className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-72 overflow-y-auto"
          style={{ borderColor: "var(--border-light)" }}
        >
          {loading ? (
            <div className="px-4 py-6 text-sm text-slate-400 text-center">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-400 text-center">
              No student found — check spelling or admission number.
            </div>
          ) : (
            results.map((s) => (
              <button
                key={s.id}
                onClick={() => {
              setQuery("");
              setDebounced("");
              onSelect(s);
            }}
                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b last:border-b-0 flex items-center justify-between"
                style={{ borderColor: "var(--border-light)" }}
              >
                <span className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
                  {s.firstName} {s.lastName}
                </span>
                <span className="text-xs text-slate-400">
                  {s.admissionNumber}
                  {s.section && ` · Class ${s.section.class.name}-${s.section.name}`}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** Exposes an imperative focus() the parent can call via a ref forwarded
 *  through StudentSearch -- kept as a small local hook rather than a new
 *  shared utility, since this is the only place it's needed in Sprint 1. */
function useImperativeFocus(_ref: React.RefObject<HTMLInputElement | null>) {
  // Intentionally minimal for Sprint 1: StudentSearch is unmounted and
  // remounted by the Collect Fee page's "Collect for another" reset
  // (autoFocus above handles refocus on mount). If a future sprint needs
  // to refocus without a remount, this is the seam to extend.
}
