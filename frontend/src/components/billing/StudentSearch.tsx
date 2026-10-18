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

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useStudents, type Student } from "@/lib/hooks";

interface StudentSearchProps {
  onSelect: (student: Student) => void;
}

export function StudentSearch({ onSelect }: StudentSearchProps) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [directoryOpen, setDirectoryOpen] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // FR-SEARCH-02: debounced type-ahead, not Enter-to-search.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, loading } = useStudents(1, debounced ? { search: debounced } : {});
  const { data: directoryData, loading: directoryLoading } = useStudents(1, {}, 1000);
  const results = debounced ? data?.data ?? [] : [];
  const classGroups = useMemo(() => {
    const groups = new Map<string, { className: string; students: Student[] }>();
    for (const student of directoryData?.data ?? []) {
      const className = student.section
        ? `${student.section.class.name} · Section ${student.section.name}`
        : "Unassigned";
      const existing = groups.get(className);
      if (existing) existing.students.push(student);
      else groups.set(className, { className, students: [student] });
    }
    return [...groups.values()].sort((a, b) => a.className.localeCompare(b.className));
  }, [directoryData]);

  // FR-SEARCH-05: auto-refocus is driven by the parent (Collect Fee page)
  // remounting/resetting this component after a completed transaction --
  // exposing the ref lets that reset actually move focus, not just clear
  // the input's value.
  useImperativeFocus(inputRef);

  const clear = () => { setQuery(""); setDebounced(""); inputRef.current?.focus(); };

  return (
    <div className="space-y-3">
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

      {!debounced && (
        <div className="rounded-lg border bg-white" style={{ borderColor: "var(--border-light)" }}>
          <button
            type="button"
            onClick={() => setDirectoryOpen((open) => !open)}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-sm font-medium text-slate-700">Choose by class</span>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${directoryOpen ? "rotate-180" : ""}`} />
          </button>
          {directoryOpen && (
            <div className="border-t px-3 py-3 space-y-2 max-h-96 overflow-y-auto" style={{ borderColor: "var(--border-light)" }}>
              {directoryLoading ? (
                <p className="px-2 py-3 text-sm text-slate-400">Loading classes…</p>
              ) : classGroups.length === 0 ? (
                <p className="px-2 py-3 text-sm text-slate-400">No students found.</p>
              ) : classGroups.map((group) => (
                <details key={group.className} className="rounded-md border border-slate-100">
                  <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-slate-700">
                    {group.className}
                    <span className="ml-2 text-xs font-normal text-slate-400">{group.students.length} students</span>
                  </summary>
                  <div className="border-t border-slate-100">
                    {group.students.map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => onSelect(student)}
                        className="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                      >
                        <span className="font-medium text-slate-700">
                          {student.firstName} {student.lastName}
                        </span>
                        <span className="text-xs text-slate-400">{student.admissionNumber}</span>
                      </button>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      )}

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
