import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import type { AuthenticatedUser } from '@core/auth/guards/jwt.strategy';

/**
 * BranchContextMiddleware
 *
 * Resolves the effective `branchId` for the current request:
 *   1. If the caller sends an `x-branch-id` header, it must point to a branch
 *      the user has an active mapping for (otherwise 403).
 *   2. Otherwise we fall back to the user's default branch (already populated
 *      by JwtStrategy.validate).
 *
 * For SCHOOL_ADMIN / SUPER_ADMIN with no header and no default branch,
 * `req.user.branchId` is intentionally left `undefined` so services can perform
 * tenant-wide queries.
 *
 * This middleware must run AFTER JwtAuthGuard has populated `req.user`.
 */
@Injectable()
export class BranchContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const user = req.user as AuthenticatedUser | undefined;
    if (!user) return next(); // public route, JWT guard will reject later if needed

    const headerBranch = (req.headers['x-branch-id'] as string | undefined)?.trim();
    if (headerBranch) {
      const allowed = user.branchIds?.includes(headerBranch);
      if (!allowed) {
        throw new ForbiddenException(
          'User does not have access to the requested branch.',
        );
      }
      user.branchId = headerBranch;
    }

    next();
  }
}
