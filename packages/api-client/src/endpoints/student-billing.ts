import { getClient } from '../client';

export const billingApi = {
  feePlans:         { list: (p?: any) => getClient().get('/billing/fee-plans', { params: p }).then(r => r.data),
                      create:(d: any) => getClient().post('/billing/fee-plans', d).then(r => r.data),
                      assign:(d: any) => getClient().post('/billing/fee-plans/assign', d).then(r => r.data) },
  invoices:         { list: (p?: any) => getClient().get('/billing/invoices', { params: p }).then(r => r.data),
                      stats:(p?: any) => getClient().get('/billing/invoices/stats', { params: p }).then(r => r.data),
                      generate:(d: any) => getClient().post('/billing/invoices/generate', d).then(r => r.data),
                      send:(id: string) => getClient().post(`/billing/invoices/${id}/send`, {}).then(r => r.data) },
  payments:         { recordOffline:(d: any) => getClient().post('/billing/payments/record-offline', d).then(r => r.data),
                      history:(invoiceId: string) => getClient().get(`/billing/payments/invoice/${invoiceId}`).then(r => r.data) },
  discounts:        { list: (p?: any) => getClient().get('/billing/discounts', { params: p }).then(r => r.data),
                      create:(d: any) => getClient().post('/billing/discounts', d).then(r => r.data),
                      approve:(id: string, d: any) => getClient().post(`/billing/discounts/${id}/approve`, d).then(r => r.data),
                      reject: (id: string, d: any) => getClient().post(`/billing/discounts/${id}/reject`,  d).then(r => r.data) },
};
