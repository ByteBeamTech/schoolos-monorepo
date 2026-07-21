// FEE-0 (Security Hardening): tests for the guardian-link ownership resolver.
// Invariants exercised: AUTH-003 (parent ownership from persistent state),
// AUTH-004 (STUDENT denied by default), AUTH-041 (default-deny),
// AUTH-052 (SCHOOL_OWNER tenant-wide), AUTH-058 (SCHOOL_ADMIN restrictable),
// AUTH-047 (missing context fails closed).

import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { StudentBillingAccessService } from './student-billing-access.service';

const T = 't-1';

function user(role: string, branchIds: string[] = ['b-1']): any {
  return { id: 'u-1', tenantId: T, role, branchIds, branchId: branchIds[0], email: 'x@y.z', jti: 'j' };
}

describe('StudentBillingAccessService (FEE-0)', () => {
  let service: StudentBillingAccessService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      student: { findFirst: jest.fn() },
      guardianStudent: { findFirst: jest.fn(), findMany: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [
        StudentBillingAccessService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(StudentBillingAccessService);
  });

  describe('resolveAuthorizedBranchIds', () => {
    it('SCHOOL_OWNER is unconditionally tenant-wide, even with mappings (AUTH-052)', () => {
      expect(service.resolveAuthorizedBranchIds(user('SCHOOL_OWNER', ['b-1', 'b-2']))).toBeNull();
      expect(service.resolveAuthorizedBranchIds(user('SUPER_ADMIN', []))).toBeNull();
    });

    it('SCHOOL_ADMIN with no restrictions is tenant-wide by default (AUTH-058)', () => {
      expect(service.resolveAuthorizedBranchIds(user('SCHOOL_ADMIN', []))).toBeNull();
    });

    it('SCHOOL_ADMIN with UserBranch restrictions is limited to them (AUTH-058)', () => {
      expect(service.resolveAuthorizedBranchIds(user('SCHOOL_ADMIN', ['b-2']))).toEqual(['b-2']);
    });

    it('branch-scoped staff get exactly their mappings; none at all = empty set, fail closed (AUTH-047)', () => {
      expect(service.resolveAuthorizedBranchIds(user('ACCOUNTANT', ['b-1', 'b-3']))).toEqual(['b-1', 'b-3']);
      expect(service.resolveAuthorizedBranchIds(user('PRINCIPAL', []))).toEqual([]);
    });
  });

  describe('assertCanAccessStudent — staff', () => {
    it('allows staff when the student is inside their branch set', async () => {
      prisma.student.findFirst.mockResolvedValue({ id: 's-1', branchId: 'b-1' });
      await expect(
        service.assertCanAccessStudent(user('ACCOUNTANT', ['b-1']), 's-1'),
      ).resolves.toBeUndefined();
      // Tenant scoping must be in the query itself, not post-filtered.
      expect(prisma.student.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: T }) }),
      );
    });

    it('denies (as NotFound) staff when the student is in another branch', async () => {
      prisma.student.findFirst.mockResolvedValue({ id: 's-1', branchId: 'b-9' });
      await expect(
        service.assertCanAccessStudent(user('PRINCIPAL', ['b-1']), 's-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('denies (as NotFound) when the student does not exist in the tenant', async () => {
      prisma.student.findFirst.mockResolvedValue(null);
      await expect(
        service.assertCanAccessStudent(user('SCHOOL_ADMIN', []), 's-x'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('restricted SCHOOL_ADMIN cannot see outside its restriction; unrestricted can (AUTH-058 both paths)', async () => {
      prisma.student.findFirst.mockResolvedValue({ id: 's-1', branchId: 'b-2' });
      await expect(
        service.assertCanAccessStudent(user('SCHOOL_ADMIN', ['b-1']), 's-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.assertCanAccessStudent(user('SCHOOL_ADMIN', []), 's-1'),
      ).resolves.toBeUndefined();
    });

    it('SCHOOL_OWNER sees every branch (AUTH-052)', async () => {
      prisma.student.findFirst.mockResolvedValue({ id: 's-1', branchId: 'b-77' });
      await expect(
        service.assertCanAccessStudent(user('SCHOOL_OWNER', ['b-1']), 's-1'),
      ).resolves.toBeUndefined();
    });
  });

  describe('assertCanAccessStudent — PARENT (AUTH-003)', () => {
    it('allows a parent with an active guardian link, resolved from the DB', async () => {
      prisma.guardianStudent.findFirst.mockResolvedValue({ id: 'gs-1' });
      await expect(
        service.assertCanAccessStudent(user('PARENT'), 's-1'),
      ).resolves.toBeUndefined();
      expect(prisma.guardianStudent.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            studentId: 's-1',
            guardian: expect.objectContaining({
              tenantId: T,
              userId: 'u-1',
              isActive: true,
            }),
          }),
        }),
      );
    });

    it('denies (as NotFound) a parent with no link / a revoked (inactive) guardian', async () => {
      prisma.guardianStudent.findFirst.mockResolvedValue(null);
      await expect(
        service.assertCanAccessStudent(user('PARENT'), 's-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      // And never consults the staff path.
      expect(prisma.student.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('assertCanAccessStudent — default deny (AUTH-004 / AUTH-041)', () => {
    it.each(['STUDENT', 'TEACHER', 'LIBRARIAN', 'SOME_FUTURE_ROLE'])(
      '%s is denied with Forbidden and no DB lookup',
      async (role) => {
        await expect(
          service.assertCanAccessStudent(user(role), 's-1'),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(prisma.student.findFirst).not.toHaveBeenCalled();
        expect(prisma.guardianStudent.findFirst).not.toHaveBeenCalled();
      },
    );
  });

  describe('getParentStudentIds', () => {
    it('returns the deduplicated ids of actively-linked students for a PARENT', async () => {
      prisma.guardianStudent.findMany.mockResolvedValue([
        { studentId: 's-1' },
        { studentId: 's-2' },
        { studentId: 's-1' },
      ]);
      await expect(service.getParentStudentIds(user('PARENT'))).resolves.toEqual(['s-1', 's-2']);
    });

    it('returns [] for non-PARENT roles without touching the DB (not a grant path)', async () => {
      await expect(service.getParentStudentIds(user('ACCOUNTANT'))).resolves.toEqual([]);
      expect(prisma.guardianStudent.findMany).not.toHaveBeenCalled();
    });
  });
});
