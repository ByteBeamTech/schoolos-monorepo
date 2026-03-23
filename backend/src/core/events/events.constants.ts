// SchoolOS Domain Events
// Rule: Every state-changing operation must emit an event
// Consumers: NotificationService, AnalyticsService, AlertService, CronEngine

export const EVENTS = {
  // ── Billing ──────────────────────────────────────────────────────────────
  PAYMENT_SUCCESS:               'payment.success',
  PAYMENT_FAILED:                'payment.failed',
  INVOICE_GENERATED:             'invoice.generated',
  INVOICE_OVERDUE:               'invoice.overdue',
  FEE_REMINDER:                  'fee.reminder',

  // ── Attendance ────────────────────────────────────────────────────────────
  ATTENDANCE_MARKED:             'attendance.marked',
  ATTENDANCE_ABSENT:             'attendance.absent',
  ATTENDANCE_LOW:                'attendance.low',         // < 75% threshold

  // ── Students ──────────────────────────────────────────────────────────────
  STUDENT_ENROLLED:              'student.enrolled',
  STUDENT_PROMOTED:              'student.promoted',
  STUDENT_REPORT_CARD_GENERATED: 'student.report_card_generated',

  // ── Staff / HR ────────────────────────────────────────────────────────────
  LEAVE_APPLIED:                 'leave.applied',
  LEAVE_APPROVED:                'leave.approved',
  LEAVE_REJECTED:                'leave.rejected',
  JOINING_APPROVED:              'joining.approved',

  // ── Tenant ────────────────────────────────────────────────────────────────
  TENANT_TRIAL_EXPIRING:         'tenant.trial.expiring',
  TENANT_INACTIVE:               'tenant.inactive',

  // ── Alerts ────────────────────────────────────────────────────────────────
  ALERT_FEE_DROP:                'alert.fee.drop',
  ALERT_ATTENDANCE_DROP:         'alert.attendance.drop',
} as const;

export type SchoolOSEvent = typeof EVENTS[keyof typeof EVENTS];
