// core/auth/guards/jwt-superadmin.guard.ts
// Use this guard on ALL superadmin routes instead of JwtGuard.
// It validates aud === 'schoolos-superadmin' and role === 'SUPER_ADMIN'.

import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtSuperadminGuard extends AuthGuard('jwt-superadmin') {
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      const message =
        info?.message === 'No auth token'    ? 'Superadmin authorization header missing.'     :
        info?.message === 'jwt expired'       ? 'Superadmin token expired.'                    :
        info?.message === 'invalid audience'  ? 'Token audience invalid for superadmin access.' :
        'Superadmin authentication failed.';
      throw err || new UnauthorizedException(message);
    }
    return user;
  }
}
