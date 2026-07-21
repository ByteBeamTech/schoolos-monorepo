import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { PrismaService } from '@infra/database/prisma.service';
import type { AuthenticatedUser } from '@core/auth/guards/jwt.strategy';

/**
 * BranchContextMiddleware
 *
 * Resolves the effective `branchId` for the current request from an optional
 * `x-branch-id` header, else the user's default branch (populated by
 * JwtStrategy.validate).
 *
 * Header validation — AUTH-051: the header SELECTS among branches the
 * principal is already authorized for; it NEVER widens access.
 *
 *   - Branch-restricted principals (any role that has active UserBranch
 *     mappings, including a restricted SCHOOL_ADMIN per AUTH-058): the header
 *     must be one of their resolved `branchIds`, else 403. Unchanged behavior.
 *
 *   - Tenant-wide principals — SCHOOL_OWNER / SUPER_ADMIN unconditionally
 *     (AUTH-052), and SCHOOL_ADMIN with ZERO UserBranch restrictions
 *     (AUTH-058 default): their authorized scope already IS the whole tenant,
 *     so selecting any ACTIVE branch OF THEIR OWN TENANT is a narrowing, not a
 *     widening. The header is validated against the Branch table
 *     (id + tenantId + isActive) rather than against `branchIds` (which is
 *     empty or partial for these principals). A cross-tenant or inactive
 *     branch id still 403s.
 *
 * [FEE-0 item 5] Before this, the header was checked ONLY against `branchIds`.
 * That 403'd an unrestricted SCHOOL_ADMIN (empty mappings) on every branch
 * selection and capped a SCHOOL_OWNER at whatever mappings happened to exist —
 * violating AUTH-052/AUTH-058's MUSTs that these principals be able to use the
 * branch selector across all branches. Tenant scoping is enforced inside the
 * lookup predicate (INV-9 shape), not by post-filtering.
 *
 * For tenant-wide principals with no header and no default branch,
 * `req.user.branchId` is intentionally left `undefined` so services perform
 * tenant-wide queries.
 *
 * This middleware must run AFTER JwtAuthGuard has populated `req.user`.
 */

// Roles that are tenant-wide regardless of UserBranch mappings (AUTH-052).
const UNCONDITIONALLY_TENANT_WIDE = new Set(['SCHOOL_OWNER', 'SUPER_ADMIN']);

@Injectable()
export class BranchContextMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Is this principal tenant-wide for the purpose of branch selection?
   * SCHOOL_OWNER/SUPER_ADMIN always; SCHOOL_ADMIN only when it has no active
   * UserBranch restrictions (AUTH-058). Everyone else is branch-restricted.
   */
  private isTenantWide(user: AuthenticatedUser): boolean {
    if (UNCONDITIONALLY_TENANT_WIDE.has(user.role)) return true;
    if (user.role === 'SCHOOL_ADMIN') {
      return !user.branchIds || user.branchIds.length === 0;
    }
    return false;
  }

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const user = req.user as AuthenticatedUser | undefined;
    if (!user) return next(); // public route, JWT guard will reject later if needed

    const headerBranch = (req.headers['x-branch-id'] as string | undefined)?.trim();
    if (headerBranch) {
      if (this.isTenantWide(user)) {
        // Selector for tenant-wide principals: any ACTIVE branch of THEIR OWN
        // tenant. Tenant + isActive constraints are in the query predicate.
        const branch = await this.prisma.branch.findFirst({
          where: { id: headerBranch, tenantId: user.tenantId, isActive: true },
          select: { id: true },
        });
        if (!branch) {
          throw new ForbiddenException(
            'User does not have access to the requested branch.',
          );
        }
      } else {
        // Branch-restricted principals: header must be within their set.
        const allowed = user.branchIds?.includes(headerBranch);
        if (!allowed) {
          throw new ForbiddenException(
            'User does not have access to the requested branch.',
          );
        }
      }
      user.branchId = headerBranch;
    }

    next();
  }
}
