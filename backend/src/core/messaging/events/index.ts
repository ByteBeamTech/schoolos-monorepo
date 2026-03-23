import { z } from 'zod'

export const StudentEnrolledSchema = z.object({
  type: z.literal('StudentEnrolled'),
  tenantId: z.string().uuid(),
  studentId: z.string().uuid(),
  enrolledAt: z.coerce.date(),
  academicYear: z.string(),
})

export const StudentDeactivatedSchema = z.object({
  type: z.literal('StudentDeactivated'),
  tenantId: z.string().uuid(),
  studentId: z.string().uuid(),
  deactivatedAt: z.coerce.date(),
})

export const TenantBillPaidSchema = z.object({
  type: z.literal('TenantBillPaid'),
  tenantId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  amount: z.number().positive(),
  paidAt: z.coerce.date(),
})

export const TenantBillFailedSchema = z.object({
  type: z.literal('TenantBillFailed'),
  tenantId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  reason: z.string(),
  gatewayError: z.string(),
})

export const TenantSuspendedSchema = z.object({
  type: z.literal('TenantSuspended'),
  tenantId: z.string().uuid(),
  reason: z.enum(['DUNNING', 'LICENSE_EXPIRED', 'MANUAL']),
})

export const TenantReactivatedSchema = z.object({
  type: z.literal('TenantReactivated'),
  tenantId: z.string().uuid(),
  reactivatedAt: z.coerce.date(),
})

export const LicenseExpiryWarningSchema = z.object({
  type: z.literal('LicenseExpiryWarning'),
  tenantId: z.string().uuid(),
  licenseId: z.string().uuid(),
  daysRemaining: z.number().int(),
})

export const FraudAlertRaisedSchema = z.object({
  type: z.literal('FraudAlertRaised'),
  tenantId: z.string().uuid(),
  alertId: z.string().uuid(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
})

export const PaymentRefundedSchema = z.object({
  type: z.literal('PaymentRefunded'),
  tenantId: z.string().uuid(),
  paymentId: z.string().uuid(),
  refundId: z.string().uuid(),
  amount: z.number().positive(),
})

const EVENT_SCHEMAS = {
  StudentEnrolled:      StudentEnrolledSchema,
  StudentDeactivated:   StudentDeactivatedSchema,
  TenantBillPaid:       TenantBillPaidSchema,
  TenantBillFailed:     TenantBillFailedSchema,
  TenantSuspended:      TenantSuspendedSchema,
  TenantReactivated:    TenantReactivatedSchema,
  LicenseExpiryWarning: LicenseExpiryWarningSchema,
  FraudAlertRaised:     FraudAlertRaisedSchema,
  PaymentRefunded:      PaymentRefundedSchema,
} as const

export type EventType = keyof typeof EVENT_SCHEMAS

export function validateEvent<T extends EventType>(
  type: T,
  payload: unknown,
): z.infer<(typeof EVENT_SCHEMAS)[T]> {
  return EVENT_SCHEMAS[type].parse(payload) as z.infer<(typeof EVENT_SCHEMAS)[T]>
}
