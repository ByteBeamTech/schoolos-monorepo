import { getClient } from '../client';
export const timetableApi = {
  getSection:  (sectionId: string)  => getClient().get(`/timetable/section/${sectionId}`).then(r => r.data),
  getTeacher:  (teacherId: string)  => getClient().get(`/timetable/teacher/${teacherId}`).then(r => r.data),
  create:      (d: any)             => getClient().post('/timetable', d).then(r => r.data),
  bulkCreate:  (d: any)             => getClient().post('/timetable/bulk', d).then(r => r.data),
  update:      (id: string, d: any) => getClient().patch(`/timetable/${id}`, d).then(r => r.data),
  remove:      (id: string)         => getClient().delete(`/timetable/${id}`).then(r => r.data),
  clearSection:(sectionId: string)  => getClient().delete(`/timetable/section/${sectionId}/clear`).then(r => r.data),
};
