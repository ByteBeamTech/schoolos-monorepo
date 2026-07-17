// core/license/license.service.ts
//
// PR-5A: LicenseService is now a thin, cached data-access layer
// (getActiveLicense/invalidateCache) PLUS a deprecated backward-compat
// shim. All business-rule entitlement logic (feature checks, quota
// asserts) now lives in EntitlementResolver (./entitlement-resolver.
// service.ts) -- the ADR COMM-007 split. This class still owns the
// canonical cached License lookup because LicenseBuilder,
// license-expiry.job.ts, and the backfill script all need raw
// data access without the entitlement-decision layer on top.
//
// Backward-compat note: confirmed via grep that nothing outside this
// module ever called the old business methods (canEnrollStudent,
// hasFeature, assertFeature, canCreateBranch, assertCanEnrollStudent) --
// they are kept here ONLY as deprecated pass-throughs to
// EntitlementResolver, per explicit instruction to preserve the public
// method surface during this transition even though it's currently
// unused, rather than assume nothing external will ever reference it.
// New code must depend on EntitlementResolver directly -- these wrappers
// are scheduled for removal once PR-5B's rollout confirms nothing needs
// them.
//
// Circular-dependency note: EntitlementResolver depends on LicenseService
// (for getActiveLicense), and LicenseService depends on
// EntitlementResolver (for these deprecated wrappers) -- both sides use
// forwardRef() to break the cycle at module-init time. This is the
// standard NestJS pattern for two services in the same module that
// legitimately need each other; it is not a design smell here because
// the two directions serve genuinely different purposes (data access vs.
// business-rule delegation).
import { Injectable, ForbiddenException, ServiceUnavailableException, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { RedisService }  from '../../infra/cache/redis.service';
import { EntitlementResolver } from './entitlement-resolver.service';

// Preserved verbatim from pre-PR-5A LicenseService -- the deprecated
// canEnrollStudent()/canCreateBranch() wrappers below still return this
// shape for backward compatibility.
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
    @Inject(forwardRef(() => EntitlementResolver))
    private readonly entitlementResolver: EntitlementResolver,
  ) {}

  // ─── Get active license for tenant ─────────────────────────────────────────
  //
  // NOTE: a tenant with no matching row here is treated as "trial / unrestricted"
  // (see EntitlementResolver) — that is an intentional business rule, not a bug.
  // What IS a bug, and what this fixes (since PR-1), is treating a *failed*
  // DB/cache lookup the same way as "no license row found". Infra failures must
  // not silently grant access — they must surface loudly so callers/monitoring
  // can see it.

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

  // ─── Invalidate cache ────────────────────────────────────────────────────────

  async invalidateCache(tenantId: string): Promise<void> {
    await this.redis.del(`license:${tenantId}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DEPRECATED — backward-compat shims only. New code must call
  // EntitlementResolver directly. These delegate, they do not reimplement.
  // ══════════════════════════════════════════════════════════════════════════

  /** @deprecated Use EntitlementResolver.hasFeature() directly. */
  async hasFeature(tenantId: string, feature: string): Promise<boolean> {
    return this.entitlementResolver.hasFeature(tenantId, feature);
  }

  /** @deprecated Use EntitlementResolver.assertFeature() directly. */
  async assertFeature(tenantId: string, feature: string): Promise<void> {
    return this.entitlementResolver.assertFeature(tenantId, feature);
  }

  /**
   * @deprecated Use EntitlementResolver.assertCanEnrollStudent() directly.
   * NOTE: EntitlementResolver's assert-style method throws with a
   * human-readable message but does not separately expose currentCount/
   * limit as structured fields. This wrapper reconstructs the {allowed:
   * false, reason} shape from the thrown error for backward compatibility,
   * but currentCount/limit are left undefined on the false-path here --
   * flagging rather than silently fabricating counts. No caller reads
   * these fields today (confirmed via grep), so this is a safe temporary
   * gap, not a live regression.
   */
  async canEnrollStudent(tenantId: string): Promise<LicenseCheckResult> {
    try {
      await this.entitlementResolver.assertCanEnrollStudent(tenantId);
      return { allowed: true };
    } catch (err) {
      if (err instanceof ForbiddenException) {
        return { allowed: false, reason: err.message };
      }
      throw err;
    }
  }

  /** @deprecated Use EntitlementResolver.assertCanEnrollStudent() directly. */
  async assertCanEnrollStudent(tenantId: string): Promise<void> {
    return this.entitlementResolver.assertCanEnrollStudent(tenantId);
  }

  /**
   * @deprecated Use EntitlementResolver.assertCanCreateBranch() directly.
   * Same currentCount/limit caveat as canEnrollStudent() above.
   */
  async canCreateBranch(tenantId: string): Promise<LicenseCheckResult> {
    try {
      await this.entitlementResolver.assertCanCreateBranch(tenantId);
      return { allowed: true };
    } catch (err) {
      if (err instanceof ForbiddenException) {
        return { allowed: false, reason: err.message };
      }
      throw err;
    }
  }
}
