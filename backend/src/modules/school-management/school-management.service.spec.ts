// backend/src/modules/school-management/school-management.service.spec.ts
//
// PR-5B: no spec file existed for SchoolManagementService before this PR.
// Narrow by design -- guards the branch-quota entitlement wiring in
// createBranch(), not full service coverage.

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, ConflictException } from '@nestjs/common';
import { SchoolManagementService } from './school-management.service';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '@core/compliance/audit.service';
import { EntitlementResolver } from '@core/license/entitlement-resolver.service';
import { DiscountCategoryProvisioningService } from '../student-billing/discounts/services/discount-category-provisioning.service';

describe('SchoolManagementService', () => {
  let service: SchoolManagementService;

  const mockPrismaService = {
    branch: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    // createBranch now creates the branch and provisions its default finance
    // configuration in one transaction. The mock hands the callback this same
    // object as its tx client, so branch.create assertions still hold.
    $transaction: jest.fn((cb: any) => cb(mockPrismaService)),
  };

  const mockAuditService = {
    logCreate: jest.fn(),
    logUpdate: jest.fn(),
  };

  const mockEntitlementResolver = {
    assertCanCreateBranch: jest.fn().mockResolvedValue(undefined),
  };

  const mockDiscountCategoryProvisioning = {
    provisionForBranch: jest.fn().mockResolvedValue({ created: 6, skipped: 0 }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchoolManagementService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: EntitlementResolver, useValue: mockEntitlementResolver },
        { provide: DiscountCategoryProvisioningService, useValue: mockDiscountCategoryProvisioning },
      ],
    }).compile();

    service = module.get<SchoolManagementService>(SchoolManagementService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createBranch', () => {
    // PR-5B regression guard: branch quota.
    it('should reject branch creation when EntitlementResolver denies quota (Branch limit reached)', async () => {
      mockEntitlementResolver.assertCanCreateBranch.mockRejectedValueOnce(
        new ForbiddenException('Branch limit reached (1/1). Please upgrade your plan.'),
      );

      await expect(
        service.createBranch('t-1', { name: 'Second Campus' } as any, 'actor-1'),
      ).rejects.toThrow(ForbiddenException);

      expect(mockEntitlementResolver.assertCanCreateBranch).toHaveBeenCalledWith('t-1');
      // The entitlement check runs before the duplicate-name lookup --
      // if this is ever called, the check moved after some DB work.
      expect(mockPrismaService.branch.findFirst).not.toHaveBeenCalled();
      expect(mockPrismaService.branch.create).not.toHaveBeenCalled();
    });

    it('should allow branch creation to proceed to the duplicate-name check when EntitlementResolver allows it', async () => {
      mockPrismaService.branch.findFirst.mockResolvedValue(null);
      mockPrismaService.branch.create.mockResolvedValue({ id: 'br-2', name: 'Second Campus' });

      const result = await service.createBranch('t-1', { name: 'Second Campus' } as any, 'actor-1');

      expect(mockEntitlementResolver.assertCanCreateBranch).toHaveBeenCalledWith('t-1');
      expect(result).toBeDefined();
    });

    // FEE-1: a branch must never exist without its default discount
    // categories -- DiscountService.create() resolves against them and
    // refuses to create them on demand.
    it('should provision default discount categories for the new branch, inside the transaction', async () => {
      mockPrismaService.branch.findFirst.mockResolvedValue(null);
      mockPrismaService.branch.create.mockResolvedValue({ id: 'br-2', name: 'Second Campus' });

      await service.createBranch('t-1', { name: 'Second Campus' } as any, 'actor-1');

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(mockDiscountCategoryProvisioning.provisionForBranch).toHaveBeenCalledWith(
        mockPrismaService, // the tx client, not a separate connection
        't-1',
        'br-2',
      );
    });

    it('should roll the branch back when category provisioning fails', async () => {
      mockPrismaService.branch.findFirst.mockResolvedValue(null);
      mockPrismaService.branch.create.mockResolvedValue({ id: 'br-3', name: 'Third Campus' });
      mockDiscountCategoryProvisioning.provisionForBranch.mockRejectedValueOnce(
        new Error('provisioning failed'),
      );

      await expect(
        service.createBranch('t-1', { name: 'Third Campus' } as any, 'actor-1'),
      ).rejects.toThrow('provisioning failed');

      // The error escapes the $transaction callback, so Prisma rolls back the
      // branch insert; the audit row must not be written for a rolled-back branch.
      expect(mockAuditService.logCreate).not.toHaveBeenCalled();
    });
  });
});
