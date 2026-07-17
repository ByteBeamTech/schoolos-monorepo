// core/license/entitlement-resolver.service.ts
//
// PR-5A: the read path half of the COMM-007 split (LicenseBuilder vs
// EntitlementResolver). This is now the ONLY place entitlement decisions
// (feature checks, quota checks) are made. LicenseService stays a thin,
// cached data-access layer underneath this, plus a deprecated backward-
// compat shim that delegates back here (see license.service.ts).
//
// Frozen API surface (per ADR COMM-007, extended per PR-5A scoping):
//   hasFeature(tenantId, feature)      -> boolean
//   assertFeature(tenantId, feature)   -> throws ForbiddenException
//   getLimit(tenantId, limitKey)       -> number | null (null = unlimited / no license row)
//   assertCanEnrollStudent(tenantId)   -> throws ForbiddenException
//   assertCanEnrollStudents(tenantId, additionalCount) -> throws ForbiddenException
//     (batch-aware variant for bulk import pre-flight checks; single-
//     student assertCanEnrollStudent is just this with additionalCount=1)
//   assertCanCreateBranch(tenantId)    -> throws ForbiddenException
//   canUseAI(tenantId)                 -> boolean
//   assertCanUseAI(tenantId)           -> throws ForbiddenException
//
// Per COMM-007, enforcement call sites generally use assert-style methods,
// not can-style booleans -- assertCanEnrollStudent/assertCanCreateBranch
// deliberately have no "can"-style boolean twin. hasFeature/getLimit stay
// value-returning because callers often need the value itself (e.g.
// showing "3/10 branches used" in a UI). canUseAI is the one deliberate
// exception to the assert-only rule for quota/branch-style checks --
// added alongside assertCanUseAI per explicit PR-5A scope, since AI
// call sites (once a module exists) may need to branch on availability
// in the UI rather than only catch a thrown exception.
//
// A tenant with no matching License row is treated as unrestricted (trial
// / pre-commercial state) -- the same business rule this always had,
// preserved here unchanged, not reintroduced as a new decision.
//
// Bug fix carried from the first PR-5A pass (found during extraction,
// in-scope, same bug class as PR-1): the pre-extraction student-count
// check did NOT wrap its student.count() query in try/catch the way the
// branch-count check wrapped branch.count() -- meaning a DB failure
// during the student-count query would have thrown an unhandled 500
// instead of a deliberate, monitorable ServiceUnavailableException. Both
// paths fail identically now.

import { Injectable, ForbiddenException, ServiceUnavailableException, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { LicenseService } from './license.service';

export type LicenseLimitKey = 'maxStudents' | 'maxStaff' | 'maxBranches' | 'storageLimit';

const STUDENT_QUOTA_GRACE_PCT = 1.05; // Allow 5% overage, unchanged from pre-PR-5A behavior
const AI_FEATURE_KEY = 'ai'; // feature-string convention, not a schema field -- see hasFeature()

@Injectable()
export class EntitlementResolver {
  private readonly logger = new Logger(EntitlementResolver.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => LicenseService))
    private readonly licenseService: LicenseService,
  ) {}

  // ─── Feature tier ────────────────────────────────────────────────────────────

  async hasFeature(tenantId: string, feature: string): Promise<boolean> {
    const license = await this.licenseService.getActiveLicense(tenantId);
    if (!license) return false; // no license row = no commercial feature grant

    const features: string[] = (license.features as string[] | null) ?? [];
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

  // ─── Generic numeric limits ──────────────────────────────────────────────────

  async getLimit(tenantId: string, limitKey: LicenseLimitKey): Promise<number | null> {
    const license = await this.licenseService.getActiveLicense(tenantId);
    if (!license) return null; // no license row = unrestricted, nothing numeric to report
    return license[limitKey] ?? null;
  }

  // ─── Student quota ───────────────────────────────────────────────────────────

  async assertCanEnrollStudent(tenantId: string): Promise<void> {
    return this.assertCanEnrollStudents(tenantId, 1);
  }

  /**
   * Batch-aware quota check -- PR-5B, added for BulkService's CSV import.
   * `createMany()` bypasses any per-row hook, so bulk import cannot call
   * assertCanEnrollStudent() once per row (500-5000 rows per import,
   * per BulkService's own limits) without either being wildly expensive
   * or silently doing nothing (createMany has no per-row hook to hang
   * this off of at all). Instead this checks ONCE, before any row is
   * written: does current + additionalCount exceed the license's grace
   * limit? Single source of truth for the grace-period math -- same
   * STUDENT_QUOTA_GRACE_PCT constant, same fail-closed behavior on a
   * count-query DB error -- so assertCanEnrollStudent(tenantId) is just
   * this with additionalCount=1, not a separate implementation.
   *
   * Deliberately fail-fast/whole-batch: if importing `additionalCount`
   * rows would exceed the limit, the entire import is rejected before any
   * row is written, rather than partially importing up to the limit and
   * leaving the caller with a confusing partial-success result.
   */
  async assertCanEnrollStudents(tenantId: string, additionalCount: number): Promise<void> {
    const license = await this.licenseService.getActiveLicense(tenantId);
    if (!license || !license.maxStudents) return; // unrestricted

    let current: number;
    try {
      current = await this.prisma.student.count({
        where: { tenantId, isActive: true },
      });
    } catch (err) {
      this.logger.error(
        `Student count failed for tenant ${tenantId}: ${err instanceof Error ? err.message : err}`,
      );
      throw new ServiceUnavailableException('Unable to verify student quota. Please try again.');
    }

    const hardLimit = Math.floor(license.maxStudents * STUDENT_QUOTA_GRACE_PCT);
    if (current + additionalCount > hardLimit) {
      throw new ForbiddenException(
        `This would push student count to ${current + additionalCount}, exceeding the licensed ` +
        `limit of ${license.maxStudents} (grace ceiling ${hardLimit}). Please upgrade your plan or ` +
        `reduce the import size.`,
      );
    }
  }

  // ─── Branch quota ────────────────────────────────────────────────────────────

  async assertCanCreateBranch(tenantId: string): Promise<void> {
    const license = await this.licenseService.getActiveLicense(tenantId);
    if (!license?.maxBranches) return; // unrestricted

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
      throw new ForbiddenException(
        `Branch limit reached (${current}/${license.maxBranches}). Please upgrade your plan.`,
      );
    }
  }

  // ─── AI feature gate ─────────────────────────────────────────────────────────
  //
  // NOTE: 'ai' is a feature-string convention, not a schema field (License.
  // features is a free-form Json array — see PricingPlan/Superadmin plan
  // editor for where feature strings get assigned). No AI module exists in
  // the codebase yet (confirmed via grep during PR-5 planning) — these two
  // methods exist so PR-5B has something to wire once/if one is built.

  async canUseAI(tenantId: string): Promise<boolean> {
    return this.hasFeature(tenantId, AI_FEATURE_KEY);
  }

  async assertCanUseAI(tenantId: string): Promise<void> {
    const allowed = await this.canUseAI(tenantId);
    if (!allowed) {
      throw new ForbiddenException(
        'AI features are not available on your current plan. Please upgrade.',
      );
    }
  }
}
