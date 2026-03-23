import { getClient } from '../client';
export const notificationsApi = {
  list:             (p?: any)          => getClient().get('/notifications', { params: p }).then(r => r.data),
  stats:            ()                 => getClient().get('/notifications/stats').then(r => r.data),
  send:             (d: any)           => getClient().post('/notifications/send', d).then(r => r.data),
  sendBulk:         (d: any)           => getClient().post('/notifications/send-bulk', d).then(r => r.data),
  sendAbsentAlerts: (d: any)           => getClient().post('/notifications/absent-alerts', d).then(r => r.data),
  sendFeeReminders: (d: any)           => getClient().post('/notifications/fee-reminders', d).then(r => r.data),
};
