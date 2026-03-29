// packages/api-client/src/endpoints/bulk.ts
import { getClient } from '../client';

// Bulk data import/export operations — UDISE compliance, mass enrollment etc.
export const bulkApi = {
  // Import students via CSV/Excel upload
  importStudents: (formData: FormData) =>
    getClient().post('/bulk/students/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data),

  // Export students to Excel/CSV
  exportStudents: (params?: {
    format?: 'csv' | 'xlsx';
    sectionId?: string;
    academicYear?: string;
    includeGuardians?: boolean;
  }) => getClient().get('/bulk/students/export', {
    params,
    responseType: 'blob',
  }).then(r => r.data),

  // Get status of a bulk job
  getJobStatus: (jobId: string) =>
    getClient().get(`/bulk/jobs/${jobId}`).then(r => r.data),

  // List all bulk jobs for the tenant
  listJobs: (params?: { page?: number; limit?: number; status?: string }) =>
    getClient().get('/bulk/jobs', { params }).then(r => r.data),

  // Download the error report for a failed/partial import
  downloadErrorReport: (jobId: string) =>
    getClient().get(`/bulk/jobs/${jobId}/errors`, {
      responseType: 'blob',
    }).then(r => r.data),

  // UDISE export (mandatory for Indian schools)
  exportUdise: (params: { academicYear: string; format?: 'csv' | 'xlsx' }) =>
    getClient().get('/bulk/udise/export', {
      params,
      responseType: 'blob',
    }).then(r => r.data),

  // 🚀 THE SPECIFIC FIX: Download student template with blob mapping
  downloadStudentTemplate: (format: "csv" | "excel") =>
    getClient().get(`/bulk/templates/students?format=${format}`, {
      responseType: 'blob',
    }).then(r => ({
      blob: r.data,
      filename: `students_template.${format === "excel" ? "xlsx" : "csv"}`
    })),

  // 🚀 THE GENERIC FIX: Updated to accept format
  downloadTemplate: (type: 'students' | 'staff' | 'fees', format: "csv" | "excel") =>
    getClient().get(`/bulk/templates/${type}?format=${format}`, {
      responseType: 'blob',
    }).then(r => r.data),
};
