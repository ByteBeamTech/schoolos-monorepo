// core/feature-flags/feature-flag-catalog-sync.service.ts
//
// SA-1C / COMM-007 (naming pending): closes a gap found while smoke-
// testing COMM-006A -- ALL_FLAGS (flag-definitions.ts) is a static code
// catalog, but the FeatureFlag DB TABLE it's meant to correspond to
// (which FeatureFlagOverride/FeatureFlagOverrideRequest reference via a
// real flagId foreign key) was never populated from it. No seed script,
// no onModuleInit sync, nothing -- confirmed via repo-wide grep. Every
// createOverrideRequest()/setOverride() call in COMM-006A's real write-
// path fails with "Unknown flag: X" as a result, since it resolves
// flagId via a DB lookup against an empty table.
//
// Deliberately NOT an onModuleInit hook (would run on every boot,
// unreviewed) and NOT a disposable one-off seed script (would drift the
// moment ALL_FLAGS gains a new entry) -- a real, injectable, idempotent
// service, invokable via CLI (see scripts/sync-feature-flag-catalog.ts)
// and safe to re-run as part of deployment/maintenance, same shape as
// LicenseBuilder.regenerateForTenant() being the one real write path for
// License rows rather than a script reimplementing the logic inline.
//
// Sync semantics: upsert on `name` (FeatureFlag's real unique key).
// - New entries in ALL_FLAGS not yet in the DB -> created.
// - Existing DB rows whose code-catalog fields drifted (label,
//   description, defaultValue, allowedTiers, tenantControllable,
//   category) -> updated to match ALL_FLAGS. ALL_FLAGS is treated as the
//   source of truth for these fields.
// - Fields NOT touched on update, because they're operational/runtime
//   state that has nothing to do with the code catalog: rolloutPercentage,
//   enabledFromAt, enabledUntilAt, createdBy, updatedBy. Overwriting these
//   on every sync would silently wipe out live rollout configuration.
// - DB rows whose name no longer appears in ALL_FLAGS are left alone, not
//   deleted -- removing a flag from code shouldn't cascade-delete its
//   history (overrides/requests reference it via flagId) or silently
//   orphan live overrides. Reported as "orphaned" for visibility, not
//   acted on automatically.

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { ALL_FLAGS, FlagDefinition } from './flag-definitions';

export interface CatalogSyncResult {
  created: string[];
  updated: string[];
  unchanged: string[];
  orphaned: string[]; // DB rows not present in ALL_FLAGS -- reported, not deleted
}

// Explicit shape for the `select` below -- kept separate from relying on
// Prisma's inferred return type, since that inference depends on a
// generated client being present (this repo's sandbox/CI environments
// have hit this gap before -- see PR-5's session notes on `prisma
// generate` requiring network access to binaries.prisma.sh).
interface SelectedFlagRow {
  name:               string;
  category:           string;
  label:              string;
  description:        string | null;
  defaultValue:       boolean;
  allowedTiers:       unknown;
  tenantControllable: boolean;
}

@Injectable()
export class FeatureFlagCatalogSyncService {
  private readonly logger = new Logger(FeatureFlagCatalogSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  async sync(): Promise<CatalogSyncResult> {
    const result: CatalogSyncResult = { created: [], updated: [], unchanged: [], orphaned: [] };

    const existing = await this.prisma.featureFlag.findMany({
      select: {
        name: true, category: true, label: true, description: true,
        defaultValue: true, allowedTiers: true, tenantControllable: true,
      },
    }) as SelectedFlagRow[];
    const existingByName = new Map(existing.map((f) => [f.name, f]));

    for (const def of ALL_FLAGS as FlagDefinition[]) {
      const current = existingByName.get(def.name);

      if (!current) {
        await this.prisma.featureFlag.create({
          data: {
            name:               def.name,
            category:           def.category as any,
            label:              def.label,
            description:        def.description,
            defaultValue:       def.defaultValue,
            allowedTiers:       def.allowedTiers as any,
            tenantControllable: def.tenantControllable,
          },
        });
        result.created.push(def.name);
        continue;
      }

      const driftedFields: string[] = [];
      if (current.category !== def.category)                                       driftedFields.push('category');
      if (current.label !== def.label)                                             driftedFields.push('label');
      if (current.description !== def.description)                                 driftedFields.push('description');
      if (current.defaultValue !== def.defaultValue)                               driftedFields.push('defaultValue');
      if (JSON.stringify(current.allowedTiers) !== JSON.stringify(def.allowedTiers)) driftedFields.push('allowedTiers');
      if (current.tenantControllable !== def.tenantControllable)                    driftedFields.push('tenantControllable');

      if (driftedFields.length === 0) {
        result.unchanged.push(def.name);
        continue;
      }

      await this.prisma.featureFlag.update({
        where: { name: def.name },
        data: {
          category:           def.category as any,
          label:              def.label,
          description:        def.description,
          defaultValue:       def.defaultValue,
          allowedTiers:       def.allowedTiers as any,
          tenantControllable: def.tenantControllable,
        },
      });
      result.updated.push(`${def.name} (${driftedFields.join(', ')})`);
    }

    const codeNames = new Set(ALL_FLAGS.map((f) => f.name));
    for (const row of existing) {
      if (!codeNames.has(row.name)) result.orphaned.push(row.name);
    }

    this.logger.log(
      `Catalog sync: ${result.created.length} created, ${result.updated.length} updated, ` +
      `${result.unchanged.length} unchanged, ${result.orphaned.length} orphaned (not deleted).`,
    );
    return result;
  }
}
