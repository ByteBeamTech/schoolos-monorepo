import { getClient } from '../client';
export const hrApi = {
  workflow: {
    configure: (d: any)           => getClient().post('/hr/workflow/configure', d).then(r => r.data),
    get:       (type: string)     => getClient().get(`/hr/workflow/${type}`).then(r => r.data),
  },
  joining: {
    list:    (p?: any)            => getClient().get('/hr/joining', { params: p }).then(r => r.data),
    pending: ()                   => getClient().get('/hr/joining/pending').then(r => r.data),
    get:     (id: string)         => getClient().get(`/hr/joining/${id}`).then(r => r.data),
    create:  (d: any)             => getClient().post('/hr/joining', d).then(r => r.data),
    approve: (id: string, d?: any)=> getClient().post(`/hr/joining/${id}/approve`, d ?? {}).then(r => r.data),
    reject:  (id: string, d: any) => getClient().post(`/hr/joining/${id}/reject`, d).then(r => r.data),
  },
  leave: {
    list:    (p?: any)            => getClient().get('/hr/leave', { params: p }).then(r => r.data),
    my:      ()                   => getClient().get('/hr/leave/my').then(r => r.data),
    apply:   (d: any)             => getClient().post('/hr/leave/apply', d).then(r => r.data),
    approve: (id: string, d?: any)=> getClient().post(`/hr/leave/${id}/approve`, d ?? {}).then(r => r.data),
    reject:  (id: string, d: any) => getClient().post(`/hr/leave/${id}/reject`, d).then(r => r.data),
    balance: (staffId: string, year: number) => getClient().get(`/hr/leave-balance/${staffId}/${year}`).then(r => r.data),
    setBalance: (d: any)          => getClient().post('/hr/leave-balance', d).then(r => r.data),
  },
};
