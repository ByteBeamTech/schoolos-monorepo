import { useState, useEffect, useCallback } from "react";
import { admissionsApi, apiClient, bulkApi } from "./api";
import type {
  AdmissionDetail,
  AdmissionListItem,
  AdmissionsStats,
  ApproveAdmissionRequest,
  BulkCapabilitiesResponse,
  BulkInvoiceGenerateRequest,
  BulkTemplateFormat,
  CreateAdmissionRequest,
  RejectAdmissionRequest,
  UpdateAdmissionStatusRequest,
} from "@schoolos/api-contracts";

// ── Generic fetch hook ────────────────────────────────────────────────────────
// Skips fetch when url is empty string
export function useApi<T>(url: string, deps: any[] = []) {
  const [data, setData]       = useState<T | null>(null);
  const [loading, setLoading] = useState(!!url);
  const [error, setError]     = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    if (!url) { setLoading(false); setData(null); return; }
    setLoading(true); setError(null);
    try {
      const res = await apiClient.get(url);
      setData(res.data as T);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => { fetch_(); }, deps);
  return { data, loading, error, refetch: fetch_ };
}

// ── Dashboard stats ───────────────────────────────────────────────────────────
export interface DashboardStats {
  students:      { total: number; active: number };
  billing:       { totalCollected: number; pending: number; overdueCount: number };
  attendance:    { present: number; absent: number; percentage: number };
  notifications: { sent: number; failed: number; deliveryRate: number };
}

export function useDashboardStats(sessionId?: string) {
  const [stats, setStats]     = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    const load = async () => {
      const [studentsRes, notifRes, attendanceRes, billingRes] = await Promise.allSettled([
        apiClient.get("/students?limit=1"),
        apiClient.get("/notifications/stats"),
        apiClient.get(`/attendance/stats?date=${today}`),
        apiClient.get(`/billing/invoices/stats${sessionId ? `?academicYear=${sessionId}` : ""}`),
      ]);

      setStats({
        students: {
          total:  studentsRes.status === "fulfilled" ? (studentsRes.value.data?.meta?.total ?? 0) : 0,
          active: studentsRes.status === "fulfilled" ? (studentsRes.value.data?.meta?.total ?? 0) : 0,
        },
        billing: {
          totalCollected: billingRes.status === "fulfilled" ? (billingRes.value.data?.collectedAmount ?? 0) : 0,
          pending:        billingRes.status === "fulfilled" ? (billingRes.value.data?.totalAmount ?? 0) - (billingRes.value.data?.collectedAmount ?? 0) : 0,
          overdueCount:   billingRes.status === "fulfilled" ? (billingRes.value.data?.overdueCount ?? 0) : 0,
        },
        attendance: {
          present:    attendanceRes.status === "fulfilled" ? (attendanceRes.value.data?.present    ?? 0) : 0,
          absent:     attendanceRes.status === "fulfilled" ? (attendanceRes.value.data?.absent     ?? 0) : 0,
          percentage: attendanceRes.status === "fulfilled" ? (attendanceRes.value.data?.percentage ?? 0) : 0,
        },
        notifications: notifRes.status === "fulfilled" ? notifRes.value.data : { sent: 0, failed: 0, deliveryRate: 0 },
      });
      setLoading(false);
    };
    load();
  }, [sessionId, today]);

  return { stats, loading };
}

// ── Academic sessions ─────────────────────────────────────────────────────────
export interface AcademicSession {
  id: string; name: string; startDate: string; endDate: string;
  isCurrent: boolean; isLocked: boolean;
}
export function useAcademicSessions() {
  return useApi<AcademicSession[]>("/academic-sessions");
}

// ── Students ─────────────────────────────────────────────────────────────────
export interface Student {
  id: string; admissionNumber: string; firstName: string; lastName: string;
  status: string; rollNumber?: string;
  section?:       { id: string; name: string; class: { id: string; name: string } };
  // Widened for Collect Fee (Sprint 1): isPrimary and relation already
  // exist on GuardianStudent (backend/prisma/schema/students/relations.prisma)
  // -- this type never typed them. Needed for FR-SUMMARY-04 (Father's Name)
  // and the primary-guardian default (FDD Section 8.1, FR-PANEL-05, built
  // in a later sprint but the type is widened once here rather than twice).
  guardianLinks?: {
    isPrimary?: boolean;
    relation?: "FATHER" | "MOTHER" | "GRANDFATHER" | "GRANDMOTHER" | "UNCLE" | "AUNT" | "SIBLING" | "LEGAL_GUARDIAN";
    guardian: { id?: string; firstName: string; lastName: string; phone?: string; email?: string };
  }[];
  createdAt: string;
}

