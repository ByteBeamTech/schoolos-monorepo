import { getClient } from '../client';

export const attendanceApi = {
  markDaily:    (data: any)  => getClient().post('/attendance/daily', data).then(r => r.data),
  getDaily:     (sectionId: string, date: string) =>
                getClient().get('/attendance/daily', { params: { sectionId, date } }).then(r => r.data),
  getStats:     (date: string) => getClient().get('/attendance/stats', { params: { date } }).then(r => r.data),
  getStudent:   (studentId: string, fromDate: string, toDate: string) =>
                getClient().get(`/attendance/student/${studentId}`, { params: { fromDate, toDate } }).then(r => r.data),
  getAbsentees: (date: string, sectionId?: string) =>
                getClient().get('/attendance/absentees', { params: { date, sectionId } }).then(r => r.data),
  monthlyReport:(sectionId: string, year: number, month: number) =>
                getClient().get('/attendance/report/monthly', { params: { sectionId, year, month } }).then(r => r.data),
};
