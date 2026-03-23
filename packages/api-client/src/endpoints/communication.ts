import { getClient } from '../client';
export const communicationApi = {
  stats:              ()           => getClient().get('/communication/stats').then(r => r.data),
  listAnnouncements:  ()           => getClient().get('/communication/announcements').then(r => r.data),
  createAnnouncement: (d: any)     => getClient().post('/communication/announcements', d).then(r => r.data),
  pinAnnouncement:    (id: string) => getClient().patch(`/communication/announcements/${id}/pin`, {}).then(r => r.data),
  deleteAnnouncement: (id: string) => getClient().delete(`/communication/announcements/${id}`).then(r => r.data),
  listCirculars:      ()           => getClient().get('/communication/circulars').then(r => r.data),
  createCircular:     (d: any)     => getClient().post('/communication/circulars', d).then(r => r.data),
};
