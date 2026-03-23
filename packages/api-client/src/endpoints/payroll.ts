import { getClient } from '../client';
export const payrollApi = {
  structures: {
    list:   ()        => getClient().get('/payroll/structures').then(r => r.data),
    create: (d: any)  => getClient().post('/payroll/structures', d).then(r => r.data),
  },
  payslips: {
    list:     (p?: { month?: number; year?: number }) => getClient().get('/payroll/payslips', { params: p }).then(r => r.data),
    generate: (d: any)            => getClient().post('/payroll/payslips/generate', d).then(r => r.data),
    approve:  (id: string)        => getClient().patch(`/payroll/payslips/${id}/approve`, {}).then(r => r.data),
    markPaid: (id: string)        => getClient().patch(`/payroll/payslips/${id}/mark-paid`, {}).then(r => r.data),
  },
  stats: (p?: { month?: number; year?: number }) => getClient().get('/payroll/stats', { params: p }).then(r => r.data),
};
