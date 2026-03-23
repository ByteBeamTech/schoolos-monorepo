import { getClient } from '../client';

export const studentsApi = {
  list:     (params?: { page?: number; limit?: number; search?: string; sectionId?: string }) =>
            getClient().get('/students', { params }).then(r => r.data),
  getById:  (id: string) => getClient().get(`/students/${id}`).then(r => r.data),
  create:   (data: any)  => getClient().post('/students', data).then(r => r.data),
  update:   (id: string, data: any) => getClient().patch(`/students/${id}`, data).then(r => r.data),
  guardians:(id: string) => getClient().get(`/students/${id}/guardians`).then(r => r.data),
  linkGuardian:(id: string, data: any) => getClient().post(`/students/${id}/guardians/link`, data).then(r => r.data),
  createGuardian:(data: any) => getClient().post('/students/guardians', data).then(r => r.data),
};
