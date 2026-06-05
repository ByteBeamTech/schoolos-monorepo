// core/auth/guards/jwt-superadmin.strategy.ts
// Phase 1 — Superadmin JWT audience separation
//
// Problem: superadmin routes use the same JwtStrategy as tenant routes.
// A tenant SUPER_ADMIN JWT (aud: 'schoolos-tenant') could be used to
// call superadmin platform endpoints — wrong audience, wrong trust boundary.
//
// Fix: register a second Passport strategy 'jwt-superadmin' that validates
// aud === SUPERADMIN_JWT_AUDIENCE (env var). Superadmin routes use
// JwtSuperadminGuard instead of JwtGuard.

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@infra/database/prisma.service';

export interface SuperadminUser {
  id:          string;
  email:       string;
  role:        string;
  isSuperadmin: true;
  jti:         string;
}

@Injectable()
export class JwtSuperadminStrategy extends PassportStrategy(Strategy, 'jwt-superadmin') {
  constructor(
    config:                  ConfigService,
    private readonly prisma: PrismaService,
  ) {
	  console.log(
  'VERIFY_SECRET=',
  config.get('SUPERADMIN_JWT_SECRET'),
);

console.log(
  'VERIFY_AUDIENCE=',
  config.get('SUPERADMIN_JWT_AUDIENCE'),
);
    super({
      jwtFromRequest:   ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:      config.get<string>('SUPERADMIN_JWT_SECRET', config.get<string>('JWT_SECRET')!),
      // Enforce audience — rejects any tenant-issued token
      audience:         config.get<string>('SUPERADMIN_JWT_AUDIENCE', 'schoolos-superadmin'),
    });
  }

  async validate(payload: any): Promise<SuperadminUser> {
	   console.log('SUPERADMIN JWT VALIDATE');
  console.log('SUPERADMIN PAYLOAD=', payload);
    // Double-check audience in case passport-jwt audience option is misconfigured
    const expectedAud = 'schoolos-superadmin';
    if (payload.aud !== expectedAud) {
      throw new UnauthorizedException('Invalid token audience for superadmin access.');
    }

    if (payload.role !== 'SUPER_ADMIN') {
      throw new UnauthorizedException('SUPER_ADMIN role required.');
    }

    // Superadmin users are platform-level, not tenant-scoped
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, role: 'SUPER_ADMIN', isActive: true, deletedAt: null },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      throw new UnauthorizedException('Superadmin user not found or deactivated.');
    }

    return {
      id:           user.id,
      email:        user.email,
      role:         user.role,
      isSuperadmin: true,
      jti:          payload.jti,
    };
  }
}
