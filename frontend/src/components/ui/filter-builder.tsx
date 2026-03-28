"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Search, ChevronDown, X, SlidersHorizontal, Star, Trash2, Check } from "lucide-react";
import { useFilterParams, useDebouncedFilter } from "@/lib/use-filter-params";
import { apiClient } from "@/lib/api";

export type FilterFieldType = "text"|"select"|"date"|"date-range"|"boolean"|"number-range";
export interface FilterOption { label: string; value: string; }
export interface FilterField  { id: string; label: string; type: FilterFieldType; placeholder?: string; options?: FilterOption[]; }
export interface FilterSchema { module: string; searchField?: string; fields: FilterField[]; }

interface SavedView { id: string; name: string; parameters: Record<string,string>; isDefault: boolean; }

function TextField({ field }: { field: FilterField }) {
  const [val, setVal] = useDebouncedFilter(field.id);
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
      <input type="text" value={val} onChange={e => setVal(e.target.value)}
        placeholder={field.placeholder ?? `Search…`}
        className="w-full pl-8 pr-8 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
      {val && <button onClick={() => setVal("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>}
    </div>
  );
}

function SelectField({ field }: { field: FilterField }) {
  const { getParam, setFilter } = useFilterParams();
  return (
    <div className="relative">
      <select value={getParam(field.id)} onChange={e => setFilter(field.id, e.target.value || undefined)}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none pr-8">
        <option value="">{field.label}</option>
        {field.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
    </div>
  );
}

function DateRangeField({ field }: { field: FilterField }) {
  const { getParam, setFilter } = useFilterParams();
  return (
    <div className="flex items-center gap-1.5">
      <input type="date" value={getParam(`${field.id}From`)} onChange={e => setFilter(`${field.id}From`, e.target.value || undefined)}
        className="flex-1 px-2 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
      <span className="text-slate-400 text-xs">–</span>
      <input type="date" value={getParam(`${field.id}To`)} onChange={e => setFilter(`${field.id}To`, e.target.value || undefined)}
        className="flex-1 px-2 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
    </div>
  );
}

function NumberRangeField({ field }: { field: FilterField }) {
  const { getParam, setFilter } = useFilterParams();
  return (
    <div className="flex items-center gap-1.5">
      <input type="number" value={getParam(`${field.id}Gte`)} onChange={e => setFilter(`${field.id}Gte`, e.target.value || undefined)}
        placeholder="Min" className="flex-1 px-2 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
      <span className="text-slate-400 text-xs">–</span>
      <input type="number" value={getParam(`${field.id}Lte`)} onChange={e => setFilter(`${field.id}Lte`, e.target.value || undefined)}
        placeholder="Max" className="flex-1 px-2 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
    </div>
  );
}

function renderField(field: FilterField) {
  switch (field.type) {
    case "text":         return <TextField key={field.id} field={field} />;
    case "select":
    case "boolean":      return <SelectField key={field.id} field={field} />;
    case "date-range":   return <DateRangeField key={field.id} field={field} />;
    case "number-range": return <NumberRangeField key={field.id} field={field} />;
    default:             return null;
  }
}

export function FilterBuilder({ schema, className = "" }: { schema: FilterSchema; className?: string }) {
  const { clearAll, hasActiveFilters, setFilters, params } = useFilterParams();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [savedViews,   setSavedViews]   = useState<SavedView[]>([]);
  const [showSave,     setShowSave]     = useState(false);
  const [viewName,     setViewName]     = useState("");
  const [saving,       setSaving]       = useState(false);

  useEffect(() => {
    apiClient.get(`/saved-views?module=${schema.module}`)
      .then((r: any) => setSavedViews(r.data ?? []))
      .catch(() => {});
  }, [schema.module]);

  const searchField    = schema.fields.find(f => f.id === schema.searchField);
  const advancedFields = schema.fields.filter(f => f.id !== schema.searchField);
  const activeCount    = Object.entries(params).filter(([k,v]) => !["page","limit"].includes(k) && v).length;

  const saveView = async () => {
    if (!viewName.trim()) return;
    setSaving(true);
    const fp: Record<string,string> = {};
    Object.entries(params).forEach(([k,v]) => { if (v && !["page","limit"].includes(k)) fp[k] = v; });
    try {
      const res: any = await apiClient.post("/saved-views", { module: schema.module, name: viewName, parameters: fp });
      setSavedViews(p => [...p, res.data ?? res]);
      setShowSave(false); setViewName("");
    } catch { /* saved-views endpoint may not exist yet */ }
    finally { setSaving(false); }
  };

  const deleteView = async (id: string) => {
    await apiClient.delete(`/saved-views/${id}`).catch(() => {});
    setSavedViews(p => p.filter(v => v.id !== id));
  };

  return (
    <div className={`bg-white rounded-xl border border-slate-100 shadow-sm ${className}`}>
      {savedViews.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 overflow-x-auto flex-shrink-0">
          <Star className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <span className="text-xs text-slate-400 flex-shrink-0">Saved:</span>
          {savedViews.map(v => (
            <div key={v.id} className="flex items-center gap-0.5 flex-shrink-0">
              <button onClick={() => setFilters(v.parameters)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${v.isDefault ? "bg-blue-50 text-blue-700" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}>
                {v.name}
              </button>
              <button onClick={() => deleteView(v.id)} className="p-1 text-slate-300 hover:text-red-400 transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="p-4">
        <div className="flex items-center gap-2.5">
          {searchField && <div className="flex-1"><TextField field={searchField} /></div>}

          {advancedFields.length > 0 && (
            <button onClick={() => setShowAdvanced(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors flex-shrink-0 ${
                showAdvanced || activeCount > (searchField ? 1 : 0)
                  ? "bg-blue-50 border-blue-200 text-blue-700"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}>
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
              {activeCount > 0 && (
                <span className="bg-blue-600 text-white text-[10px] rounded-full px-1.5 py-0.5 leading-none">{activeCount}</span>
              )}
            </button>
          )}

          {hasActiveFilters && (
            <button onClick={clearAll}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 border border-red-100 transition-colors flex-shrink-0">
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          )}
          {hasActiveFilters && (
            <button onClick={() => setShowSave(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-amber-600 hover:bg-amber-50 border border-amber-100 transition-colors flex-shrink-0">
              <Star className="w-3.5 h-3.5" /> Save
            </button>
          )}
        </div>

        {showSave && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
            <input type="text" value={viewName} onChange={e => setViewName(e.target.value)}
              placeholder='Name this view (e.g. "Overdue fees")'
              onKeyDown={e => e.key === "Enter" && saveView()}
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus />
            <button onClick={saveView} disabled={!viewName.trim() || saving}
              className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-50 hover:bg-blue-700 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />{saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => { setShowSave(false); setViewName(""); }}
              className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700">Cancel</button>
          </div>
        )}

        {showAdvanced && advancedFields.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-100">
            {advancedFields.map(field => (
              <div key={field.id}>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{field.label}</label>
                {renderField(field)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
