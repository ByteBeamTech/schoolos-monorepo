import { getClient } from '../client';

// ----- Types (kept inline; promote to @schoolos/api-contracts later if needed) -----

export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'FOLLOW_UP'
  | 'VISIT_SCHEDULED'
  | 'INTERESTED'
  | 'APPLICATION_STARTED'
  | 'APPLICATION_SUBMITTED'
  | 'APPROVED'
  | 'ENROLLED'
  | 'LOST';

export type LeadTemperature = 'COLD' | 'WARM' | 'HOT';

export interface UserMini {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface Lead {
  id: string;
  tenantId: string;
  branchId: string;
  parentName: string;
  parentPhone: string;
  parentEmail?: string | null;
  studentName?: string | null;
  gradeInterestedIn: string;
  expectedEnrollYear: number;
  status: LeadStatus;
  temperature: LeadTemperature;
  sourceId?: string | null;
  source?: { id: string; name: string } | null;
  campaign?: { id: string; name: string } | null;
  assignedToId?: string | null;
  assignedTo?: UserMini | null;
  referredBy?: UserMini | null;
  applicationId?: string | null;
  application?: {
    id: string;
    crmNo: string;
    status: string;
    stepStatus: string;
    convertedAt?: string | null;
    studentId?: string | null;
  } | null;
  notes?: unknown;
  createdAt: string;
  updatedAt: string;
  _count?: { tasks: number; interactions: number };
}

export type FollowUpStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface FollowUpTask {
  id: string;
  tenantId: string;
  leadId: string;
  assignedToId: string;
  assignedTo?: UserMini;
  title: string;
  description?: string | null;
  dueDate: string;
  completedAt?: string | null;
  status: FollowUpStatus;
  createdAt: string;
  updatedAt: string;
  lead?: {
    id: string;
    parentName: string;
    parentPhone: string;
    studentName?: string | null;
    status: LeadStatus;
    branchId: string;
  };
}

export type InteractionType = 'CALL' | 'WHATSAPP' | 'EMAIL' | 'SMS' | 'MEETING';
export type InteractionDirection = 'INBOUND' | 'OUTBOUND';

export interface InteractionLog {
  id: string;
  tenantId: string;
  leadId: string;
  type: InteractionType;
  direction: InteractionDirection;
  summary: string;
  mediaUrl?: string | null;
  handledById: string;
  handledBy?: UserMini;
  interactedAt: string;
}

export interface LeadListResponse {
  items: Lead[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CrmDashboardSummary {
  scope: { tenantId: string; branchId?: string; tenantWide: boolean };
  counts: {
    newLeads: number;
    openLeads: number;
    todaysFollowUps: number;
    overdueFollowUps: number;
    applicationsSubmitted: number;
    applicationsPendingApproval: number;
    admissionsApproved: number;
    admissionsRejected: number;
    enrollmentsCompleted: number;
  };
  pipeline: Array<{ status: LeadStatus; count: number }>;
  workQueue: {
    todaysFollowUps: Array<{
      id: string;
      title: string;
      dueDate: string;
      leadId: string;
      leadName: string;
      leadPhone: string;
      assignedToId: string;
    }>;
    overdueFollowUps: Array<{
      id: string;
      title: string;
      dueDate: string;
      leadId: string;
      leadName: string;
      leadPhone: string;
      assignedToId: string;
    }>;
  };
  conversion: {
    leadsCreated: number;
    applicationsCreated: number;
    enrolled: number;
    leadToApplicationPct: number;
    applicationToEnrolledPct: number;
    leadToEnrolledPct: number;
  };
  sources: Array<{
    sourceId: string | null;
    sourceName: string;
    leads: number;
    enrolled: number;
    conversionPct: number;
  }>;
}

// ----- Request DTOs (mirror backend DTOs) -----

export interface CreateLeadRequest {
  parentName: string;
  parentPhone: string;
  parentEmail?: string;
  studentName?: string;
  gradeInterestedIn: string;
  expectedEnrollYear: number;
  sourceId?: string;
  campaignId?: string;
  assignedToId?: string;
  referredById?: string;
  temperature?: LeadTemperature;
  initialNote?: string;
}

export type UpdateLeadRequest = Partial<
  Omit<CreateLeadRequest, 'parentName' | 'parentPhone' | 'gradeInterestedIn' | 'expectedEnrollYear' | 'initialNote'>
> & {
  parentName?: string;
  parentPhone?: string;
  gradeInterestedIn?: string;
  expectedEnrollYear?: number;
};

export interface AssignLeadRequest { assignedToId: string }
export interface ChangeLeadStatusRequest { status: LeadStatus; reason?: string }

export interface CreateFollowUpRequest {
  title: string;
  description?: string;
  dueDate: string; // ISO
  assignedToId?: string;
}
export interface UpdateFollowUpRequest {
  title?: string;
  description?: string;
  dueDate?: string;
  status?: FollowUpStatus;
  assignedToId?: string;
}

export interface CreateInteractionRequest {
  type: InteractionType;
  direction: InteractionDirection;
  summary: string;
  mediaUrl?: string;
}

export interface ListLeadsQuery {
  status?: LeadStatus;
  temperature?: LeadTemperature;
  assignedToId?: string;
  sourceId?: string;
  search?: string;
  branchId?: string;
  page?: number;
  pageSize?: number;
  mineOnly?: 'true' | 'false';
}

// ----- API surface -----

export const crmApi = {
  leads: {
    list:   (params?: ListLeadsQuery)            => getClient().get<LeadListResponse>('/crm/leads', { params }).then(r => r.data),
    get:    (id: string)                         => getClient().get<Lead>(`/crm/leads/${id}`).then(r => r.data),
    create: (data: CreateLeadRequest)            => getClient().post<Lead>('/crm/leads', data).then(r => r.data),
    update: (id: string, data: UpdateLeadRequest)=> getClient().patch<Lead>(`/crm/leads/${id}`, data).then(r => r.data),
    assign: (id: string, data: AssignLeadRequest)=> getClient().patch<Lead>(`/crm/leads/${id}/assign`, data).then(r => r.data),
    changeStatus: (id: string, data: ChangeLeadStatusRequest) =>
                                                    getClient().patch<Lead>(`/crm/leads/${id}/status`, data).then(r => r.data),
  },
  followUps: {
    listByLead: (leadId: string)                => getClient().get<FollowUpTask[]>(`/crm/leads/${leadId}/follow-ups`).then(r => r.data),
    create:     (leadId: string, data: CreateFollowUpRequest) =>
                                                    getClient().post<FollowUpTask>(`/crm/leads/${leadId}/follow-ups`, data).then(r => r.data),
    listMine:   (params?: { status?: FollowUpStatus; window?: 'today' | 'overdue' | 'upcoming'; assignedToId?: string; leadId?: string }) =>
                                                    getClient().get<FollowUpTask[]>('/crm/follow-ups', { params }).then(r => r.data),
    update:     (id: string, data: UpdateFollowUpRequest) =>
                                                    getClient().patch<FollowUpTask>(`/crm/follow-ups/${id}`, data).then(r => r.data),
  },
  interactions: {
    listByLead: (leadId: string)                => getClient().get<InteractionLog[]>(`/crm/leads/${leadId}/interactions`).then(r => r.data),
    create:     (leadId: string, data: CreateInteractionRequest) =>
                                                    getClient().post<InteractionLog>(`/crm/leads/${leadId}/interactions`, data).then(r => r.data),
  },
  dashboard: {
    summary: (params?: { branchId?: string }) =>
                                                    getClient().get<CrmDashboardSummary>('/crm/dashboard/summary', { params }).then(r => r.data),
  },
};
