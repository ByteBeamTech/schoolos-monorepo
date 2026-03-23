export interface PaymentSuccessEvent {
  tenantId:    string;
  studentId:   string;
  invoiceId:   string;
  paymentId:   string;
  amount:      number;
  currency:    string;
  method:      string;
}

export interface InvoiceGeneratedEvent {
  tenantId:      string;
  studentId:     string;
  invoiceId:     string;
  invoiceNumber: string;
  totalAmount:   number;
  dueDate:       string;
}

export interface AttendanceMarkedEvent {
  tenantId:   string;
  sectionId:  string;
  date:       string;
  present:    number;
  absent:     number;
  percentage: number;
  absentStudentIds: string[];
}

export interface LeaveAppliedEvent {
  tenantId:  string;
  staffId:   string;
  leaveId:   string;
  leaveType: string;
  fromDate:  string;
  toDate:    string;
}

export interface LeaveDecisionEvent {
  tenantId:  string;
  staffId:   string;
  leaveId:   string;
  status:    'APPROVED' | 'REJECTED';
  comments?: string;
}

export interface StudentEnrolledEvent {
  tenantId:  string;
  studentId: string;
  sectionId?: string;
  academicYear: string;
}
