import { useState, useEffect, useCallback } from "react";
import { api } from "./api";

export function useApi<T>(url: string, deps: unknown[] = []) {
  const [data, setData]       = useState<T | null>(null);
  const [loading, setLoading] = useState(!!url);
  const [error, setError]     = useState<string | null>(null);

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
