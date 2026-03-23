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
    userId:   string;
    tenantId: string;
    role:     string;
    email:    string;
  }): Promise<TokenPair> {
    const { userId, tenantId, role, email } = params;
    const audience = this.config.get<string>('TENANT_JWT_AUDIENCE', 'schoolos-tenant');

    const jti = randomUUID();
    const accessToken = this.jwt.sign(
      { sub: userId, tenantId, role, email, jti, aud: audience },
      {
        secret:    this.config.get<string>('JWT_SECRET'),
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

    await this.redis.set(
      this.redis.refreshTokenKey(refreshJti),
      JSON.stringify({ userId, tenantId, role, email }),
      REFRESH_TOKEN_TTL,
    );

    this.logger.debug(`Tokens issued for user ${userId} in tenant ${tenantId}`);

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn:  ACCESS_TOKEN_TTL,
      refreshTokenExpiresIn: REFRESH_TOKEN_TTL,
    };
  }

  verifyAccessToken(token: string): JwtPayload {
    try {
      return this.jwt.verify<JwtPayload>(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token.');
    }
  }

  async rotateRefreshToken(refreshToken: string): Promise<TokenPair> {
    let payload: any;
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.config.get<string>('REFRESH_TOKEN_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Not a refresh token.');
    }

    const stored = await this.redis.get(
      this.redis.refreshTokenKey(payload.jti),
    );
    if (!stored) {
      throw new UnauthorizedException(
        'Refresh token has been revoked. Please log in again.',
      );
    }

    const { userId, tenantId, role, email } = JSON.parse(stored);
    await this.redis.del(this.redis.refreshTokenKey(payload.jti));

    this.logger.debug(`Refresh token rotated for user ${userId}`);

    return this.issueTokens({ userId, tenantId, role, email });
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    try {
      const payload: any = this.jwt.verify(refreshToken, {
        secret: this.config.get<string>('REFRESH_TOKEN_SECRET'),
      });
      await this.redis.del(this.redis.refreshTokenKey(payload.jti));
      this.logger.debug(`Refresh token revoked: ${payload.jti}`);
    } catch {
      // Already invalid — nothing to do
    }
  }
}
