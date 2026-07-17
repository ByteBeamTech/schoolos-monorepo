// src/scripts/sync-feature-flag-catalog.ts
//
// Bootstraps the real NestJS app context and calls
// FeatureFlagCatalogSyncService.sync() -- deliberately not a raw-
// PrismaClient reimplementation, same reasoning as backfill-licenses.ts:
// the sync logic belongs in one real, injectable service, not duplicated
// in a script.
//
// Run with: pnpm --filter backend commercial:sync-feature-flags
// Safe to re-run: upserts on `name`, never deletes. See
// FeatureFlagCatalogSyncService's own header comment for exact semantics
// (what gets created/updated/left-alone).

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { FeatureFlagCatalogSyncService } from '../core/feature-flags/feature-flag-catalog-sync.service';

const logger = new Logger('SyncFeatureFlagCatalog');

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const syncService = app.get(FeatureFlagCatalogSyncService);
  const result = await syncService.sync();

  logger.log(`Created (${result.created.length}): ${result.created.join(', ') || '-'}`);
  logger.log(`Updated (${result.updated.length}): ${result.updated.join(', ') || '-'}`);
  logger.log(`Unchanged: ${result.unchanged.length}`);
  if (result.orphaned.length > 0) {
    logger.warn(
      `Orphaned in DB, not in ALL_FLAGS (not deleted -- investigate manually): ${result.orphaned.join(', ')}`,
    );
  }

  await app.close();
  process.exit(0);
}

main().catch((err) => {
  logger.error(`Sync script crashed: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
