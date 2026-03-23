import { getClient } from '../client';
export const receptionApi = {
  complaints: {
    list:    (p?: any)            => getClient().get('/reception/complaints', { params: p }).then(r => r.data),
    get:     (id: string)         => getClient().get(`/reception/complaints/${id}`).then(r => r.data),
    create:  (d: any)             => getClient().post('/reception/complaints', d).then(r => r.data),
    update:  (id: string, d: any) => getClient().patch(`/reception/complaints/${id}`, d).then(r => r.data),
    resolve: (id: string, d: any) => getClient().post(`/reception/complaints/${id}/resolve`, d).then(r => r.data),
    comment: (id: string, d: any) => getClient().post(`/reception/complaints/${id}/comment`, d).then(r => r.data),
  },
  visitors: {
    list:       (p?: any)         => getClient().get('/reception/visitors', { params: p }).then(r => r.data),
    statsToday: ()                => getClient().get('/reception/visitors/stats/today').then(r => r.data),
    get:        (id: string)      => getClient().get(`/reception/visitors/${id}`).then(r => r.data),
    checkIn:    (d: any)          => getClient().post('/reception/visitors', d).then(r => r.data),
    checkOut:   (id: string, d?: any) => getClient().post(`/reception/visitors/${id}/checkout`, d ?? {}).then(r => r.data),
    getPass:    (id: string)      => getClient().get(`/reception/visitors/${id}/pass`).then(r => r.data),
  },
  staffAttendance: {
    mark:    (d: any)             => getClient().post('/reception/staff-attendance', d).then(r => r.data),
    markBulk:(d: any)             => getClient().post('/reception/staff-attendance/bulk', d).then(r => r.data),
    list:    (p?: any)            => getClient().get('/reception/staff-attendance', { params: p }).then(r => r.data),
    summary: (month: number, year: number) => getClient().get(`/reception/staff-attendance/summary/${month}/${year}`).then(r => r.data),
  },
};
