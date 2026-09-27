 "use client";
import { useState } from "react";
import { Search, ChevronDown, X, SlidersHorizontal } from "lucide-react";
import { useFilterParams, useDebouncedFilter } from "@/lib/use-filter-params";

export type FilterFieldType = "text"|"select"|"date"|"date-range"|"boolean"|"number-range";
export interface FilterOption { label: string; value: string; }
export interface FilterField  { id: string; label: string; type: FilterFieldType; placeholder?: string; options?: FilterOption[]; }
export interface FilterSchema { module: string; searchField?: string; fields: FilterField[]; }

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
  const { clearAll, hasActiveFilters, params } = useFilterParams();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const searchField    = schema.fields.find(f => f.id === schema.searchField);
  const advancedFields = schema.fields.filter(f => f.id !== schema.searchField);
  const activeCount    = Object.entries(params).filter(([k,v]) => !["page","limit"].includes(k) && v).length;

  return (
    <div className={`bg-white rounded-xl border border-slate-100 shadow-sm ${className}`}>
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
        </div>

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
