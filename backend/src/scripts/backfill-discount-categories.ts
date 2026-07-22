// src/scripts/backfill-discount-categories.ts
//
// FEE-1: DiscountCategory is branch-managed configuration, provisioned when a
// branch is created (OnboardingService, SchoolManagementService.createBranch).
// Every branch that existed before that wiring shipped has NO categories --
// the table was never populated by anything, so it has always been empty.
// Since DiscountService.create() resolves an existing category and refuses to
// create one on demand, those branches cannot create discounts until they are
// backfilled. This is a one-time script to close that gap.
//
// Deliberately bootstraps the real NestJS application context and calls
// DiscountCategoryProvisioningService rather than issuing SQL or a raw
// PrismaClient insert. Two reasons:
//   1. That service is meant to be the ONLY place DiscountCategory rows are
//      written (see its header). A second, parallel implementation here is
//      exactly the duplicate-logic drift this project has been eliminating --
//      same rationale as backfill-licenses.ts.
//   2. IDs. The schema uses @default(cuid()), which Prisma Client applies --
//      raw SQL cannot generate a cuid, and introducing UUIDs into this table
//      would break the project's ID standard for no benefit.
//
// Run with: pnpm --filter backend finance:backfill-discount-categories
//
// Safe to re-run: provisioning is idempotent per branch (existing
// (branchId, code) rows are skipped, never duplicated), so a re-run after a
// partial failure only fills what is still missing. Running it against a
// fully-provisioned database is a no-op that reports everything as skipped.
//
// Also the intended follow-up after `pnpm db:seed` on a development machine:
// the seed scripts create branches directly and are deliberately left alone
// (they are development fixtures, outside FEE-1's scope), so run this
// afterwards to make seeded branches usable for discounts.

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { PrismaService } from '../infra/database/prisma.service';
import { DiscountCategoryProvisioningService } from '../modules/student-billing/discounts/services/discount-category-provisioning.service';

const logger = new Logger('BackfillDiscountCategories');

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const prisma = app.get(PrismaService);
  const provisioner = app.get(DiscountCategoryProvisioningService);

  // Every branch, including inactive ones: an inactive branch may be
  // reactivated later, and provisioning it costs six rows. Ordering is stable
  // so re-runs produce comparable logs.
  const branches = await prisma.branch.findMany({
    select: { id: true, tenantId: true, name: true },
    orderBy: [{ tenantId: 'asc' }, { id: 'asc' }],
  });

  logger.log(
    `Found ${branches.length} branch(es). Provisioning up to ` +
      `${provisioner.templates.length} default categories each.`,
  );

  let branchesChanged = 0;
  let branchesAlreadyComplete = 0;
  let categoriesCreated = 0;
  let failed = 0;
  const failures: { branchId: string; name: string; error: string }[] = [];

  for (const branch of branches) {
    try {
      // One transaction per branch: a branch is either fully provisioned or
      // untouched. Deliberately NOT one transaction for the whole run -- a
      // single bad branch must not roll back everyone else's provisioning,
      // and a long-running transaction over every branch in the database
      // would hold locks far longer than necessary.
      const result = await prisma.$transaction((tx: any) =>
        provisioner.provisionForBranch(tx, branch.tenantId, branch.id),
      );

      categoriesCreated += result.created;
      if (result.created > 0) {
        branchesChanged++;
        logger.log(
          `✓ ${branch.name} (${branch.id}): created ${result.created}, skipped ${result.skipped}`,
        );
      } else {
        branchesAlreadyComplete++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`✗ ${branch.name} (${branch.id}): ${message}`);
      failures.push({ branchId: branch.id, name: branch.name, error: message });
      failed++;
      // Continue rather than aborting the run -- same per-record isolation
      // principle as backfill-licenses.ts.
    }
  }

  logger.log(
    `Backfill complete: ${branchesChanged} branch(es) provisioned ` +
      `(${categoriesCreated} categor${categoriesCreated === 1 ? 'y' : 'ies'} created), ` +
      `${branchesAlreadyComplete} already complete, ${failed} failed.`,
  );

  if (failures.length > 0) {
    logger.warn('Failures (safe to re-run this script after investigating):');
    for (const f of failures) {
      logger.warn(`  ${f.name} (${f.branchId}): ${f.error}`);
    }
  }

  await app.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  logger.error(
    `Backfill script crashed: ${err instanceof Error ? err.message : err}`,
  );
  process.exit(1);
});
