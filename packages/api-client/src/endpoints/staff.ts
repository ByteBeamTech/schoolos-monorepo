import { getClient } from '../client';

export const staffApi = {
  list: (params?: { department?: string; search?: string; page?: number; limit?: number }) =>
    getClient().get('/staff', { params }).then(r => r.data),

  getById: (id: string) =>
    getClient().get(`/staff/${id}`).then(r => r.data),

  create: (data: {
    firstName: string; lastName: string; email: string; phone?: string;
    role: string; employeeId: string; designation: string;
    department?: string; dateOfJoining: string;
    qualification?: string; experience?: string;
  }) => getClient().post('/staff', data).then(r => r.data),

  update: (id: string, data: Partial<{
    designation: string; department: string; isActive: boolean;
    qualification: string; experience: string;
  }>) => getClient().patch(`/staff/${id}`, data).then(r => r.data),

  subjectPreferences: {
    get: (staffId: string) =>
      getClient().get(`/staff/${staffId}/subject-preferences`).then(r => r.data),

    set: (staffId: string, subjectIds: string[]) =>
      getClient().post(`/staff/${staffId}/subject-preferences`, { subjectIds }).then(r => r.data),
  },
};
