import type { UserRole } from '@schoolos/types'

export interface AccessTokenPayload {
  sub: string
  tenantId: string
  role: UserRole
  mfaVerified: boolean
  isSuperadmin: boolean
  aud: 'school' | 'superadmin'
  iat: number
  exp: number
}

export interface RefreshTokenPayload {
  sub: string
  tenantId: string
  jti: string
  iat: number
  exp: number
}
