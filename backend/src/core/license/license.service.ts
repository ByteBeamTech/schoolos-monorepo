// core/license/license.service.ts
import { Injectable, ForbiddenException, ServiceUnavailableException, Logger } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { RedisService }  from '../../infra/cache/redis.service';

export interface LicenseCheckResult {
  allowed:       boolean;
  reason?:       string;
  currentCount?: number;
  limit?:        number;
}

@Injectable()
export class LicenseService {
  private readonly logger = new Logger(LicenseService.name);
  private readonly CACHE_TTL = 60; // 60 seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis:  RedisService,
  ) {}

  // ─── Get active license for tenant ─────────────────────────────────────────
  //
  // NOTE: a tenant with no matching row here is treated as "trial / unrestricted"
  // (see canEnrollStudent/hasFeature below) — that is an intentional business rule,
  // not a bug. What IS a bug, and what this fixes, is treating a *failed* DB/cache
  // lookup the same way as "no license row found". Infra failures must not silently
  // grant access — they must surface loudly so callers/monitoring can see it.

  async getActiveLicense(tenantId: string) {
    const cacheKey = `license:${tenantId}`;
    const cached = await this.redis.getJson<any>(cacheKey);
    if (cached) return cached;

    let license;
    try {
      license = await this.prisma.license.findFirst({
        where: {
          tenantId,
          status: { in: ['ACTIVE', 'UNUSED'] },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (err) {
      this.logger.error(
        `License lookup failed for tenant ${tenantId}: ${err instanceof Error ? err.message : err}`,
      );
      throw new ServiceUnavailableException('Unable to verify license status. Please try again.');
    }

    if (license) {
      await this.redis.setJson(cacheKey, license, this.CACHE_TTL);
    }
    return license;
  }

  // ─── Student count enforcement ──────────────────────────────────────────────

  async canEnrollStudent(tenantId: string): Promise<LicenseCheckResult> {
    const license = await this.getActiveLicense(tenantId);
    if (!license) return { allowed: true }; // No license = no restriction (trial)

    if (!license.maxStudents) return { allowed: true };

    const current = await this.prisma.student.count({
      where: { tenantId, isActive: true },
    });

    const gracePct = 1.05; // Allow 5% overage
    const hardLimit = Math.floor(license.maxStudents * gracePct);

    if (current >= hardLimit) {
      return {
        allowed:      false,
        reason:       `Student limit reached (${current}/${license.maxStudents})`,
        currentCount: current,
        limit:        license.maxStudents,
      };
    }

    return { allowed: true, currentCount: current, limit: license.maxStudents };
  }

  // ─── Feature tier enforcement ───────────────────────────────────────────────

  async hasFeature(tenantId: string, feature: string): Promise<boolean> {
    const license = await this.getActiveLicense(tenantId);
    if (!license) return false;

    const features: string[] = license.features ?? [];
    return features.includes(feature) || features.includes('*');
  }

  async assertFeature(tenantId: string, feature: string): Promise<void> {
    const allowed = await this.hasFeature(tenantId, feature);
    if (!allowed) {
      throw new ForbiddenException(
        `Feature "${feature}" is not available on your current plan. Please upgrade.`,
      );
    }
  }

  // ─── Branch count enforcement ───────────────────────────────────────────────

  async canCreateBranch(tenantId: string): Promise<LicenseCheckResult> {
    const license = await this.getActiveLicense(tenantId);
    if (!license?.maxBranches) return { allowed: true };

    let current: number;
    try {
      current = await this.prisma.branch.count({
        where: { tenantId, status: { not: 'SUSPENDED' } },
      });
    } catch (err) {
      this.logger.error(
        `Branch count failed for tenant ${tenantId}: ${err instanceof Error ? err.message : err}`,
      );
      throw new ServiceUnavailableException('Unable to verify branch quota. Please try again.');
    }

    if (current >= license.maxBranches) {
      return {
        allowed:      false,
        reason:       `Branch limit reached (${current}/${license.maxBranches})`,
        currentCount: current,
        limit:        license.maxBranches,
      };
    }
    return { allowed: true, currentCount: current, limit: license.maxBranches };
  }

  // ─── Invalidate cache ────────────────────────────────────────────────────────

  async invalidateCache(tenantId: string): Promise<void> {
    await this.redis.del(`license:${tenantId}`);
  }

  // ─── Guard helper — throw if not allowed ─────────────────────────────────────

  async assertCanEnrollStudent(tenantId: string): Promise<void> {
    const result = await this.canEnrollStudent(tenantId);
    if (!result.allowed) {
      throw new ForbiddenException(result.reason ?? 'Student enrollment not allowed');
    }
  }
}
