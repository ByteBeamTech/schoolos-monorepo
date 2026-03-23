import { getClient } from '../client';

export const academicsApi = {
  sessions: {
    list:       ()         => getClient().get('/academic-sessions').then(r => r.data),
    create:     (d: any)   => getClient().post('/academic-sessions', d).then(r => r.data),
    setCurrent: (id: string) => getClient().patch(`/academic-sessions/${id}/set-current`, {}).then(r => r.data),
  },
  classes:  {
    list:    (sessionId: string) => getClient().get('/academics/classes', { params: { sessionId } }).then(r => r.data),
    create:  (d: any)            => getClient().post('/academics/classes', d).then(r => r.data),
  },
  sections: {
    create:  (d: any)            => getClient().post('/academics/sections', d).then(r => r.data),
    update:  (id: string, d: any)=> getClient().patch(`/academics/sections/${id}`, d).then(r => r.data),
  },
  subjects: {
    list:    ()      => getClient().get('/academics/subjects').then(r => r.data),
    create:  (d: any)=> getClient().post('/academics/subjects', d).then(r => r.data),
  },
};
