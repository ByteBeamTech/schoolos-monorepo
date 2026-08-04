// Late Fee Module FDD v2 Section 2.2/2.3 / Implementation Roadmap v2
// Sprint 2. Tests the resolution chain and fallback behavior in
// isolation -- no transaction, no lock, no cron scan -- exactly the
// reason late-fee-rule-resolver.ts was kept as a standalone function.

import { resolveLateFeeConfig } from './late-fee-rule-resolver';

const DEFAULT_CONFIG = {
  gracePeriodDays: 7,
  penaltyType: 'PERCENTAGE' as const,
  penaltyValue: 2,
  maxPenalty: 500,
  compoundDaily: false,
};

function rule(over: Partial<{
  id: string; branchId: string | null; feePlanId: string | null;
  gracePeriodDays: number; penaltyType: 'FLAT' | 'PERCENTAGE'; penaltyValue: number;
  maxPenalty: number | null; compoundDaily: boolean;
}> = {}) {
  return {
    id: 'rule-default', branchId: null, feePlanId: null,
    calculationMethod: 'PERCENTAGE',
    gracePeriodDays: 7, penaltyType: 'PERCENTAGE' as const, penaltyValue: 2,
    maxPenalty: 500, compoundDaily: false,
    ...over,
  };
}

describe('resolveLateFeeConfig — resolution chain (FDD Section 2.2)', () => {
  it('a Fee-Plan-scoped rule wins over a Branch-scoped one for a matching invoice', async () => {
    const prisma = {
      lateFeeRule: {
        findMany: jest.fn().mockResolvedValue([
          rule({ id: 'branch-rule', branchId: 'b-1', feePlanId: null, gracePeriodDays: 5 }),
          rule({ id: 'plan-rule', branchId: 'b-1', feePlanId: 'fp-1', gracePeriodDays: 3 }),
        ]),
      },
    };

    const result = await resolveLateFeeConfig(prisma, 't-1', 'b-1', 'fp-1', DEFAULT_CONFIG);

    expect(result.ruleId).toBe('plan-rule');
    expect(result.config.gracePeriodDays).toBe(3);
    expect(result.usedFallbackConfig).toBe(false);
  });

  it('a Branch-scoped rule wins over Tenant-scope when no Fee-Plan-specific rule exists', async () => {
    const prisma = {
      lateFeeRule: {
        findMany: jest.fn().mockResolvedValue([
          rule({ id: 'tenant-rule', branchId: null, feePlanId: null, gracePeriodDays: 10 }),
          rule({ id: 'branch-rule', branchId: 'b-1', feePlanId: null, gracePeriodDays: 5 }),
        ]),
      },
    };

    const result = await resolveLateFeeConfig(prisma, 't-1', 'b-1', 'fp-1', DEFAULT_CONFIG);

    expect(result.ruleId).toBe('branch-rule');
    expect(result.config.gracePeriodDays).toBe(5);
  });

  it('Tenant-scope applies when nothing more specific exists', async () => {
    const prisma = {
      lateFeeRule: {
        findMany: jest.fn().mockResolvedValue([
          rule({ id: 'tenant-rule', branchId: null, feePlanId: null, gracePeriodDays: 10 }),
        ]),
      },
    };

    const result = await resolveLateFeeConfig(prisma, 't-1', 'b-1', 'fp-1', DEFAULT_CONFIG);

    expect(result.ruleId).toBe('tenant-rule');
    expect(result.usedFallbackConfig).toBe(false);
  });

  it('a Branch-scoped rule for a DIFFERENT branch is never selected', async () => {
    const prisma = {
      lateFeeRule: {
        findMany: jest.fn().mockResolvedValue([
          rule({ id: 'other-branch-rule', branchId: 'b-2', feePlanId: null }),
        ]),
      },
    };

    // The query itself is expected to filter by branchId, but this test
    // proves selectMostSpecific() would not accidentally pick a wrong-
    // branch rule even if the query returned one -- defense at both layers.
    const result = await resolveLateFeeConfig(prisma, 't-1', 'b-1', null, DEFAULT_CONFIG);

    expect(result.usedFallbackConfig).toBe(true);
  });

  it('queries with newest-effectiveFrom-first ordering, so two active rules at the identical scope resolve deterministically -- Sprint 3 makes this possible via create-new-not-edit', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { lateFeeRule: { findMany } };

    await resolveLateFeeConfig(prisma, 't-1', 'b-1', null, DEFAULT_CONFIG);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { effectiveFrom: 'desc' } }),
    );
  });
});

describe('resolveLateFeeConfig — resolution failure fallback (FDD Section 2.3, directed revision)', () => {
  it('falls back to DEFAULT_CONFIG, flags usedFallbackConfig, and returns a null ruleId when no rule matches at any scope', async () => {
    const prisma = { lateFeeRule: { findMany: jest.fn().mockResolvedValue([]) } };

    const result = await resolveLateFeeConfig(prisma, 't-1', 'b-1', 'fp-1', DEFAULT_CONFIG);

    expect(result.config).toEqual(DEFAULT_CONFIG);
    expect(result.ruleId).toBeNull();
    expect(result.usedFallbackConfig).toBe(true);
  });

  it('logs a high-severity warning when the fallback fires', async () => {
    const prisma = { lateFeeRule: { findMany: jest.fn().mockResolvedValue([]) } };
    const errorSpy = jest.spyOn((require('@nestjs/common') as any).Logger.prototype, 'error');

    await resolveLateFeeConfig(prisma, 't-1', 'b-1', 'fp-1', DEFAULT_CONFIG);

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('LATE_FEE_RESOLUTION_FALLBACK'));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('tenantId=t-1'));
    errorSpy.mockRestore();
  });

  it('the fallback still assesses correctly using DEFAULT_CONFIG values -- the fee is not silently skipped', async () => {
    const prisma = { lateFeeRule: { findMany: jest.fn().mockResolvedValue([]) } };

    const result = await resolveLateFeeConfig(prisma, 't-1', 'b-1', null, DEFAULT_CONFIG);

    // Section 2.3's whole point: fallback config is a REAL, usable config,
    // not an empty/zeroed one that would silently produce a zero fee.
    expect(result.config.penaltyValue).toBe(2);
    expect(result.config.gracePeriodDays).toBe(7);
  });
});
