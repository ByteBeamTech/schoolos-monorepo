import { create } from 'zustand';

export interface Payslip { id: string; staffId: string; month: number; year: number; grossSalary: number; netSalary: number; status: string; }

interface PayrollStore {
  payslips:    Payslip[];
  month:       number;
  year:        number;
  setPayslips: (p: Payslip[]) => void;
  setPeriod:   (month: number, year: number) => void;
}

export const usePayrollStore = create<PayrollStore>((set) => ({
  payslips: [],
  month: new Date().getMonth() + 1,
  year:  new Date().getFullYear(),
  setPayslips: (payslips)      => set({ payslips }),
  setPeriod:   (month, year)   => set({ month, year }),
}));
