// ⚠️ LEGACY — renamed as part of PR-1 (Commercial Cleanup), not deleted.
//
// This is currently the ONLY LicenseService with two behaviors the canonical
// core/license/license.service.ts does NOT have:
//   1. Branch-level license fallback (PER_BRANCH → PER_STUDENT hierarchy)
//   2. Fails LOUDLY (throws) on missing license, rather than the old fail-open
//      pattern that core/license/license.service.ts had before this PR.
//
// Its sole consumer, `requirePermission()` in middleware/permission.guard.ts,
// is itself NOT currently wired into any route (see PR-1 notes) — this whole
// path is dead code today, same as core/license's was before this PR.
//
// Do not delete in PR-1: deleting would either (a) silently drop the branch-
// fallback behavior if merged naively, or (b) require designing where branch-
// level license logic lives permanently — that decision belongs to PR-2
// (Commercial Gap Fill) / PR-4 (License Builder), not a pure cleanup PR.
//
// It also instantiates its own `PrismaClient()` (a second/third pool alongside
// PrismaService and permission.guard.ts's own instance) — flagged, not fixed
// here, since permission.guard.ts is plain Express middleware, not Nest DI, so
// swapping its Prisma access safely needs the same design decision above.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class LicenseService {
  /**
   * Hierarchical Fallback: Returns the active license (Branch overrides Tenant)
   */
  static async getActiveLicense(tenantId: string, branchId: string) {
    // 1. Try Branch-Specific License First
    let license = await prisma.license.findFirst({
      where: {
        tenantId,
        branchId,
        type:      'PER_BRANCH',
        status:    'ACTIVE',
        expiresAt: { gt: new Date() },
      },
    });

    // 2. Fallback to Global Tenant License
    if (!license) {
      license = await prisma.license.findFirst({
        where: {
          tenantId,
          branchId: null,
          type:     'PER_STUDENT',
          status:   'ACTIVE',
          expiresAt: { gt: new Date() },
        },
      });
    }

    if (!license) {
      throw new Error('NO_ACTIVE_LICENSE: Your institution does not have an active subscription.');
    }

    return license;
  }

  /**
   * The Quota Guard: Validates if the school can add more students
   */
  static async checkStudentQuota(tenantId: string, branchId: string): Promise<boolean> {
    const license = await this.getActiveLicense(tenantId, branchId);

    if (license.maxStudents === null) return true; // Unlimited plan

    // Student model uses `isActive: boolean`, not `status: string`
    const currentCount = await prisma.student.count({
      where: license.type === 'PER_BRANCH'
        ? { branchId, isActive: true }
        : { tenantId, isActive: true },
    });

    if (currentCount >= license.maxStudents) {
      throw new Error(`QUOTA_EXCEEDED: License limit of ${license.maxStudents} students reached. Please upgrade your plan.`);
    }

    return true;
  }
}
