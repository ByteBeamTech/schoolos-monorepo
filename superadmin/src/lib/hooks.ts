import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "./api";

// ── UI-0.5: Consolidated data-fetching hook ─────────────────────────────────
//
// Prior to this change, two separate `useApi` implementations existed:
//   - this file (lib/hooks.ts)   — plain fetch-on-mount/deps-change, used by
//                                   17 of 21 pages, no polling support.
//   - lib/use-api.ts (deleted)   — SWR-based, used only by platform-layout.tsx
//                                   for a 30s-polling pending-count badge,
//                                   plus its own separate auto-logout-on-401
//                                   handling.
//
// This was the frontend's own version of the exact duplicate-implementation
// problem SA-2 fixed on the backend (two FeatureFlag modules, one canonical
// and one incidental). Consolidated here rather than in lib/use-api.ts
// because 17 of 21 call sites already depended on this file's exact
// interface (`{ data, loading, error, refetch }`, `refetch` — not `refresh`)
// — keeping this file canonical is the path of least disruption, per the
// UI Architecture Audit v1's own recommendation (§7).
//
// Polling is now supported here as an *opt-in* third argument, so
// platform-layout.tsx (the only caller that needs it) can move onto this
// hook with identical behavior instead of staying on a separate
// implementation just for that one feature. Default behavior for the other
// 17 callers (no options passed) is unchanged: fetch once on mount/deps
// change, no polling, no auto-refetch-on-focus.
//
// Auth-failure handling (auto-logout on 401) has moved to lib/api.ts's
// `request()` function instead of living here — see that file for why.
// That's a strict improvement, not a behavior change for existing callers:
// previously only lib/use-api.ts's one consumer got this protection, now
// every caller of `api.*` (hook-based or direct) gets it uniformly.

interface UseApiOptions {
  /**
   * If set, re-fetches on this interval (ms) in addition to the normal
   * mount/deps-change fetch. Pauses automatically while the tab is hidden
   * (Page Visibility API) and force-refetches once when the tab regains
   * focus, so a backgrounded tab doesn't keep polling uselessly and a
   * returning user always sees fresh data immediately rather than waiting
   * for the next interval tick. Opt-in only — omitting this preserves the
   * exact fetch-once behavior every existing caller already relies on.
   */
  pollInterval?: number;
}

export function useApi<T>(url: string, deps: unknown[] = [], options?: UseApiOptions) {
  const [data, setData]       = useState<T | null>(null);
  const [loading, setLoading] = useState(!!url);
  const [error, setError]     = useState<string | null>(null);
  const pollInterval = options?.pollInterval;

  const load = useCallback(async () => {
    if (!url) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true); setError(null);
    try   { setData(await api.get<T>(url)); }
    catch (e: any) { setError(e.message ?? "Failed"); }
    finally        { setLoading(false); }
  }, [url]);

  useEffect(() => { load(); }, deps);

  // Opt-in polling — only runs when a caller explicitly asks for it.
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!pollInterval || !url) return;

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") loadRef.current();
    }, pollInterval);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") loadRef.current();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollInterval, url]);

  return { data, loading, error, refetch: load };
}

// ── Types matching Prisma schema ──────────────────────────────────────────────

export interface Tenant {
  id:            string;
  name:          string;
  slug:          string;
  status:        "TRIAL" | "ACTIVE" | "SUSPENDED" | "CANCELLED";
  region:        string;
  currency:      string;
  featureTier:   string;
  contactEmail:  string;
  contactPhone?: string;
  maxStudents:   number;
  timezone?:     string;
  gstNumber?:    string;
  createdAt:     string;
  subscription?: TenantSubscription;
  users?: TenantAdminUser[];
  _count?: { students: number; users: number; auditLogs?: number };
}

export interface TenantSubscription {
  id:                 string;
  model:              "PER_STUDENT" | "SUBSCRIPTION" | "HYBRID";
  status:             "TRIAL" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELLED";
  currency:           string;
  currentPeriodStart: string;
  currentPeriodEnd:   string;
  trialEndsAt?:       string;
  studentCountAtBilling?: number;
  plan:               PricingPlan;
}

export interface PricingPlan {
  id:              string;
  name:            string;
  tier:            string;
  model:           string;
  currency:        string;
  region:          string;
  perStudentRate?: number;
  baseFee?:        number;
  studentLimit?:   number;
  overageRate?:    number;
  overageEnabled:  boolean;
  trialDays:       number;
  isActive:        boolean;
  features:        string[];
}

export interface TenantAdminUser {
  email:       string;
  firstName:   string;
  lastName:    string;
  lastLoginAt?: string;
}

export interface SaasInvoice {
  id:            string;
  invoiceNumber: string;
  status:        string;
  currency:      string;
  totalAmount:   number;
  periodStart:   string;
  periodEnd:     string;
  dueDate:       string;
  paidAt?:       string;
  studentCount?: number;
  subscription:  { tenant: { name: string; slug: string } };
}

export interface FraudAlert {
  id:          string;
  severity:    "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status:      "OPEN" | "INVESTIGATING" | "RESOLVED" | "FALSE_POSITIVE";
  ruleName:    string;
  description: string;
  entityType:  string;
  createdAt:   string;
  tenant:      { name: string; slug: string };
}

export interface PlatformStats {
  tenants:     { total: number; active: number; trial: number; suspended: number };
  revenue:     { mrr: number; arr: number; currency: string };
  students:    { total: number };
  alerts:      { open: number; critical: number };
}
