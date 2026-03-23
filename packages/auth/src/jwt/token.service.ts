import * as jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'
import type { AccessTokenPayload, RefreshTokenPayload } from './token.types'
import type { AuthUser, TokenPair } from '../types/auth.types'

export interface TokenConfig {
  accessSecret: string
  refreshSecret: string
  superadminSecret: string
  accessExpiresIn: number
  refreshExpiresIn: number
}

export class TokenService {
  constructor(private readonly config: TokenConfig) {}

  issue(user: AuthUser): TokenPair {
    const secret = user.isSuperadmin
      ? this.config.superadminSecret
      : this.config.accessSecret

    const accessPayload: Omit<AccessTokenPayload, 'iat' | 'exp'> = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      mfaVerified: user.mfaVerified,
      isSuperadmin: user.isSuperadmin,
      aud: user.isSuperadmin ? 'superadmin' : 'school',
    }

    const jti = randomUUID()
    const accessToken = jwt.sign(accessPayload, secret, {
      expiresIn: this.config.accessExpiresIn,
    })
    const refreshToken = jwt.sign(
      { sub: user.id, tenantId: user.tenantId, jti },
      this.config.refreshSecret,
      { expiresIn: this.config.refreshExpiresIn },
    )

    const decoded = jwt.decode(accessToken) as AccessTokenPayload
    return { accessToken, refreshToken, expiresIn: decoded.exp - decoded.iat }
  }

  verifyAccess(token: string, aud: 'school' | 'superadmin'): AccessTokenPayload {
    const secret = aud === 'superadmin'
      ? this.config.superadminSecret
      : this.config.accessSecret
    const payload = jwt.verify(token, secret) as AccessTokenPayload
    if (payload.aud !== aud) throw new Error(`Token audience mismatch: expected ${aud}`)
    return payload
  }

  verifyRefresh(token: string): RefreshTokenPayload {
    return jwt.verify(token, this.config.refreshSecret) as RefreshTokenPayload
  }
}
