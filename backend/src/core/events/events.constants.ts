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
  INVOICE_SENT: 'invoice.sent',
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
 // ── Feature Flags ─────────────────────────────────────────────────────────
  FLAG_OVERRIDE_REQUESTED:       'flag.override.requested',
  FLAG_OVERRIDE_APPROVED:        'flag.override.approved',
  FLAG_OVERRIDE_REJECTED:        'flag.override.rejected',
  FLAG_OVERRIDE_REVOKED:         'flag.override.revoked',
  FLAG_OVERRIDE_EXPIRED:         'flag.override.expired',
  FLAG_UPGRADE_NUDGE:            'flag.upgrade.nudge',
  FLAG_GRACE_PERIOD_STARTED:     'flag.grace.started',
  FLAG_GRACE_PERIOD_ENDED:       'flag.grace.ended',
  FLAG_SLA_BREACH:               'flag.sla.breach',

} as const;

export interface FlagOverrideRequestedEvent {
  requestId:     string;
  flagName:      string;
  flagLabel:     string;
  targetType:    string;
  targetId:      string;
  targetName:    string;
  requestedBy:   string;
  requestReason: string;
  activationMode: string;
}

export interface FlagOverrideApprovedEvent {
  requestId:   string;
  flagName:    string;
  flagLabel:   string;
  targetId:    string;
  targetName:  string;
  approvedBy:  string;
  approverNote?: string;
  expiresAt?:  Date;
}

export interface FlagOverrideRevokedEvent {
  requestId:    string;
  flagName:     string;
  targetId:     string;
  targetName:   string;
  revokedBy:    string;
  revokeReason: string;
}

export interface FlagUpgradeNudgeEvent {
  tenantId:   string;
  flagName:   string;
  flagLabel:  string;
  currentTier: string;
  requiredTier: string;
  callCount:  number;
}

export interface FlagSlaBreachEvent {
  requestId:   string;
  flagName:    string;
  requestedBy: string;
  hoursElapsed: number;
}

export type SchoolOSEvent = typeof EVENTS[keyof typeof EVENTS];
