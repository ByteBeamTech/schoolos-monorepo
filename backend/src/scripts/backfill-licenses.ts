// src/scripts/backfill-licenses.ts
//
// PR-4 mandatory item (review feedback): every tenant that existed before
// this PR shipped has no License row -- LicenseBuilder only creates one
// going forward (onboarding for new tenants, SUBSCRIPTION_ACTIVATED for
// trial->paid conversions). This is a one-time script to backfill the gap
// for tenants that already exist.
//
// Deliberately bootstraps the real NestJS application context rather than
// reimplementing license logic with a raw PrismaClient -- LicenseBuilder
// is meant to be the ONLY place a License row is written (see its own
// header comment). A second, parallel implementation here would be exactly
// the kind of duplicate-logic drift this whole project has been about
// eliminating (see PR-1's LicenseService/DunningService findings).
//
// Run with: pnpm --filter backend commercial:backfill-licenses
// Safe to re-run: tenants that already have a License are skipped, not
// regenerated -- this is a backfill for tenants with NONE, not a
// "resync everyone" tool. Re-running after a partial failure will only
// pick up whatever's still missing.

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { LicenseBuilder } from '../core/license/license-builder.service';
import { PrismaService } from '../infra/database/prisma.service';

const logger = new Logger('BackfillLicenses');

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const prisma         = app.get(PrismaService);
  const licenseBuilder = app.get(LicenseBuilder);

  // Tenants with a current subscription but no License row at all --
  // LicenseBuilder requires a current subscription to exist (it derives
  // limits/features from it), so a tenant with no subscription is a
  // separate, pre-existing data problem this script doesn't attempt to fix.
  const tenantsNeedingBackfill = await prisma.tenant.findMany({
    where: {
      subscriptions: { some: { isCurrent: true } },
      License:       { none: {} }, // Prisma's default back-relation field name
                                    // for License on Tenant (see
                                    // schema/core/tenant.prisma) -- capitalized,
                                    // not `licenses`, since it was never
                                    // explicitly renamed via @relation.
    },
    select: { id: true, name: true, slug: true },
  });

  logger.log(`Found ${tenantsNeedingBackfill.length} tenant(s) needing a backfilled License.`);

  let succeeded = 0;
  let failed    = 0;
  const failures: { tenantId: string; slug: string; error: string }[] = [];

  for (const tenant of tenantsNeedingBackfill) {
    try {
      const result = await licenseBuilder.regenerateForTenant(
        tenant.id,
        'BACKFILL',
        'backfill-script',
      );
      logger.log(
        `✓ ${tenant.slug} (${tenant.id}): license=${result.licenseId} ` +
        `generation=${result.generationVersion} status=${result.status}`,
      );
      succeeded++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`✗ ${tenant.slug} (${tenant.id}): ${message}`);
      failures.push({ tenantId: tenant.id, slug: tenant.slug, error: message });
      failed++;
      // Deliberately continue to the next tenant rather than aborting the
      // whole run -- one bad tenant record (e.g. a subscription with a
      // corrupt planSnapshot) shouldn't block backfilling everyone else.
      // Same per-record isolation principle as license-expiry.job.ts.
    }
  }

  logger.log(`Backfill complete: ${succeeded} succeeded, ${failed} failed.`);
  if (failures.length > 0) {
    logger.warn('Failures (re-run this script after investigating -- it is safe to re-run):');
    for (const f of failures) {
      logger.warn(`  ${f.slug} (${f.tenantId}): ${f.error}`);
    }
  }

  await app.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  logger.error(`Backfill script crashed: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
