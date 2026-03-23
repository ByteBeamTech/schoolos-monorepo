import type { UserRole } from '@schoolos/types'

export interface AuthUser {
  id: string
  userId: string
  tenantId: string
  email: string
  role: UserRole
  mfaVerified: boolean
  isSuperadmin: boolean
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
}
