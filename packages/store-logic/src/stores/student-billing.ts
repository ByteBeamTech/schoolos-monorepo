import { create } from 'zustand';

export interface Invoice {
  id: string; invoiceNumber: string; status: string; currency: string;
  totalAmount: number; paidAmount: number; dueAmount: number; dueDate: string;
  student: { firstName: string; lastName: string; admissionNumber: string };
}

export interface FeePlan {
  id: string; name: string; academicYear: string; currency: string; isActive: boolean;
  feeItems: { id: string; name: string; amount: number; isOptional: boolean }[];
}

interface BillingStore {
  invoices:       Invoice[];
  feePlans:       FeePlan[];
  stats:          { totalInvoices: number; totalAmount: number; collectedAmount: number; overdueCount: number } | null;
  statusFilter:   string;
  setInvoices:    (invoices: Invoice[]) => void;
  setFeePlans:    (plans: FeePlan[]) => void;
  setStats:       (stats: any) => void;
  setFilter:      (status: string) => void;
}

export const useBillingStore = create<BillingStore>((set) => ({
  invoices: [], feePlans: [], stats: null, statusFilter: '',
  setInvoices: (invoices) => set({ invoices }),
  setFeePlans: (feePlans) => set({ feePlans }),
  setStats:    (stats)    => set({ stats }),
  setFilter:   (statusFilter) => set({ statusFilter }),
}));
