// FEE-0 item 4: regression tests for per-request branch resolution.
// AUTH-050 / INV-13: UserBranch changes take effect on the very next request,
// with NO token regeneration -- because validate() re-reads branchMappings
// from the DB every call and never trusts branch data from the JWT payload.
// Also pins INV-11's login-layer half: a non-tenant-wide principal with zero
// active mappings is rejected, not granted an empty/tenant-wide result.

import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy.validate (FEE-0 regression: AUTH-050, INV-13, INV-11)', () => {
  let prisma: any;
  let strategy: JwtStrategy;
  const config: any = { get: jest.fn().mockReturnValue('test-secret') };
  const payload = { sub: 'u-1', tenantId: 't-1', jti: 'j-1' };

  function dbUser(mappings: Array<{ branchId: string; isDefault?: boolean }>, role = 'ACCOUNTANT') {
    return {
      id: 'u-1', tenantId: 't-1', role, email: 'a@b.c',
      branchMappings: mappings.map((m) => ({ branchId: m.branchId, isDefault: !!m.isDefault })),
    };
  }

  beforeEach(() => {
    prisma = { user: { findFirst: jest.fn() } };
    strategy = new JwtStrategy(config, prisma);
  });

  it('resolves branchIds from the DB on every call -- same token, changed mappings, changed result (INV-13)', async () => {
    prisma.user.findFirst.mockResolvedValueOnce(dbUser([{ branchId: 'b-1', isDefault: true }]));
    const first = await strategy.validate(payload);
    expect(first.branchIds).toEqual(['b-1']);

    // Simulate an admin granting b-2 and revoking nothing, mid-session:
    prisma.user.findFirst.mockResolvedValueOnce(
      dbUser([{ branchId: 'b-1', isDefault: true }, { branchId: 'b-2' }]),
    );
    const second = await strategy.validate(payload); // identical JWT payload
    expect(second.branchIds).toEqual(['b-1', 'b-2']);

    // And a revocation is equally immediate:
    prisma.user.findFirst.mockResolvedValueOnce(dbUser([{ branchId: 'b-2', isDefault: true }]));
    const third = await strategy.validate(payload);
    expect(third.branchIds).toEqual(['b-2']);
  });

  it('only ACTIVE mappings are consulted -- the isActive filter is in the query itself (AUTH-050/INV-9 shape)', async () => {
    prisma.user.findFirst.mockResolvedValue(dbUser([{ branchId: 'b-1', isDefault: true }]));
    await strategy.validate(payload);
    const select = prisma.user.findFirst.mock.calls[0][0].select;
    expect(select.branchMappings.where).toEqual({ isActive: true });
    // And the user lookup itself requires active + non-deleted in-tenant:
    const where = prisma.user.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({ id: 'u-1', tenantId: 't-1', isActive: true, deletedAt: null });
  });

  it('branch data in the JWT payload is ignored -- only DB state matters (AUTH-050)', async () => {
    prisma.user.findFirst.mockResolvedValue(dbUser([{ branchId: 'b-1', isDefault: true }]));
    const result = await strategy.validate({ ...payload, branchIds: ['b-999'], branchId: 'b-999' } as any);
    expect(result.branchIds).toEqual(['b-1']);
    expect(result.branchId).toBe('b-1');
  });

  it('a non-tenant-wide principal with zero active mappings is rejected (INV-11, fail closed)', async () => {
    prisma.user.findFirst.mockResolvedValue(dbUser([], 'PRINCIPAL'));
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('tenant-wide roles are exempt from the mapping requirement (AUTH-052/058)', async () => {
    for (const role of ['SCHOOL_OWNER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']) {
      prisma.user.findFirst.mockResolvedValue(dbUser([], role));
      const result = await strategy.validate(payload);
      expect(result.branchIds).toEqual([]);
      expect(result.branchId).toBeUndefined();
    }
  });

  it('an inactive or deleted user is rejected regardless of a valid token', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
