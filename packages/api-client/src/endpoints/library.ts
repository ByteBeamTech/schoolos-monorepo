import { getClient } from '../client';
export const libraryApi = {
  stats:        ()                                       => getClient().get('/library/stats').then(r => r.data),
  listBooks:    (p?: { search?: string; category?: string }) => getClient().get('/library/books', { params: p }).then(r => r.data),
  addBook:      (d: any)                                 => getClient().post('/library/books', d).then(r => r.data),
  issue:        (d: any)                                 => getClient().post('/library/issue', d).then(r => r.data),
  returnBook:   (issueId: string, d?: any)               => getClient().post(`/library/return/${issueId}`, d ?? {}).then(r => r.data),
  overdue:      ()                                       => getClient().get('/library/overdue').then(r => r.data),
  studentBooks: (studentId: string)                      => getClient().get(`/library/student/${studentId}`).then(r => r.data),
};
