// packages/api-client/src/endpoints/bulk.ts
import { getClient } from '../client';

export const bulkApi = {
  importStudents: (formData: FormData) =>
    getClient().post('/bulk/students/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data),

  importStudentsFromText: (data: { csv: string }) =>
    getClient().post('/bulk/students/import-text', data).then(r => r.data),

  importStudentsFromFile: (formData: FormData) =>
    getClient().post('/bulk/students/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data),

  exportStudents: (params?: {
    format?: 'csv' | 'xlsx';
    sectionId?: string;
    academicYear?: string;
    includeGuardians?: boolean;
  }) => getClient().get('/bulk/students/export', {
    params,
    responseType: 'blob',
  }).then(r => r.data),

  getJobStatus: (jobId: string) =>
    getClient().get(`/bulk/jobs/${jobId}`).then(r => r.data),

  listJobs: (params?: { page?: number; limit?: number; status?: string }) =>
    getClient().get('/bulk/jobs', { params }).then(r => r.data),

  downloadErrorReport: (jobId: string) =>
    getClient().get(`/bulk/jobs/${jobId}/errors`, {
      responseType: 'blob',
    }).then(r => r.data),

  exportUdise: (params: { academicYear: string; format?: 'csv' | 'xlsx' }) =>
    getClient().get('/bulk/udise/export', {
      params,
      responseType: 'blob',
    }).then(r => r.data),

  generateInvoicesForClass: (data: any) =>
    getClient().post('/bulk/invoices/generate', data).then(r => r.data),

  downloadStudentTemplate: (format: "csv" | "excel") =>
    getClient().get(`/bulk/templates/students?format=${format}`, {
      responseType: 'blob',
    }).then(r => ({
      blob: r.data,
      filename: `students_template.${format === "excel" ? "xlsx" : "csv"}`
    })),

  downloadTemplate: (type: 'students' | 'staff' | 'fees', format: "csv" | "excel") =>
    getClient().get(`/bulk/templates/${type}?format=${format}`, {
      responseType: 'blob',
    }).then(r => r.data),
};
