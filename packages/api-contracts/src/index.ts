// @schoolos/api-contracts

import type { AdmissionSource, AdmissionStatus } from '@schoolos/types';

export interface AdmissionListItem {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY' | null;
  phone: string;
  alternatePhone: string | null;
  parentFirstName: string | null;
  parentLastName: string | null;
  parentPhone: string | null;
  parentEmail: string | null;
  email: string | null;
  applyingForClass: string;
  academicYear: string;
  previousSchool: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  source: AdmissionSource;
  status: AdmissionStatus;
  notes: string | null;
  followUpDate: string | null;
  rejectionReason: string | null;
  enrolledStudentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdmissionActivity {
  id: string;
  admissionId: string;
  tenantId: string;
  actorId: string;
  action: string;
  note: string | null;
  createdAt: string;
}

export interface AdmissionDetail extends AdmissionListItem {
  activities: AdmissionActivity[];
}

export interface AdmissionsStats {
  total: number;
  thisMonth: number;
  enrolled: number;
  inquiries: number;
  conversionRate: number;
  byStatus: Partial<Record<AdmissionStatus, number>>;
}

export interface AdmissionSourceReportItem {
  source: AdmissionSource;
  count: number;
}

export interface CreateAdmissionRequest {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';
  phone: string;
  alternatePhone?: string;
  parentFirstName?: string;
  parentLastName?: string;
  parentPhone?: string;
  parentEmail?: string;
  applyingForClass: string;
  academicYear: string;
  previousSchool?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  pincode?: string;
  email?: string;
  source?: AdmissionSource;
  notes?: string;
  counsellorId?: string;
  followUpDate?: string;
}

export interface UpdateAdmissionStatusRequest {
  status: AdmissionStatus;
  note?: string;
  rejectionReason?: string;
  followUpDate?: string;
}

export interface AddAdmissionNoteRequest {
  note: string;
}

export interface ApproveAdmissionRequest {
  // Section assignment
  assignedSectionId: string;
  admissionNumber:   string;
  rollNumber?:       string;

  // Student personal details (filled at enrollment time)
  dateOfBirth:       string;
  gender:            'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY' | '';
  bloodGroup?:       string;

  // Guardian details (created alongside the student record)
  guardianFirstName: string;
  guardianLastName:  string;
  guardianPhone:     string;
  guardianEmail?:    string;
  guardianRelation:  'FATHER' | 'MOTHER' | 'GUARDIAN' | 'OTHER';

  // Address
  addressLine?:      string;
  city?:             string;
  state?:            string;
  pincode?:          string;

  // Misc
  notes?:            string;
}

export interface RejectAdmissionRequest {
  reason: string;
}

export interface ApproveAdmissionResponse {
  admission: AdmissionDetail;
  student: {
    id: string;
    admissionNumber: string;
    firstName: string;
    lastName: string;
    sectionId: string | null;
    academicYear: string;
    isActive: boolean;
  };
}


export interface BehaviorRecord {
  id:                string;
  studentId:         string;
  tenantId:          string;
  type:              'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  category:          string;
  title?:            string;
  description:       string;
  points?:           number;
  severity?:         'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  actionTaken?:      string;
  parentNotified?:   boolean;
  followUpRequired?: boolean;
  status:            'OPEN' | 'RESOLVED' | 'ESCALATED';
  reportedBy?:       string;
  incidentDate:      string;
  resolvedAt?:       string;
  resolvedBy?:       string;
  resolutionNote?:   string;
  createdAt:         string;
  updatedAt:         string;
}

export interface CreateBehaviorRecordRequest {
  studentId?:        string;
  type:              'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  category:          string;
  title?:            string;
  description:       string;
  points?:           number;
  reportedBy?:       string;
  incidentDate:      string;
  severity?:         'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  actionTaken?:      string;
  parentNotified?:   boolean;
  followUpRequired?: boolean;
}

// /apps/schoolos/packages/api-contracts/src/index.ts के अंत में जोड़ें

export interface BulkCapabilitiesResponse {
  supportedEntities: string[];
  maxBatchSize:      number;
  features: {
    import:   boolean;
    export:   boolean;
    generate: boolean;
  };
  canImportStudents:  boolean;
  canGenerateInvoices: boolean;
  canAccessBulkPage:  boolean;
}
export interface BulkInvoiceGenerateRequest {
  studentIds?: string[];
  academicYear: string;
  month?: string;
  dueDate?: string;
  feePlanId?:    string;     // 🚀 Added: Target by Fee Plan
  classId?:      string;     // 🚀 Added: Target by Class
}

export interface BulkTemplateFormat {
  id: string;
  name: string;
  columns: string[];
}



export * from './pricing';
