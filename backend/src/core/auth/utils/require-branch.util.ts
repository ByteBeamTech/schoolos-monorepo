// /apps/schoolos/backend/src/core/auth/utils/require-branch.util.ts

import { BadRequestException } from '@nestjs/common';
import { AuthenticatedUser }   from '../interfaces/authenticated-user.interface';

/**
 * Extracts `branchId` from the authenticated user context, throwing a
 * descriptive 400 if the token was not issued with a branch scope.
 *
 * Use this in any controller method that operates on branch-scoped resources
 * (classes, sections, timetables, attendance, etc.).
 *
 * WHY THIS EXISTS:
 *   `branchId` is optional on AuthenticatedUser because super-admins and
 *   system worker tokens are tenant-scoped but not branch-scoped.  Calling
 *   `u.branchId!` anywhere would silently pass `undefined` into Prisma queries
 *   on those token types, causing wrong-data bugs instead of a clear error.
 *
 * USAGE:
 *   import { requireBranch } from '@core/auth/utils/require-branch.util';
 *   const branchId = requireBranch(u);
 */
export function requireBranch(u: AuthenticatedUser): string {
  if (!u.branchId) {
    throw new BadRequestException(
      'Branch context is missing from your session token. ' +
      'This endpoint requires a branch-scoped login. ' +
      'If you are a school owner or super-admin, please select a branch first.',
    );
  }
  return u.branchId;
}
