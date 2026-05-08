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
