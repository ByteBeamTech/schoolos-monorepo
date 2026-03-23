import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      const message =
        info?.message === 'No auth token'     ? 'Authorization header missing. Include Bearer token.'     :
        info?.message === 'jwt expired'        ? 'Access token expired. Use /auth/refresh to get a new one.' :
        info?.message === 'invalid signature'  ? 'Invalid token signature.'                                :
        'Authentication failed. Please log in again.';
      throw err || new UnauthorizedException(message);
    }
    return user;
  }
}
