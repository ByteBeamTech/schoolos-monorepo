// packages/api-client/src/endpoints/behavior.ts
import { getClient } from '../client';
import type { 
  BehaviorRecord, 
  CreateBehaviorRecordRequest 
} from '@schoolos/api-contracts';

// Student behavior / discipline records
export const behaviorApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    studentId?: string;
    type?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    from?: string;
    to?: string;
  }) => getClient().get<BehaviorRecord[]>('/behavior', { params }).then(r => r.data),

  getById: (id: string) =>
    getClient().get<BehaviorRecord>(`/behavior/${id}`).then(r => r.data),

  // 🚀 Single Source of Truth: Using CreateBehaviorRecordRequest directly
  create: (data: CreateBehaviorRecordRequest) => 
    getClient().post<BehaviorRecord>('/behavior', data).then(r => r.data),

  update: (id: string, data: Partial<CreateBehaviorRecordRequest> & { status?: string }) => 
    getClient().patch<BehaviorRecord>(`/behavior/${id}`, data).then(r => r.data),

  delete: (id: string) =>
    getClient().delete(`/behavior/${id}`).then(r => r.data),

  getStudentSummary: (studentId: string) =>
    getClient().get(`/behavior/student/${studentId}/summary`).then(r => r.data),
};
