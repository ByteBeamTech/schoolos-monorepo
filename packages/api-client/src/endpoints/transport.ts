import { getClient } from '../client';
export const transportApi = {
  stats:         ()                       => getClient().get('/transport/stats').then(r => r.data),
  listRoutes:    ()                       => getClient().get('/transport/routes').then(r => r.data),
  getRoute:      (id: string)             => getClient().get(`/transport/routes/${id}`).then(r => r.data),
  createRoute:   (d: any)                 => getClient().post('/transport/routes', d).then(r => r.data),
  assign:        (d: any)                 => getClient().post('/transport/assign', d).then(r => r.data),
  unassign:      (studentId: string)      => getClient().delete(`/transport/unassign/${studentId}`).then(r => r.data),
};
