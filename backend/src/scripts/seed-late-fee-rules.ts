// src/scripts/seed-late-fee-rules.ts
//
// Late Fee Module FDD v2 (docs/product/LATE_FEE_FDD.md) Section 9.2 /
// Implementation Roadmap v2 Sprint 1.
//
// A one-time seed, NOT a backfill of historical data: for every tenant
// currently in production, creates exactly one Tenant-scope LateFeeRule
// with calculation parameters copied verbatim from LateFeeService's
// existing DEFAULT_CONFIG constant (7-day grace, 2% monthly percentage
// penalty, PS500 cap, non-compounding). This makes today's single,
// silent, hardcoded default into the first visible, editable rule every
// tenant already has -- no tenant's late-fee behaviour changes on the day
// this runs, since getTenantConfig() does not read this table yet
// (Sprint 2). A school only sees a different late-fee amount once it, or
// an admin acting for it, deliberately edits or supersedes this seeded
// rule.
//
// Deliberately a direct PrismaService write, not a delegated service
// call (unlike backfill-discount-categories.ts, which bootstraps a real
// provisioning service specifically to avoid a second, parallel
// implementation of write logic that already existed there). No parallel
// exists here: nothing else in this codebase writes to LateFeeRule yet
// (RulesService is Sprint 3) -- this script is not duplicating logic that
// belongs somewhere else, it is the first and only writer at this point
// in the roadmap.
//
// Run with: pnpm --filter backend finance:seed-late-fee-rules
//
// Safe to re-run: skips any tenant that already has an active Tenant-scope
// rule (branchId AND feePlanId both NULL) rather than creating a second
// one -- verified directly against the migration's own COALESCE-based
// unique index (Sprint 1), which would reject an exact duplicate at the
// database level regardless, but this check makes a re-run report
// "already seeded" instead of surfacing a constraint-violation error for
// every tenant on a second run.

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { PrismaService } from '../infra/database/prisma.service';

const logger = new Logger('SeedLateFeeRules');

// Copied verbatim from LateFeeService's DEFAULT_CONFIG -- not retyped by
// hand, imported directly, so a future change to that constant cannot
// silently drift from what this seed produces without also being a
// visible import-path change here.
import { DEFAULT_CONFIG } from '../modules/student-billing/late-fee/late-fee.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const prisma = app.get(PrismaService);

  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true },
    orderBy: { id: 'asc' },
  });

  logger.log(`Found ${tenants.length} tenant(s). Seeding one Tenant-scope late fee rule each.`);

  let created = 0;
  let alreadySeeded = 0;
  let failed = 0;
  const failures: { tenantId: string; name: string; error: string }[] = [];
  const effectiveFrom = new Date();

  for (const tenant of tenants) {
    try {
      // Idempotency check -- see header. A second run against an
      // already-seeded tenant is a no-op, reported distinctly from a
      // fresh creation, not silently skipped without a trace.
      const existing = await prisma.lateFeeRule.findFirst({
        where: {
          tenantId: tenant.id,
          branchId: null,
          feePlanId: null,
          isActive: true,
        },
      });

      if (existing) {
        alreadySeeded++;
        continue;
      }

      // (prisma.lateFeeRule as any) matches the established pattern already
      // used for this exact Prisma checked/unchecked-create-input friction
      // elsewhere in this codebase (discount.service.ts's own create call) --
      // not a new workaround invented here.
      await (prisma.lateFeeRule as any).create({
        data: {
          tenantId: tenant.id,
          branchId: null,
          feePlanId: null,
          // FDD Section 3: MVP scope has no slab rules, so calculationMethod
          // mirrors penaltyType exactly for the two values DEFAULT_CONFIG
          // can hold today -- derived, not hardcoded separately, so this
          // can't drift from DEFAULT_CONFIG.penaltyType if that ever changes.
          calculationMethod: DEFAULT_CONFIG.penaltyType,
          penaltyType: DEFAULT_CONFIG.penaltyType,
          penaltyValue: DEFAULT_CONFIG.penaltyValue,
          gracePeriodDays: DEFAULT_CONFIG.gracePeriodDays,
          maxPenalty: DEFAULT_CONFIG.maxPenalty,
          compoundDaily: DEFAULT_CONFIG.compoundDaily,
          effectiveFrom,
          isActive: true,
          // No human actor -- this rule is created by a migration step,
          // not a person clicking a button (matching the existing
          // LateFee.appliedById precedent for the cron's own automated
          // writes).
          createdById: null,
        },
      });

      created++;
      logger.log(`\u2713 ${tenant.name} (${tenant.id}): seeded default late fee rule`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`\u2717 ${tenant.name} (${tenant.id}): ${message}`);
      failures.push({ tenantId: tenant.id, name: tenant.name, error: message });
      failed++;
      // Continue rather than aborting the run -- one bad tenant must not
      // block every other tenant's seed, same per-record isolation
      // principle as backfill-discount-categories.ts.
    }
  }

  logger.log(
    `Seed complete: ${created} tenant(s) seeded, ${alreadySeeded} already had a rule, ${failed} failed.`,
  );

  if (failures.length > 0) {
    logger.warn('Failures (safe to re-run this script after investigating):');
    for (const f of failures) {
      logger.warn(`  ${f.name} (${f.tenantId}): ${f.error}`);
    }
  }

  await app.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  logger.error(`Seed script crashed: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
