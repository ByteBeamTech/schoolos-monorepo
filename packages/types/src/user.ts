export type UserRole =
  | 'superadmin'
  | 'school-admin'
  | 'principal'
  | 'finance-officer'
  | 'accountant'
  | 'class-teacher'
  | 'parent'

export interface User {
  id: string
  tenantId: string
  email: string
  role: UserRole
  mfaEnabled: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Session {
  userId: string
  tenantId: string
  role: UserRole
  issuedAt: number
  expiresAt: number
  mfaVerified: boolean
}
