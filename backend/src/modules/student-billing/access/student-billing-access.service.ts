// FEE-0 (Security Hardening): single home for the "may this user access this
// student's financial data?" decision, per ADR-FEE-001.
//
// Reuse check performed before creating this (per implementation decision):
//  - AccessControlService (src/modules/access-control): a role/permission
//    string matrix. No concept of guardian-student ownership. Not suitable.
//  - No other guardian-link access check exists anywhere in the repo — even
//    the students module's PARENT-role endpoints do tenant+branch filtering
//    only, with no ownership check (pre-existing gap, outside FEE-0 scope,
//    flagged in the FEE-0 handoff notes).
// Persistent state used (per AUTH-003: resolved from the DB on every request,
// never trusted from a JWT claim): Guardian (tenantId, userId, isActive) and
// GuardianStudent (guardianId, studentId) in prisma/schema/students/relations.prisma.
// "Active (non-revoked)" maps to Guardian.isActive=true plus link-row
// existence — GuardianStudent has no revocation flag of its own; revocation is
// modeled today as link removal or guardian deactivation.
//
// Deliberately NOT here (scope): field-level classification (ADR-FEE-001 §7)
// and the Student Financial Account projection (AUTH-021 / FEE-4). Parent
// access to invoice/payment HISTORY endpoints is deferred to FEE-4 by
// explicit decision; this service exists for the ownership dimension of the
// endpoints FEE-0 hardens (e.g. student fee summary) and for reuse by FEE-4.

import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { AuthenticatedUser } from '../../../core/auth/guards/jwt.strategy';

/**
 * Roles treated as finance staff for read access, matching the role sets the
 * existing student-billing controllers already grant on their guarded
 * endpoints (SUPER_ADMIN/SCHOOL_OWNER/SCHOOL_ADMIN/PRINCIPAL/ACCOUNTANT).
 * TEACHER is deliberately absent — no billing endpoint grants it today, and
 * ADR-FEE-001's default-deny (AUTH-041) means absence of a grant is a denial.
 */
const FINANCE_STAFF_ROLES = new Set([
  'SUPER_ADMIN',
  'SCHOOL_OWNER',
  'SCHOOL_ADMIN',
  'PRINCIPAL',
  'ACCOUNTANT',
]);

@Injectable()
export class StudentBillingAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The branch set this user's financial reads must be constrained to.
   *
   *  - `null`  → tenant-wide, no branch restriction:
   *      SCHOOL_OWNER / SUPER_ADMIN unconditionally (AUTH-052);
   *      SCHOOL_ADMIN with zero UserBranch restrictions (AUTH-058 default).
   *  - `string[]` → restricted to exactly these branch ids:
   *      SCHOOL_ADMIN that has been administratively restricted (AUTH-058);
   *      all other staff (PRINCIPAL, ACCOUNTANT, …) via their mappings.
   *  - `[]` (empty) → access to no branch at all. Fail closed (AUTH-047):
   *      a branch-scoped role with no active mapping sees nothing. (JwtStrategy
   *      already rejects such users at login today; this guards the invariant
   *      here too rather than assuming it.)
   */
  resolveAuthorizedBranchIds(user: AuthenticatedUser): string[] | null {
    if (user.role === 'SCHOOL_OWNER' || user.role === 'SUPER_ADMIN') {
      return null;
    }
    if (user.role === 'SCHOOL_ADMIN') {
      return user.branchIds && user.branchIds.length > 0
        ? user.branchIds
        : null;
    }
    return user.branchIds ?? [];
  }

  /**
   * Assert this user may access the given student's financial data.
   *
   *  - Finance staff: student must exist in the user's tenant AND fall inside
   *    the user's authorized branch set (tenant → branch, ADR-FEE-001 §4 order).
   *  - PARENT: an active guardian link must exist, resolved from persistent
   *    state on this request (AUTH-003). isPrimary is notification routing
   *    only and plays no part here — all active guardians get equal access.
   *  - STUDENT: denied (AUTH-004 — school-configurable policy, defaults to
   *    disabled; the configurable enablement is not built yet, so deny).
   *  - Any other role: default-deny (AUTH-041).
   *
   * Out-of-scope / nonexistent students throw NotFound rather than Forbidden
   * so an ID-guessing caller cannot distinguish "exists but not yours" from
   * "does not exist" (same anti-probing choice as saas-payment.service.ts's
   * tenant-ownership check).
   */
  async assertCanAccessStudent(
    user: AuthenticatedUser,
    studentId: string,
  ): Promise<void> {
    if (FINANCE_STAFF_ROLES.has(user.role)) {
      const student = await this.prisma.student.findFirst({
        where: { id: studentId, tenantId: user.tenantId },
        select: { id: true, branchId: true },
      });
      if (!student) {
        throw new NotFoundException(`Student not found: ${studentId}`);
      }
      const branches = this.resolveAuthorizedBranchIds(user);
      if (branches !== null && !branches.includes(student.branchId)) {
        throw new NotFoundException(`Student not found: ${studentId}`);
      }
      return;
    }

    if (user.role === 'PARENT') {
      const link = await this.prisma.guardianStudent.findFirst({
        where: {
          studentId,
          guardian: {
            tenantId: user.tenantId,
            userId: user.id,
            isActive: true,
          },
          student: { tenantId: user.tenantId }, // defense in depth
        },
        select: { id: true },
      });
      if (!link) {
        throw new NotFoundException(`Student not found: ${studentId}`);
      }
      return;
    }

    // STUDENT and every unlisted role: absence of an explicit grant is a
    // denial (AUTH-041). Forbidden (not NotFound) — the caller's own role is
    // not a secret to them.
    throw new ForbiddenException(
      'You do not have access to student financial data.',
    );
  }

  /**
   * All student ids the PARENT user has an active guardian link to — used to
   * auto-scope list endpoints server-side instead of trusting a client
   * studentId filter. Non-PARENT callers get [] (this method is not a grant;
   * staff scoping goes through resolveAuthorizedBranchIds instead).
   */
  async getParentStudentIds(user: AuthenticatedUser): Promise<string[]> {
    if (user.role !== 'PARENT') return [];
    const links = await this.prisma.guardianStudent.findMany({
      where: {
        guardian: {
          tenantId: user.tenantId,
          userId: user.id,
          isActive: true,
        },
        student: { tenantId: user.tenantId },
      },
      select: { studentId: true },
    });
    const ids = links.map((l: { studentId: string }): string => l.studentId);
    return Array.from(new Set<string>(ids));
  }
}
