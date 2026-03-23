import { getClient } from '../client';
export const certificatesApi = {
  list:   (p?: { studentId?: string }) => getClient().get('/certificates', { params: p }).then(r => r.data),
  issue:  (d: any)                     => getClient().post('/certificates', d).then(r => r.data),
  print:  (id: string)                 => getClient().get(`/certificates/${id}/print`).then(r => r.data),
};
