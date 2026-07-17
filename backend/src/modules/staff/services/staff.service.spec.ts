// backend/src/modules/staff/services/staff.service.spec.ts
//
// PR-5G: no spec file existed for StaffService before this PR. Narrow by
// design -- guards the staff-quota entitlement wiring in create(), not
// full service coverage.

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { StaffService } from './staff.service';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '../../../core/compliance/audit.service';
import { EntitlementResolver } from '@core/license/entitlement-resolver.service';

describe('StaffService', () => {
  let service: StaffService;

  const mockPrismaService = {
    staff: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
  };

  const mockAuditService = {
    logCreate: jest.fn(),
    logUpdate: jest.fn(),
  };

  const mockEntitlementResolver = {
    assertCanAddStaff: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: EntitlementResolver, useValue: mockEntitlementResolver },
      ],
    }).compile();

    service = module.get<StaffService>(StaffService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    // PR-5G regression guard: staff quota.
    it('should reject staff creation when EntitlementResolver denies quota (Staff limit reached)', async () => {
      mockEntitlementResolver.assertCanAddStaff.mockRejectedValueOnce(
        new ForbiddenException('Staff limit reached (20/20). Please upgrade your plan.'),
      );

      await expect(
        service.create('t-1', { employeeId: 'EMP-1', userId: 'u-1' } as any, 'actor-1'),
      ).rejects.toThrow(ForbiddenException);

      expect(mockEntitlementResolver.assertCanAddStaff).toHaveBeenCalledWith('t-1');
      // The entitlement check runs before the duplicate-employeeId lookup --
      // if this is ever called, the check moved after some DB work.
      expect(mockPrismaService.staff.findFirst).not.toHaveBeenCalled();
      expect(mockPrismaService.staff.create).not.toHaveBeenCalled();
    });

    it('should proceed to the duplicate-employeeId check when EntitlementResolver allows it', async () => {
      mockPrismaService.staff.findFirst.mockResolvedValue({ id: 'existing-staff' });

      await expect(
        service.create('t-1', { employeeId: 'EMP-1', userId: 'u-1' } as any, 'actor-1'),
      ).rejects.toThrow('Employee ID "EMP-1" already exists.');

      expect(mockEntitlementResolver.assertCanAddStaff).toHaveBeenCalledWith('t-1');
      expect(mockPrismaService.staff.findFirst).toHaveBeenCalled();
    });
  });
});
