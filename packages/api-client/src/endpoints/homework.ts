import { getClient } from '../client';
export const homeworkApi = {
  stats:        ()                                          => getClient().get('/homework/stats').then(r => r.data),
  list:         (p?: { classId?: string; subjectId?: string }) => getClient().get('/homework', { params: p }).then(r => r.data),
  create:       (d: any)                                    => getClient().post('/homework', d).then(r => r.data),
  submissions:  (id: string)                                => getClient().get(`/homework/${id}/submissions`).then(r => r.data),
  submit:       (id: string, d: any)                        => getClient().post(`/homework/${id}/submit`, d).then(r => r.data),
  grade:        (id: string, d: any)                        => getClient().post(`/homework/${id}/grade`, d).then(r => r.data),
};
