import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';

/**
 * Branch-visibility rules for the CRM MVP.
 *
 * Per business spec (Phase 1):
 *   - RECEPTIONIST  -> own branch only
 *   - PRINCIPAL     -> own branch only
 *   - SCHOOL_ADMIN  -> all branches in their tenant
 *   - SUPER_ADMIN   -> all branches in their tenant (platform support only)
 *
 * Returns a Prisma `where` fragment to merge into a query, plus the effective
 * branchId (if any) for write paths.
 */
export const TENANT_WIDE_ROLES = new Set(['SCHOOL_ADMIN', 'SCHOOL_OWNER', 'SUPER_ADMIN']);

export interface BranchScope {
  /** Prisma `where` filter — always at least { tenantId } */
  where: { tenantId: string; branchId?: string };
  /** Resolved branchId for the write path (creates, updates). Undefined for tenant-wide reads. */
  branchId?: string;
  /** True if the caller can see every branch in the tenant. */
  tenantWide: boolean;
}

/**
 * Build the scope object for READ queries.
 * `requestedBranchId` is an optional filter (e.g. ?branchId=xxx) — only honoured
 * if the caller is tenant-wide; for branch-bound roles it is ignored.
 */
export function buildReadScope(
  user: AuthenticatedUser,
  requestedBranchId?: string,
): BranchScope {
  const tenantWide = TENANT_WIDE_ROLES.has(user.role);
  if (!tenantWide) {
    if (!user.branchId) {
      throw new ForbiddenException(
        'Branch context is required for this role but none is set.',
      );
    }
    return {
      where: { tenantId: user.tenantId, branchId: user.branchId },
      branchId: user.branchId,
      tenantWide: false,
    };
  }

  // Tenant-wide: optionally narrow to a specific branch.
  const branchId = requestedBranchId?.trim() || undefined;
  return {
    where: branchId
      ? { tenantId: user.tenantId, branchId }
      : { tenantId: user.tenantId },
    branchId,
    tenantWide: true,
  };
}

/**
 * Build the scope object for WRITE paths (create / update / delete).
 * Writes ALWAYS require a concrete branchId. Tenant-wide roles must either
 * have set `x-branch-id` (resolved by BranchContextMiddleware) or provide the
 * branchId explicitly via the DTO.
 */
export function requireWriteBranch(
  user: AuthenticatedUser,
  fallbackBranchId?: string,
): { tenantId: string; branchId: string } {
  const tenantWide = TENANT_WIDE_ROLES.has(user.role);
  const branchId = tenantWide
    ? user.branchId ?? fallbackBranchId
    : user.branchId;
  if (!branchId) {
    throw new ForbiddenException(
      'Branch context is required to write this resource. ' +
        'Set `x-branch-id` header or include branchId in the request body.',
    );
  }
  return { tenantId: user.tenantId, branchId };
}
