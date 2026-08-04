// modules/student-billing/late-fee/late-fee-rule-resolver.ts
//
// Late Fee Module FDD v2 Section 2.2 (resolution chain) / Section 2.3
// (resolution-failure fallback -- the directed revision) / Implementation
// Roadmap v2 Sprint 2.
//
// Kept as a small, standalone function rather than folded into
// LateFeeService directly, specifically so the resolution *logic* --
// narrowest-scope-wins, and what happens when nothing matches -- can be
// unit-tested in isolation, without needing to invoke the cron's full
// transaction/locking machinery around it.
//
// feePlanId derivation note: Invoice has no direct feePlanId column
// (verified against the real schema before writing this -- the only path
// is Invoice.items[].feeItemId (nullable) -> FeeItem.feePlanId). This
// resolver does not perform that derivation itself -- it accepts an
// already-resolved, possibly-null feePlanId, so the caller (LateFeeService,
// which already batch-fetches everything it needs for the cron's scan) is
// the one place that decides how to derive it, not duplicated here.

import { Logger } from '@nestjs/common';
import { LateFeeConfig } from './late-fee.service';

const logger = new Logger('LateFeeRuleResolver');

export interface ResolvedLateFeeConfig {
  config: LateFeeConfig;
  ruleId: string | null;
  usedFallbackConfig: boolean;
}

type LateFeeRuleRow = {
  id: string;
  branchId: string | null;
  feePlanId: string | null;
  calculationMethod: string;
  penaltyType: 'FLAT' | 'PERCENTAGE';
  penaltyValue: number | string;
  gracePeriodDays: number;
  maxPenalty: number | string | null;
  compoundDaily: boolean;
};

/**
 * FDD Section 2.2: narrowest-match-wins across three real levels --
 * Fee-Plan-scoped, then Branch-scoped, then Tenant-scoped. A rule with
 * BOTH branchId and feePlanId set only matches when the invoice's own
 * branch AND fee plan both match that rule exactly -- this is what makes
 * a Fee-Plan-scoped rule "more specific" than a Branch-scoped one, not
 * merely "also has a feePlanId."
 */
function selectMostSpecific(
  rules: LateFeeRuleRow[],
  branchId: string,
  feePlanId: string | null,
): LateFeeRuleRow | null {
  if (feePlanId) {
    const feePlanMatch = rules.find((r) => r.branchId === branchId && r.feePlanId === feePlanId);
    if (feePlanMatch) return feePlanMatch;
  }
  const branchMatch = rules.find((r) => r.branchId === branchId && r.feePlanId === null);
  if (branchMatch) return branchMatch;

  const tenantMatch = rules.find((r) => r.branchId === null && r.feePlanId === null);
  return tenantMatch ?? null;
}

function toLateFeeConfig(rule: LateFeeRuleRow): LateFeeConfig {
  return {
    gracePeriodDays: rule.gracePeriodDays,
    penaltyType: rule.penaltyType,
    penaltyValue: Number(rule.penaltyValue),
    maxPenalty: rule.maxPenalty != null ? Number(rule.maxPenalty) : undefined,
    compoundDaily: rule.compoundDaily,
  };
}

/**
 * FDD Section 2.3 (directed revision): resolution failure does not
 * silently disable late fees. Logs a high-severity warning, and the
 * caller (LateFeeService) is responsible for setting usedFallbackConfig
 * on the resulting LateFee row so the Rule Management admin banner
 * (Sprint 4) has something real to query -- this function only decides
 * WHETHER the fallback fired, not how it's persisted.
 */
export async function resolveLateFeeConfig(
  prisma: any,
  tenantId: string,
  branchId: string,
  feePlanId: string | null,
  defaultConfig: LateFeeConfig,
): Promise<ResolvedLateFeeConfig> {
  const candidates: LateFeeRuleRow[] = await prisma.lateFeeRule.findMany({
    where: {
      tenantId,
      isActive: true,
      OR: [
        { branchId: null, feePlanId: null },
        { branchId, feePlanId: null },
        ...(feePlanId ? [{ branchId, feePlanId }] : []),
      ],
    },
    // Sprint 3 note: Sprint 1's seed only ever creates one rule per
    // scope, so this ordering was unreachable code until Sprint 3's
    // create() endpoint made it possible for two active rules to exist
    // at the identical scope (create-new-not-edit, FDD 6.2, means a
    // caller can create a replacement without having deactivated the
    // old one first). Newest-effectiveFrom-wins is the deterministic,
    // minimal tie-breaker -- not a new business rule, just a defined
    // answer to "which one" instead of depending on undefined query order.
    orderBy: { effectiveFrom: 'desc' },
  });

  const resolved = selectMostSpecific(candidates, branchId, feePlanId);

  if (resolved) {
    return { config: toLateFeeConfig(resolved), ruleId: resolved.id, usedFallbackConfig: false };
  }

  // FDD Section 2.3, verbatim intent: silently disabling late fee
  // collection because a rule row is missing is a worse failure mode
  // than falling back to a known default. Tagged distinctly from
  // ordinary cron log output so it can't be missed in normal log volume.
  logger.error(
    `LATE_FEE_RESOLUTION_FALLBACK tenantId=${tenantId} branchId=${branchId} ` +
      `feePlanId=${feePlanId ?? 'null'} -- no active LateFeeRule found at any scope; ` +
      `falling back to DEFAULT_CONFIG. Configure a rule for this tenant/branch to clear this warning.`,
  );

  return { config: defaultConfig, ruleId: null, usedFallbackConfig: true };
}
