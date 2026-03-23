export type PaymentGateway = 'RAZORPAY' | 'STRIPE' | 'PAYPAL'
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED'
export type DunningStage = 'ACTIVE' | 'OVERDUE' | 'WARNED' | 'SUSPENDED' | 'CANCELLED'

export interface DunningAttempt {
  id: string
  tenantId: string
  invoiceId: string
  stage: DunningStage
  attemptNumber: number
  gatewayError: string | null
  scheduledAt: Date
  executedAt: Date | null
  resolvedAt: Date | null
}

export type MrrMovementType =
  | 'NEW'
  | 'EXPANSION'
  | 'CONTRACTION'
  | 'CHURN'
  | 'REACTIVATION'

export interface MrrMovement {
  id: string
  tenantId: string
  type: MrrMovementType
  previousMrr: number
  newMrr: number
  delta: number
  reason: string
  recordedAt: Date
}

export type DiscountType = 'PERCENTAGE' | 'FLAT'
export type DiscountReason =
  | 'FINANCIAL_HARDSHIP'
  | 'PRINCIPAL_OVERRIDE'
  | 'ONE_TIME_ADJUSTMENT'
  | 'SCHOLARSHIP'
  | 'OTHER'
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED'

export interface CustomDiscount {
  id: string
  tenantId: string
  studentId: string
  invoiceId: string | null
  type: DiscountType
  value: number
  reason: DiscountReason
  note: string
  validFrom: Date
  validUntil: Date | null
  approvalStatus: ApprovalStatus
  requestedBy: string
  approvedBy: string | null
  approvedAt: Date | null
}
