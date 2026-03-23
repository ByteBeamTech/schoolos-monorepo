import { getClient } from '../client';
export const examsApi = {
  list:       (p?: { sessionId?: string }) => getClient().get('/examinations', { params: p }).then(r => r.data),
  stats:      (p?: { sessionId?: string }) => getClient().get('/examinations/stats', { params: p }).then(r => r.data),
  get:        (id: string)                 => getClient().get(`/examinations/${id}`).then(r => r.data),
  create:     (d: any)                     => getClient().post('/examinations', d).then(r => r.data),
  publish:    (id: string)                 => getClient().patch(`/examinations/${id}/publish`, {}).then(r => r.data),
  schedules:  {
    list:     (examId: string)             => getClient().get(`/examinations/${examId}/schedules`).then(r => r.data),
    create:   (examId: string, d: any)     => getClient().post(`/examinations/${examId}/schedules`, d).then(r => r.data),
  },
  marks: {
    get:      (scheduleId: string)         => getClient().get(`/examinations/marks/${scheduleId}`).then(r => r.data),
    bulkEntry:(d: any)                     => getClient().post('/examinations/marks/bulk', d).then(r => r.data),
  },
};
