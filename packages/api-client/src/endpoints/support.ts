import { getClient } from '../client';

export const supportApi = {
  tickets: {
    list:    (status?: string)    => getClient().get('/support/tickets', { params: status ? { status } : {} }).then(r => r.data),
    get:     (id: string)         => getClient().get(`/support/tickets/${id}`).then(r => r.data),
    create:  (d: any)             => getClient().post('/support/tickets', d).then(r => r.data),
    message: (id: string, d: any) => getClient().post(`/support/tickets/${id}/messages`, d).then(r => r.data),
  },
  admin: {
    list:    (p?: any)            => getClient().get('/support/admin/tickets', { params: p }).then(r => r.data),
    stats:   ()                   => getClient().get('/support/admin/stats').then(r => r.data),
    update:  (id: string, d: any) => getClient().patch(`/support/admin/tickets/${id}`, d).then(r => r.data),
    message: (id: string, d: any) => getClient().post(`/support/admin/tickets/${id}/messages`, d).then(r => r.data),
  },
};
