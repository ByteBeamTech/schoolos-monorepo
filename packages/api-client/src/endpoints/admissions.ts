import { getClient } from '../client';
import type {
  AddAdmissionNoteRequest,
  AdmissionDetail,
  AdmissionListItem,
  AdmissionsStats,
  AdmissionSourceReportItem,
  ApproveAdmissionRequest,
  ApproveAdmissionResponse,
  CreateAdmissionRequest,
  RejectAdmissionRequest,
  UpdateAdmissionStatusRequest,
} from '@schoolos/api-contracts';

export const admissionsApi = {
  stats:        ()                          => getClient().get<AdmissionsStats>('/admissions/stats').then(r => r.data),
  sourceReport: ()                          => getClient().get<AdmissionSourceReportItem[]>('/admissions/source-report').then(r => r.data),
  list:         (params?: { status?: string; source?: string; search?: string }) =>
                                            getClient().get<AdmissionListItem[]>('/admissions', { params }).then(r => r.data),
  get:          (id: string)                => getClient().get<AdmissionDetail>(`/admissions/${id}`).then(r => r.data),
  create:       (data: CreateAdmissionRequest) =>
                                            getClient().post<AdmissionListItem>('/admissions', data).then(r => r.data),
  updateStatus: (id: string, data: UpdateAdmissionStatusRequest) =>
                                            getClient().patch<AdmissionListItem>(`/admissions/${id}/status`, data).then(r => r.data),
  addNote:      (id: string, data: AddAdmissionNoteRequest) =>
                                            getClient().post(`/admissions/${id}/note`, data).then(r => r.data),
  approve:      (id: string, data: ApproveAdmissionRequest) =>
                                            getClient().post<ApproveAdmissionResponse>(`/admissions/${id}/approve`, data).then(r => r.data),
  reject:       (id: string, data: RejectAdmissionRequest) =>
                                            getClient().post<AdmissionDetail>(`/admissions/${id}/reject`, data).then(r => r.data),
  promotion: {
    createRule:  (d: any)                   => getClient().post('/admissions/promotion-rules', d).then(r => r.data),
    getRules:    (sessionId: string)        => getClient().get(`/admissions/promotion-rules/${sessionId}`).then(r => r.data),
    promote:     (d: any)                   => getClient().post('/admissions/promote', d).then(r => r.data),
    bulkPromote: (d: any)                   => getClient().post('/admissions/promote/bulk', d).then(r => r.data),
    history:     ()                         => getClient().get('/admissions/promotion-history').then(r => r.data),
  },
  alumni: {
    list:   (p?: any)                       => getClient().get('/admissions/alumni', { params: p }).then(r => r.data),
    get:    (id: string)                    => getClient().get(`/admissions/alumni/${id}`).then(r => r.data),
    create: (d: any)                        => getClient().post('/admissions/alumni', d).then(r => r.data),
    verify: (id: string)                    => getClient().post(`/admissions/alumni/${id}/verify`, {}).then(r => r.data),
  },
};
