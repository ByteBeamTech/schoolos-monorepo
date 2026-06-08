import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { IS_SUPERADMIN_ROUTE } from '../auth/decorators/superadmin-route.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

canActivate(context: ExecutionContext): boolean {
  const requiredRoles = this.reflector.getAllAndOverride<string[]>(
    ROLES_KEY,
    [
      context.getHandler(),
      context.getClass(),
    ],
  );

  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }
const isSuperadminRoute =
  this.reflector.getAllAndOverride<boolean>(
    IS_SUPERADMIN_ROUTE,
    [
      context.getHandler(),
      context.getClass(),
    ],
  );

if (isSuperadminRoute) {
  return true;
}
  const req = context.switchToHttp().getRequest();

  console.log('ROLES GUARD URL=', req.originalUrl);
  console.log('ROLES GUARD USER=', req.user);

  const { user } = req;

  if (!user) {
    throw new ForbiddenException('Authentication required.');
  }

  if (!requiredRoles.includes(user.role)) {
    throw new ForbiddenException(
      `Access denied. Required: ${requiredRoles.join(' or ')}. Your role: ${user.role}`,
    );
  }

  return true;
}
}
