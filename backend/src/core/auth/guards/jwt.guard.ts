import { Injectable, ExecutionContext, UnauthorizedException, ForbiddenException, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '@infra/database/prisma.service';
import { isObservable, lastValueFrom } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { IS_SUPERADMIN_ROUTE } from '../decorators/superadmin-route.decorator';

@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  private readonly reflector: Reflector;

  constructor(
    reflector: Reflector,
    @Optional() private readonly prisma?: PrismaService,
  ) {
    super();
    this.reflector = reflector;
  }

 async canActivate(context: ExecutionContext) {
  const isPublic =
    this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [
        context.getHandler(),
        context.getClass(),
      ],
    );

  const isSuperadminRoute =
    this.reflector.getAllAndOverride<boolean>(
      IS_SUPERADMIN_ROUTE,
      [
        context.getHandler(),
        context.getClass(),
      ],
    );

  if (isPublic || isSuperadminRoute) {
    return true;
  }

  const result = super.canActivate(context);
  const authenticated = isObservable(result) ? await lastValueFrom(result) : await result;
  if (!authenticated) return authenticated;

  const req = context.switchToHttp().getRequest();
  const user = req.user;
  const requestedBranch = (req.headers['x-branch-id'] as string | undefined)?.trim();
  if (!requestedBranch || !user) return authenticated;

  const tenantWide =
    user.role === 'SUPER_ADMIN' ||
    user.role === 'SCHOOL_OWNER' ||
    (user.role === 'SCHOOL_ADMIN' && (!user.branchIds || user.branchIds.length === 0));

  if (tenantWide && this.prisma) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: requestedBranch, tenantId: user.tenantId, isActive: true },
      select: { id: true },
    });
    if (!branch) {
      throw new ForbiddenException('User does not have access to the requested branch.');
    }
  } else if (!user.branchIds?.includes(requestedBranch)) {
    throw new ForbiddenException('User does not have access to the requested branch.');
  }

  user.branchId = requestedBranch;
  return authenticated;
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