export function useStudents(
  page = 1,
  filters: Record<string, string> = {},
) {

  const params =
    new URLSearchParams();

  params.set(
    "page",
    String(page),
  );

  params.set(
    "limit",
    "20",
  );

  Object.entries(filters).forEach(
    ([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    },
  );

  return useApi<
    {
      data: Student[];
      meta: {
        total: number;
        page: number;
        lastPage: number;
      };
    }
  >(
    `/students?${params.toString()}`,
    [page, JSON.stringify(filters)],
  );
}




// ── Staff ─────────────────────────────────────────────────────────────────────
export interface StaffMember {
  id: string; employeeId: string; designation: string;
  department?: string; isActive: boolean; dateOfJoining: string;
  qualification?: string; experience?: number;
  user: { id: string; firstName: string; lastName: string; email: string; phone?: string; role: string };
}
export function useStaff(search = "", department = "") {
  const url = `/staff?${search ? `search=${encodeURIComponent(search)}&` : ""}${department ? `department=${department}` : ""}`;
  return useApi<StaffMember[]>(url, [search, department]);
}

// ── Academics ─────────────────────────────────────────────────────────────────
export interface AcademicClass {
  id: string; name: string; displayOrder: number;
  sections: Array<{ id: string; name: string; capacity: number; _count?: { students: number } }>;
}
export interface Subject {
  id: string; name: string; code?: string; isElective: boolean;
}
export function useClasses(sessionId: string) {
  return useApi<AcademicClass[]>(
    sessionId ? `/academics/classes?sessionId=${sessionId}` : "",
    [sessionId]
  );
}
export function useSubjects() {
  return useApi<Subject[]>("/academics/subjects");
}


// ── Attendance ────────────────────────────────────────────────────────────────
export interface AttendanceRecord {
  id: string; studentId: string; date: string; status: string;
  period?: number; remarks?: string;
  student: { id: string; firstName: string; lastName: string; admissionNumber: string; rollNumber?: string };
}
export function useAttendanceStats(date: string) {
  return useApi<{ date: string; total: number; present: number; absent: number; late: number; percentage: number }>(
    date ? `/attendance/stats?date=${date}` : "", [date]
  );
}

// ── Timetable ─────────────────────────────────────────────────────────────────
export interface TimetableSlot {
  id: string; sectionId: string; subjectId: string; teacherId: string;
  dayOfWeek: number; periodNumber: number; startTime: string; endTime: string;
  roomId?: string; isActive: boolean;
}
export interface WeeklyTimetable {
  sectionId: string; totalSlots: number;
  days: Array<{ day: number; dayName: string; slots: TimetableSlot[] }>;
}
export function useTimetable(sectionId: string) {
  return useApi<WeeklyTimetable>(
    sectionId ? `/timetable/section/${sectionId}` : "", [sectionId]
  );
}

// ── Examinations ──────────────────────────────────────────────────────────────
export interface Exam {
  id: string; name: string; type: string; startDate: string; endDate: string;
  isPublished: boolean; sessionId: string;
  _count?: { schedules: number; marks: number };
}
export interface ExamSchedule {
  id: string; subjectId: string; classId: string; date: string;
  startTime: string; endTime: string; maxMarks: number; passMarks: number;
}
export function useExams(sessionId: string) {
  return useApi<Exam[]>(sessionId ? `/examinations?sessionId=${sessionId}` : "", [sessionId]);
}
export function useExamStats(sessionId: string) {
  return useApi<{ total: number; published: number; upcoming: number; completed: number }>(
    sessionId ? `/examinations/stats?sessionId=${sessionId}` : "", [sessionId]
  );
}

// ── Billing — Fee Plans ───────────────────────────────────────────────────────
export interface FeeItem {
  id: string; name: string; amount: number;
  isOptional: boolean; dueDate?: string; gstRate?: number;
}
export interface FeePlan {
  id: string; name: string; academicYear: string; grade?: string;
  currency: string; isActive: boolean;
  feeItems: FeeItem[];
  _count?: { assignments: number };
}
export function useFeePlans(academicYear?: string) {
  return useApi<FeePlan[]>(
    `/billing/fee-plans${academicYear ? `?academicYear=${academicYear}` : ""}`,
    [academicYear]
  );
}

// ── Billing — Invoices ────────────────────────────────────────────────────────
export interface Invoice {
  id: string; invoiceNumber: string; status: string;
  academicYear: string; currency: string;
  subtotal: number; totalAmount: number; paidAmount: number; dueAmount: number;
  dueDate: string; paidAt?: string; issuedAt?: string;
  // M5: server-computed, see invoice/overdue.util.ts (backend). The single
  // source of overdue-ness -- never re-derive this from status + dueDate.
  isOverdue?: boolean;
  student: { id: string; firstName: string; lastName: string; admissionNumber: string };
  items: Array<{
    name: string; amount: number; netAmount: number;
    // Widened for Collect Fee (Sprint 1): these fields already come back
    // from the backend's findAll()/findById() today -- this type simply
    // never typed them. No backend change; a type correction matching
    // what the response already contains.
    chargeCategory?: string; discountAmount?: number; feeItemId?: string | null;
  }>;
  // Widened for Collect Fee (Sprint 1) -- same reasoning as items above.
  // Optional because list-context callers (e.g. the Invoices page) may not
  // need these and the endpoint's exact include shape can vary by route;
  // Collect Fee's own data fetch (useStudentBilling below) is written
  // defensively against any of these being absent.
  lateFees?: Array<{ id: string; amount: number; amountWaived?: number; status?: string; appliedAt?: string; waivedAt?: string }>;
  payments?: Array<{
    id: string; amount: number; status: string; paidAt?: string; paymentMethod?: string;
    payerId?: string; payerName?: string;
    // M6: derived field, replaces the removed PaymentStatus.REFUNDED/
    // PARTIALLY_REFUNDED values -- see refund/refund-status.util.ts (backend).
    refundState?: "NONE" | "PARTIAL" | "FULL";
  }>;
  receipts?: Array<{ id: string; receiptNumber: string; amount: number; paymentId: string; createdAt: string }>;
}
export interface InvoiceStats {
  totalInvoices: number; totalAmount: number; collectedAmount: number;
  overdueCount: number; draftCount: number; paidCount: number;
}
// Single-student fetch (Sprint 4: Student Financial Profile). Confirmed
// directly against students.service.ts's findById(): includes section,
// guardianLinks (with the full Guardian row), and transportAssignment.route
// -- the last of these resolves the previously-unverified "is Transport
// route data reachable" question (FDD Section 24, item 12) for real.
export interface StudentDetail extends Student {
  transportAssignment?: { route?: { id: string; name: string } } | null;
}
export function useStudent(id?: string) {
  return useApi<StudentDetail>(id ? `/students/${id}` : "", [id]);
}

export function useInvoices(filters: { studentId?: string; status?: string; academicYear?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.studentId)   params.set("studentId",   filters.studentId);
  if (filters.status)      params.set("status",      filters.status);
  if (filters.academicYear) params.set("academicYear", filters.academicYear);
  const q = params.toString();
  return useApi<Invoice[]>(`/billing/invoices${q ? `?${q}` : ""}`, [q]);
}
// Single-invoice fetch (Receipt Detail Sprint 3, and Invoice Detail later)
// -- reuses the exact same GET /billing/invoices/:id findById() the
// backend already exposes, the only route that returns a receipt's data,
// since no dedicated receipt endpoint exists (see BA-5-adjacent finding:
// ReceiptService.getReceiptUrl() has no controller).
export function useInvoice(id?: string) {
  return useApi<Invoice>(id ? `/billing/invoices/${id}` : "", [id]);
}
export function useInvoiceStats(academicYear?: string) {
  return useApi<InvoiceStats>(
    `/billing/invoices/stats${academicYear ? `?academicYear=${academicYear}` : ""}`,
    [academicYear]
  );
}

// ── Collect Fee (Sprint 1) ──────────────────────────────────────────────────
// FDD Section 12: Collect Fee workspace. Composed from existing endpoints
// only -- no new backend route. Three parallel calls per FDD Section 11.2's
// data needs: every invoice for grouping (Section 12.4), active discounts
// for the Fee Relaxation indicator (FR-SUMMARY-06), fee plans for Current
// Fee Plan (FR-SUMMARY-11). Each already exists and is reused as-is per the
// Student Billing reuse audit.
export interface DiscountSummary {
  id: string; category?: { name?: string }; isActive: boolean; approvalStatus: string; appliedAmount: number; createdAt?: string;
}
// Bug fix: GET /billing/fee-plans/student/:id returns FeeAssignment[], not
// FeePlan[] directly -- confirmed by reading fee-plans.service.ts's
// getStudentFeePlans() precisely. The plan's own name/id live nested under
// .feePlan, not at the top level. The previous version of this type
// (`{id, name, academicYear}`) never matched what this endpoint actually
// returns.
export interface FeePlanSummary {
  id: string; assignedAt?: string;
  feePlan: { id: string; name: string; academicYear?: string };
}

export function useStudentBilling(studentId?: string) {
  const invoices = useApi<Invoice[]>(
    studentId ? `/billing/invoices?studentId=${studentId}` : "",
    [studentId],
  );
  const discounts = useApi<DiscountSummary[]>(
    studentId ? `/billing/discounts?studentId=${studentId}&approvalStatus=APPROVED` : "",
    [studentId],
  );
  const feePlans = useApi<FeePlanSummary[]>(
    studentId ? `/billing/fee-plans/student/${studentId}` : "",
    [studentId],
  );

  return {
    invoices: invoices.data ?? [],
    discounts: (discounts.data ?? []).filter((d) => d.isActive),
    feePlans: feePlans.data ?? [],
    loading: invoices.loading || discounts.loading || feePlans.loading,
    error: invoices.error ?? discounts.error ?? feePlans.error,
    refetch: () => { invoices.refetch(); discounts.refetch(); feePlans.refetch(); },
  };
}

export function useBillingAnalytics(
  filters: {

    academicYear?: string;
    fromDate?: string;
    toDate?: string;
  } = {},
) {
  const params =
    new URLSearchParams();

  Object.entries(filters).forEach(
    ([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    },
  );

  const qs = params.toString();

  return useApi<any>(
    `/billing/analytics${qs ? `?${qs}` : ""}`,
    [JSON.stringify(filters)],
  );
}

// ── Notifications ─────────────────────────────────────────────────────────────
export function useNotificationStats() {
  return useApi<{ total: number; sent: number; failed: number; pending: number; deliveryRate: number }>(
    "/notifications/stats"
  );
}

// ── Transport ─────────────────────────────────────────────────────────────────
export interface TransportRoute {
  id: string; name: string; vehicleNumber?: string; driverName?: string;
  driverPhone?: string; feeAmount: number; status: string;
  _count?: { assignments: number };
}
export function useTransportRoutes() {
  return useApi<TransportRoute[]>("/transport/routes");
}
export function useTransportStats() {
  return useApi<{ routes: number; assigned: number }>("/transport/stats");
}

// ── Admissions ────────────────────────────────────────────────────────────────
export function useAdmissions(filters: { status?: string; source?: string; search?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.source) params.set("source", filters.source);
  if (filters.search) params.set("search", filters.search);
  const q = params.toString();
  return useApi<AdmissionListItem[]>(`/admissions${q ? `?${q}` : ""}`, [q]);
}
export function useAdmissionDetail(id?: string) {
  return useApi<AdmissionDetail>(id ? `/admissions/${id}` : "", [id]);
}
export function useAdmissionStats() {
  return useApi<AdmissionsStats>("/admissions/stats");
}
export function useAdmissionsActions() {
  return {
    createAdmission: (data: CreateAdmissionRequest) => admissionsApi.create(data),
    updateAdmissionStatus: (id: string, data: UpdateAdmissionStatusRequest) => admissionsApi.updateStatus(id, data),
    approveAdmission: (id: string, data: ApproveAdmissionRequest) => admissionsApi.approve(id, data),
    rejectAdmission: (id: string, data: RejectAdmissionRequest) => admissionsApi.reject(id, data),
  };
}

// ── HR ────────────────────────────────────────────────────────────────────────
export interface JoiningRequest {
  id: string; candidateName: string; email: string; phone: string;
  position: string; department?: string; proposedSalary?: number;
  status: string; currentLevel: number; maxLevel: number; createdAt: string;
}
export interface StaffLeave {
  id: string; leaveType: string; fromDate: string; toDate: string;
  totalDays: number; reason: string; status: string; createdAt: string;
}
export function useJoiningRequests(status?: string) {
  const q = status ? `?status=${status}` : "";
  return useApi<JoiningRequest[]>(`/hr/joining${q}`, [status]);
}
export function useLeaveRequests(status?: string) {
  const q = status ? `?status=${status}` : "";
  return useApi<StaffLeave[]>(`/hr/leave${q}`, [status]);
}
export function useLeaveBalances(staffId?: string) {
  return useApi<any>(`/hr/leave/balances${staffId ? `?staffId=${staffId}` : ""}`, [staffId]);
}

// ── Reception ─────────────────────────────────────────────────────────────────
export interface Complaint {
  id: string; ticketNumber: string; complainantName: string;
  complainantType: string; category: string; subject: string;
  description: string; priority: string; status: string; createdAt: string;
}
export interface Visitor {
  id: string; passNumber: string; visitorName: string; phone: string;
  company?: string; purpose: string; personToMeet: string;
  checkIn: string; checkOut?: string; status: string;
}
export function useComplaints(status?: string) {
  const q = status ? `?status=${status}` : "";
  return useApi<Complaint[]>(`/reception/complaints${q}`, [status]);
}
export function useVisitors(status?: string) {
  const q = status ? `?status=${status}` : "";
  return useApi<Visitor[]>(`/reception/visitors${q}`, [status]);
}
export function useVisitorStats() {
  return useApi<{ checkedIn: number; checkedOut: number; total: number }>("/reception/visitors/stats/today");
}

// ── Payroll ───────────────────────────────────────────────────────────────────
export interface PayrollPayslip {
  id: string; staffId: string; month: number; year: number;
  grossSalary: number; pfDeduction: number; tdsDeduction: number;
  netSalary: number; status: string;
}
export function usePayslips(month?: number, year?: number) {
  const now = new Date();
  const m = month ?? now.getMonth() + 1;
  const y = year ?? now.getFullYear();
  return useApi<PayrollPayslip[]>(`/payroll/payslips?month=${m}&year=${y}`, [m, y]);
}
export function usePayrollStats(month?: number, year?: number) {
  const now = new Date();
  const m = month ?? now.getMonth() + 1;
  const y = year ?? now.getFullYear();
  return useApi<{ total: number; paid: number; draft: number; totalNet: number }>(`/payroll/stats?month=${m}&year=${y}`, [m, y]);
}
export function usePayrollStructures() {
  return useApi<any[]>("/payroll/structures");
}

// ── Accounting ────────────────────────────────────────────────────────────────
export interface Expense {
  id: string; title: string; category: string; amount: number;
  expenseDate: string; vendor?: string; notes?: string; createdAt: string;
}
export interface Vendor {
  id: string; name: string; category?: string; email?: string;
  phone?: string; isActive: boolean;
}
export function useExpenses(filters: { category?: string; fromDate?: string; toDate?: string } = {}) {
  const p = new URLSearchParams();
  if (filters.category) p.set("category", filters.category);
  if (filters.fromDate) p.set("fromDate", filters.fromDate);
  if (filters.toDate)   p.set("toDate",   filters.toDate);
  const q = p.toString();
  return useApi<Expense[]>(`/accounting/expenses${q ? `?${q}` : ""}`, [q]);
}
export function useVendors() {
  return useApi<Vendor[]>("/accounting/vendors");
}
export function useAccountingStats() {
  return useApi<{ totalExpenses: number; expenseCount: number; thisMonthTotal: number; activeVendors: number; byCategory: any[] }>("/accounting/stats");
}

// ── Communication ─────────────────────────────────────────────────────────────
export interface Announcement {
  id: string; title: string; body: string; isPinned: boolean;
  publishedAt?: string; expiresAt?: string; createdAt: string;
}
export interface Circular {
  id: string; title: string; body: string; publishedAt?: string; createdAt: string;
}
export function useAnnouncements() {
  return useApi<Announcement[]>("/communication/announcements");
}
export function useCirculars() {
  return useApi<Circular[]>("/communication/circulars");
}
export function useCommunicationStats() {
  return useApi<{ announcements: number; pinned: number; circulars: number }>("/communication/stats");
}

// ── Homework ──────────────────────────────────────────────────────────────────
export interface Homework {
  id: string; title: string; classId: string; subjectId: string;
  dueDate: string; maxMarks?: number; description?: string;
  _count?: { submissions: number };
}
export function useHomework(classId?: string) {
  return useApi<Homework[]>(classId ? `/homework?classId=${classId}` : "/homework", [classId]);
}
export function useHomeworkStats() {
  return useApi<{ total: number; dueSoon: number; submitted: number }>("/homework/stats");
}

// ── Library ───────────────────────────────────────────────────────────────────
export interface Book {
  id: string; title: string; author?: string; isbn?: string;
  category?: string; totalCopies: number; availableCopies: number;
}
export interface BookIssue {
  id: string; bookId: string; studentId: string; issueDate: string;
  dueDate: string; returnDate?: string; status: string;
  book?: { title: string }; student?: { firstName: string; lastName: string };
}
export function useBooks(search?: string) {
  return useApi<Book[]>(search ? `/library/books?search=${encodeURIComponent(search)}` : "/library/books", [search]);
}
export function useBookIssues(status?: string) {
  return useApi<BookIssue[]>(status ? `/library/issues?status=${status}` : "/library/issues", [status]);
}
export function useLibraryStats() {
  return useApi<{ totalBooks: number; issued: number; overdue: number; available: number }>("/library/stats");
}

// ── Inventory ─────────────────────────────────────────────────────────────────
export interface Asset {
  id: string; name: string; category?: string; quantity: number;
  condition: string; location?: string;
}
export function useAssets(category?: string) {
  return useApi<Asset[]>(category ? `/inventory/assets?category=${category}` : "/inventory/assets", [category]);
}
export function useStockItems() {
  return useApi<any[]>("/inventory/stock");
}
export function useInventoryStats() {
  return useApi<{ totalAssets: number; goodCondition: number; needsRepair: number }>("/inventory/stats");
}

// ── Certificates ──────────────────────────────────────────────────────────────
export interface Certificate {
  id: string; certNumber: string; studentName: string;
  className: string; type: string; reason?: string; issuedAt: string;
}
export function useCertificates() {
  return useApi<Certificate[]>("/certificates");
}

// ── Gradebook ─────────────────────────────────────────────────────────────────
export function useGradeBoundaries(sessionId: string) {
  return useApi<any[]>(sessionId ? `/gradebook/boundaries?sessionId=${sessionId}` : "", [sessionId]);
}
export function useStudentReport(studentId: string, examId: string) {
  return useApi<any>(studentId && examId ? `/gradebook/report/${studentId}?examId=${examId}` : "", [studentId, examId]);
}

// ── Bulk ──────────────────────────────────────────────────────────────────────
export function useBulkJobStatus(jobId?: string) {
  return useApi<any>(jobId ? `/bulk/jobs/${jobId}` : "", [jobId]);
}

export function useBulkCapabilities() {
  return useApi<BulkCapabilitiesResponse>("/bulk/capabilities");
}

export function useBulkActions() {
  return {
    importStudentsFromText: (csv: string) =>
      bulkApi.importStudentsFromText({ csv }),
    importStudentsFromFile: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return bulkApi.importStudentsFromFile(formData);
    },
    generateInvoicesForClass: (data: BulkInvoiceGenerateRequest) =>
      bulkApi.generateInvoicesForClass(data),
    
      downloadStudentTemplate: (format: "csv" | "excel") => 
  bulkApi.downloadStudentTemplate(format),
      
  };
}

// ── Staff (individual record) ─────────────────────────────────────────────────
export function useStaffById(id?: string) {
  return useApi<any>(id ? `/staff/${id}` : '', [id]);
}

export function useStaffSubjectPreferences(staffId?: string) {
  return useApi<any[]>(staffId ? `/staff/${staffId}/subject-preferences` : '', [staffId]);
}


// ── Phase 2 hooks (appended by deploy script — do not delete this marker) ─────

export function useCollectionDashboard(academicYear?: string, classId?: string) {
  const params = new URLSearchParams();
  if (academicYear) params.set("academicYear", academicYear);
  if (classId)      params.set("classId",      classId);
  const qs = params.toString();
  return useApi<{
    summary: {
      totalAmount: number; collectedAmount: number; pendingAmount: number;
      overdueCount: number; totalInvoices: number; paidCount: number; collectionRate: number;
    };
    byClass: Array<{
      classId: string; className: string; totalAmount: number; collectedAmount: number;
      pendingAmount: number; invoiceCount: number; paidCount: number; collectionRate: number;
    }>;
  }>(`/billing/invoices/collection-dashboard${qs ? "?" + qs : ""}`, [qs]);
}

export function useTimetableFull(sectionId?: string) {
  return useApi<{
    sectionId: string; className: string | null; totalSlots: number;
    days: Array<{
      day: number; dayName: string;
      slots: Array<{
        id: string; periodNumber: number; startTime: string; endTime: string;
        subject: { id: string; name: string; code: string } | null;
        teacher: { id: string; name: string } | null;
      }>;
    }>;
  }>(sectionId ? `/timetable/section/${sectionId}/full` : "", [sectionId]);
}


// ───────────────────────────────────────────────────────────────────────────
// CRM hooks (Phase 1)
// ───────────────────────────────────────────────────────────────────────────
import { crmApi } from "./api";
import type {
  Lead,
  LeadListResponse,
  ListLeadsQuery,
  FollowUpTask,
  InteractionLog,
  CrmDashboardSummary,
  CreateLeadRequest,
  UpdateLeadRequest,
  AssignLeadRequest,
  ChangeLeadStatusRequest,
  CreateFollowUpRequest,
  UpdateFollowUpRequest,
  CreateInteractionRequest,
} from "@schoolos/api-client";

export function useCrmDashboard(branchId?: string) {
  const [data, setData] = useState<CrmDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await crmApi.dashboard.summary(branchId ? { branchId } : undefined);
      setData(r);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Failed to load dashboard");
    } finally { setLoading(false); }
  }, [branchId]);
  useEffect(() => { load(); }, [load]);
  return { data, loading, error, refetch: load };
}

