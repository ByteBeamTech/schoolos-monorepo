import { getClient } from '../client';
export const sessionsApi = {
  list:       ()           => getClient().get('/academic-sessions').then(r => r.data),
  create:     (d: any)     => getClient().post('/academic-sessions', d).then(r => r.data),
  setCurrent: (id: string) => getClient().patch(`/academic-sessions/${id}/set-current`, {}).then(r => r.data),
  lock:       (id: string) => getClient().patch(`/academic-sessions/${id}/lock`, {}).then(r => r.data),
};
