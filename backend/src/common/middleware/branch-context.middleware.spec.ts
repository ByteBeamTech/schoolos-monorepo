// FEE-0 item 4 (regression) + item 5 (new behavior verified here).
// AUTH-051 (header selects, never widens), AUTH-052 (SCHOOL_OWNER/SUPER_ADMIN
// unconditionally tenant-wide), AUTH-058 (SCHOOL_ADMIN both paths),
// INV-10 (client branch param never yields out-of-set access).
// Item 5 IS a production change in this commit: the tenant-wide branch
// selector did not exist before (the header was validated against branchIds
// only, wrongly 403'ing unrestricted SCHOOL_ADMIN / SCHOOL_OWNER). These
// tests verify the corrected behavior.

import { ForbiddenException } from '@nestjs/common';
import { BranchContextMiddleware } from './branch-context.middleware';

function makeReq(user: any, headerBranch?: string): any {
  return {
    user,
    headers: headerBranch ? { 'x-branch-id': headerBranch } : {},
  };
}

describe('BranchContextMiddleware (FEE-0 regression: AUTH-051/052/058, INV-10)', () => {
  let middleware: BranchContextMiddleware;
  let prisma: any;
  const next = jest.fn();

  beforeEach(() => {
    prisma = { branch: { findFirst: jest.fn() } };
    middleware = new BranchContextMiddleware(prisma);
    next.mockClear();
  });

  describe('branch-restricted principals (AUTH-051: select within set only)', () => {
    const restricted = { id: 'u', tenantId: 't-1', role: 'ACCOUNTANT', branchIds: ['b-1', 'b-2'], branchId: 'b-1' };

    it('header inside the set selects that branch', async () => {
      const req = makeReq({ ...restricted }, 'b-2');
      await middleware.use(req, {} as any, next);
      expect(req.user.branchId).toBe('b-2');
      expect(next).toHaveBeenCalled();
    });

    it('header outside the set is 403 -- never widens, never silently falls back (INV-10)', async () => {
      const req = makeReq({ ...restricted }, 'b-9');
      await expect(middleware.use(req, {} as any, next)).rejects.toBeInstanceOf(ForbiddenException);
      expect(req.user.branchId).toBe('b-1'); // untouched
      expect(next).not.toHaveBeenCalled();
    });

    it('no header falls back to the default branch resolved by JwtStrategy', async () => {
      const req = makeReq({ ...restricted });
      await middleware.use(req, {} as any, next);
      expect(req.user.branchId).toBe('b-1');
    });

    it('restricted SCHOOL_ADMIN follows the restricted path (AUTH-058 restricted)', async () => {
      const req = makeReq({ id: 'u', tenantId: 't-1', role: 'SCHOOL_ADMIN', branchIds: ['b-1'], branchId: 'b-1' }, 'b-2');
      await expect(middleware.use(req, {} as any, next)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.branch.findFirst).not.toHaveBeenCalled(); // not the tenant-wide path
    });
  });

  describe('tenant-wide principals (AUTH-052 / AUTH-058 default)', () => {
    it.each([
      ['SCHOOL_OWNER with mappings', { role: 'SCHOOL_OWNER', branchIds: ['b-1'] }],
      ['SUPER_ADMIN', { role: 'SUPER_ADMIN', branchIds: [] }],
      ['unrestricted SCHOOL_ADMIN', { role: 'SCHOOL_ADMIN', branchIds: [] }],
    ])('%s may select any ACTIVE branch of their OWN tenant', async (_label, extra) => {
      prisma.branch.findFirst.mockResolvedValue({ id: 'b-77' });
      const req = makeReq({ id: 'u', tenantId: 't-1', branchId: undefined, ...extra }, 'b-77');
      await middleware.use(req, {} as any, next);
      expect(req.user.branchId).toBe('b-77');
      // Tenant + isActive constraints must be in the lookup itself (INV-9 shape).
      expect(prisma.branch.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'b-77', tenantId: 't-1', isActive: true }),
        }),
      );
    });

    it('a cross-tenant or inactive branch id is 403 even for SCHOOL_OWNER', async () => {
      prisma.branch.findFirst.mockResolvedValue(null);
      const req = makeReq({ id: 'u', tenantId: 't-1', role: 'SCHOOL_OWNER', branchIds: [] }, 'b-of-other-tenant');
      await expect(middleware.use(req, {} as any, next)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('no header + no default leaves branchId undefined -> services query tenant-wide', async () => {
      const req = makeReq({ id: 'u', tenantId: 't-1', role: 'SCHOOL_OWNER', branchIds: [], branchId: undefined });
      await middleware.use(req, {} as any, next);
      expect(req.user.branchId).toBeUndefined();
    });
  });
});