export function useLeads(query?: ListLeadsQuery) {
  const [data, setData] = useState<LeadListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(query || {});
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await crmApi.leads.list(query);
      setData(r);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Failed to load leads");
    } finally { setLoading(false); }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  return { data, loading, error, refetch: load };
}

export function useLead(id: string | undefined) {
  const [data, setData] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!id) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const r = await crmApi.leads.get(id);
      setData(r);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Failed to load lead");
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  return { data, loading, error, refetch: load };
}

export function useFollowUpsForLead(leadId: string | undefined) {
  const [data, setData] = useState<FollowUpTask[]>([]);
  const [loading, setLoading] = useState(!!leadId);
  const load = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    try {
      const r = await crmApi.followUps.listByLead(leadId);
      setData(r);
    } finally { setLoading(false); }
  }, [leadId]);
  useEffect(() => { load(); }, [load]);
  return { data, loading, refetch: load };
}

export function useInteractionsForLead(leadId: string | undefined) {
  const [data, setData] = useState<InteractionLog[]>([]);
  const [loading, setLoading] = useState(!!leadId);
  const load = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    try {
      const r = await crmApi.interactions.listByLead(leadId);
      setData(r);
    } finally { setLoading(false); }
  }, [leadId]);
  useEffect(() => { load(); }, [load]);
  return { data, loading, refetch: load };
}

export function useCrmActions() {
  return {
    createLead:        (data: CreateLeadRequest)            => crmApi.leads.create(data),
    updateLead:        (id: string, data: UpdateLeadRequest)=> crmApi.leads.update(id, data),
    assignLead:        (id: string, data: AssignLeadRequest)=> crmApi.leads.assign(id, data),
    changeLeadStatus:  (id: string, data: ChangeLeadStatusRequest) => crmApi.leads.changeStatus(id, data),
    createFollowUp:    (leadId: string, data: CreateFollowUpRequest) => crmApi.followUps.create(leadId, data),
    updateFollowUp:    (id: string, data: UpdateFollowUpRequest) => crmApi.followUps.update(id, data),
    logInteraction:    (leadId: string, data: CreateInteractionRequest) => crmApi.interactions.create(leadId, data),
  };
}
