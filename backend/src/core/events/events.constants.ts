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

  // ── SaaS Billing (ByteBeam <- Tenant, distinct from student-billing above
  //    which is Parent -> Tenant/School — different money flow, different
  //    consumers, kept as separate event names deliberately) ─────────────────
  SAAS_INVOICE_PAID:             'saas.invoice.paid',
  SAAS_PAYMENT_FAILED:           'saas.payment.failed',
  // PR-4: fired only on a real subscription-status transition INTO active
  // (TRIAL/PAST_DUE/SUSPENDED -> ACTIVE), never on a routine renewal
  // payment of an already-active subscription. LicenseBuilder listens to
  // this, never to SAAS_INVOICE_PAID directly -- payment domain knowledge
  // shouldn't leak into the license domain. See PR-4 scoping discussion.
  SUBSCRIPTION_ACTIVATED:        'saas.subscription.activated',

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

  // ── Transport (SAD Ch.3 Domain Events; only the ones with a producer so ──
  //    far — Phase 3/4 Route lifecycle. Others in the frozen Ch.3 list
  //    (StudentAssigned, TripScheduled, VehicleAssigned, etc.) get added as
  //    each later phase actually starts firing them, same convention as
  //    LIBRARY_RESERVATION_READY below.) ──────────────────────────────────
  ROUTE_ACTIVATED:               'transport.route.activated',
  ROUTE_SUSPENDED:               'transport.route.suspended',
  STUDENT_ASSIGNED:              'transport.student.assigned',
  STUDENT_TRANSFERRED:           'transport.student.transferred',

  // ── Library (ADR-LIB-001 §8 -- Reservation auto-allocation) ────────────────
  // Fired by BookCopyService.transitionCopyStatus()/createCopy() any time a
  // copy becomes AVAILABLE (return, cancelled hold, new copy added).
  // ReservationService listens for this to attempt allocation to the oldest
  // QUEUED reservation for that book+branch -- kept event-driven rather than
  // an inline call inside returnBook() specifically so returnBook's own
  // transaction stays small, per the ADR.
  LIBRARY_COPY_AVAILABLE:        'library.copy.available',
  // Fired once a reservation is promoted to READY_FOR_PICKUP. No consumer
  // yet -- notification wiring is explicit Phase 6 scope (ADR §15/§19 item
  // 14, "added incrementally per event as each phase's events start
  // firing"). Emitting it now costs nothing and means Phase 6 has nothing
  // to add on the producer side.
  LIBRARY_RESERVATION_READY:     'library.reservation.ready',
  // ADR-LIB-001 §9 -- the ENTIRE Library -> Student Billing contract, one-
  // directional. Library publishes this and is done; it does not call
  // Billing, does not know Billing's internal models, and does not block
  // if Billing is slow/down (outbox retry/backoff already handles that).
  // Payload shape: { core: { tenantId }, chargeRequestId, branchId,
  // issueId, borrowerType, borrowerId, reason, amount, currency }.
  // No consumer exists in this codebase yet -- Student Billing owns
  // building it, on its own schedule (see IMPLEMENTATION_STATE.md).
  LIBRARY_CHARGE_REQUESTED:      'library.charge.requested',
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
