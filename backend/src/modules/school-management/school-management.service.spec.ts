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

describe('SchoolManagementService', () => {
  let service: SchoolManagementService;

  const mockPrismaService = {
    branch: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockAuditService = {
    logCreate: jest.fn(),
    logUpdate: jest.fn(),
  };

  const mockEntitlementResolver = {
    assertCanCreateBranch: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchoolManagementService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: EntitlementResolver, useValue: mockEntitlementResolver },
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
  });
});
