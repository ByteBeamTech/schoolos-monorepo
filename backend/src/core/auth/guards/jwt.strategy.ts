import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@infra/database/prisma.service';

export interface AuthenticatedUser {
  id:       string;
  tenantId: string;
  role:     string;
  email:    string;
  jti:      string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config:                        ConfigService,
    private readonly prisma:       PrismaService,
  ) {
    super({
      jwtFromRequest:   ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:      config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findFirst({
      where:  { id: payload.sub, tenantId: payload.tenantId, isActive: true, deletedAt: null },
      select: { id: true, tenantId: true, role: true, email: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found or account deactivated.');
    }

    return { id: user.id, tenantId: user.tenantId, role: user.role, email: user.email, jti: payload.jti };
  }
}
