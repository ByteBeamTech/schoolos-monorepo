"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useTransition, useState, useEffect, useRef } from "react";

export type FilterValue  = string | undefined;
export type FilterParams = Record<string, FilterValue>;

export function useFilterParams(defaults: FilterParams = {}) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const params: FilterParams = {};
  searchParams.forEach((v, k) => { params[k] = v || undefined; });

  const buildUrl = useCallback((newParams: FilterParams) => {
    const qs = new URLSearchParams();
    Object.entries(defaults).forEach(([k, v]) => { if (v) qs.set(k, v); });
    searchParams.forEach((v, k) => { if (v) qs.set(k, v); });
    Object.entries(newParams).forEach(([k, v]) => {
      if (!v || v === "") qs.delete(k); else qs.set(k, v);
    });
    if (!("page" in newParams)) qs.delete("page");
    const s = qs.toString();
    return `${pathname}${s ? `?${s}` : ""}`;
  }, [pathname, searchParams, defaults]);

  const setFilter  = useCallback((key: string, value: FilterValue) => {
    startTransition(() => { router.push(buildUrl({ [key]: value }), { scroll: false }); });
  }, [router, buildUrl]);

  const setFilters = useCallback((filters: FilterParams) => {
    startTransition(() => { router.push(buildUrl(filters), { scroll: false }); });
  }, [router, buildUrl]);

  const clearAll   = useCallback(() => {
    startTransition(() => { router.push(pathname, { scroll: false }); });
  }, [router, pathname]);

  const getParam   = useCallback((key: string) =>
    searchParams.get(key) ?? defaults[key] ?? "", [searchParams, defaults]);

  const hasActiveFilters = Array.from(searchParams.entries())
    .some(([k, v]) => !["page", "limit"].includes(k) && v !== "");

  return { params, setFilter, setFilters, clearAll, getParam, hasActiveFilters };
}

export function useDebouncedFilter(key: string, delay = 300): [string, (v: string) => void] {
  const { getParam, setFilter } = useFilterParams();
  const [local, setLocal] = useState(getParam(key));
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  const onChange = useCallback((value: string) => {
    setLocal(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setFilter(key, value || undefined), delay);
  }, [key, delay, setFilter]);

  return [local, onChange];
}
