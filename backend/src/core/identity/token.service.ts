// core/identity/token.service.ts — updated for superadmin audience separation
// Phase 1: issueTokens() now accepts an optional `isSuperadmin` flag.
// Superadmin tokens get aud: SUPERADMIN_JWT_AUDIENCE and are signed with
// SUPERADMIN_JWT_SECRET (falls back to JWT_SECRET if not set separately).

import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../infra/cache/redis.service';
import { randomUUID } from 'crypto';

export interface JwtPayload {
  sub:      string;
  tenantId: string;
  role:     string;
  email:    string;
  jti:      string;
  aud:      string;
}

export interface TokenPair {
  accessToken:           string;
  refreshToken:          string;
  accessTokenExpiresIn:  number;
  refreshTokenExpiresIn: number;
}

const ACCESS_TOKEN_TTL  = 15 * 60;
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60;

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwt:    JwtService,
    private readonly redis:  RedisService,
    private readonly config: ConfigService,
  ) {}

  async issueTokens(params: {
    userId:       string;
    tenantId:     string;
    role:         string;
    email:        string;
    isSuperadmin?: boolean;  // NEW: separate audience for superadmin tokens
  }): Promise<TokenPair> {
    const { userId, tenantId, role, email, isSuperadmin = false } = params;

    // Audience separation — superadmin tokens are rejected by tenant JwtStrategy
    // and tenant tokens are rejected by JwtSuperadminStrategy
    const audience = isSuperadmin
      ? this.config.get<string>('SUPERADMIN_JWT_AUDIENCE', 'schoolos-superadmin')
      : this.config.get<string>('TENANT_JWT_AUDIENCE',     'schoolos-tenant');

    const secret = isSuperadmin
      ? this.config.get<string>('SUPERADMIN_JWT_SECRET', this.config.get<string>('JWT_SECRET')!)
      : this.config.get<string>('JWT_SECRET')!;

    const jti = randomUUID();
    this.logger.warn(
  `[JWT SIGN] isSuperadmin=${isSuperadmin} audience=${audience}`,
);

this.logger.warn(
  `[JWT SIGN] secret=${secret}`,
);
    const accessToken = this.jwt.sign(
      { sub: userId, tenantId, role, email, jti, aud: audience },
      {
        secret,
        expiresIn: this.config.get<string>('JWT_EXPIRY', '15m'),
      },
    );

    const refreshJti   = randomUUID();
    const refreshToken = this.jwt.sign(
      { sub: userId, tenantId, email, jti: refreshJti, type: 'refresh', aud: audience },
      {
        secret:    this.config.get<string>('REFRESH_TOKEN_SECRET'),
        expiresIn: this.config.get<string>('REFRESH_TOKEN_EXPIRY', '7d'),
      },
    );

    // Store refresh token in Redis with TTL
    await this.redis.set(
      `refresh:${refreshJti}`,
      JSON.stringify({ userId, tenantId, role, email }),
      REFRESH_TOKEN_TTL,
    );

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn:  ACCESS_TOKEN_TTL,
      refreshTokenExpiresIn: REFRESH_TOKEN_TTL,
    };
  }

  async rotateRefreshToken(refreshToken: string): Promise<Omit<TokenPair, never>> {
    let payload: any;
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.config.get<string>('REFRESH_TOKEN_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalid or expired.');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Token is not a refresh token.');
    }

    const stored = await this.redis.get(`refresh:${payload.jti}`);
    if (!stored) {
      throw new UnauthorizedException('Refresh token revoked or expired.');
    }

    // Revoke old refresh token (rotation)
    await this.redis.del(`refresh:${payload.jti}`);

    const data = JSON.parse(stored);
    return this.issueTokens({
      userId:       data.userId,
      tenantId:     data.tenantId,
      role:         data.role,
      email:        data.email,
      isSuperadmin: data.role === 'SUPER_ADMIN',
    });
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: this.config.get<string>('REFRESH_TOKEN_SECRET'),
      }) as any;
      await this.redis.del(`refresh:${payload.jti}`);
    } catch {
      // Already expired or invalid — safe to ignore
    }
  }
}
