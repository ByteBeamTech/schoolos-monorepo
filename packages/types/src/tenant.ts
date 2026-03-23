export type TenantStatus = 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'CANCELLED' | 'GRACE_PERIOD'
export type TenantRegion = 'IN' | 'US' | 'EU' | 'GLOBAL'
export type PricingModel = 'PER_STUDENT' | 'SUBSCRIPTION' | 'HYBRID'
export type SubscriptionTier = 'STARTER' | 'GROWTH' | 'PRO' | 'ENTERPRISE'

export interface Tenant {
  id: string
  name: string
  region: TenantRegion
  status: TenantStatus
  pricingModel: PricingModel
  tier: SubscriptionTier
  createdAt: Date
}

export type LicenseStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'EXPIRY_WARNING'
  | 'GRACE_PERIOD'
  | 'EXPIRED'
  | 'LOCKED'

export interface License {
  id: string
  tenantId: string
  key: string
  status: LicenseStatus
  maxStudents: number
  currentStudents: number
  expiresAt: Date
  features: string[]
}
