export type LicenseState =
  | 'TRIAL'
  | 'ACTIVE'
  | 'EXPIRY_WARNING'
  | 'GRACE_PERIOD'
  | 'EXPIRED'
  | 'LOCKED'

export interface LicenseExpiryWarning {
  licenseId: string
  tenantId: string
  state: LicenseState
  daysRemaining: number
  maxStudents: number
  currentStudents: number
  expiresAt: Date
}
