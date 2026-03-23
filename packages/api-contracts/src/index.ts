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
  notes?: string;
  assignedSectionId?: string;
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
