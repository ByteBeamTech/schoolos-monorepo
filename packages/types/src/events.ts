export type SchoolOSEvent =
  | { type: 'StudentEnrolled';      tenantId: string; studentId: string; enrolledAt: Date; academicYear: string }
  | { type: 'StudentDeactivated';   tenantId: string; studentId: string; deactivatedAt: Date }
  | { type: 'TenantBillPaid';       tenantId: string; invoiceId: string; amount: number; paidAt: Date }
  | { type: 'TenantBillFailed';     tenantId: string; invoiceId: string; reason: string; gatewayError: string }
  | { type: 'TenantSuspended';      tenantId: string; reason: 'DUNNING' | 'LICENSE_EXPIRED' | 'MANUAL' }
  | { type: 'TenantReactivated';    tenantId: string; reactivatedAt: Date }
  | { type: 'LicenseExpiryWarning'; tenantId: string; licenseId: string; daysRemaining: number }
  | { type: 'FraudAlertRaised';     tenantId: string; alertId: string; severity: 'LOW'|'MEDIUM'|'HIGH'|'CRITICAL' }
  | { type: 'PaymentRefunded';      tenantId: string; paymentId: string; refundId: string; amount: number }
  | { type: 'ReminderOutcome';      tenantId: string; reminderId: string; paidWithinHours: number | null }
