// backend/src/modules/admissions/services/admissions.service.spec.ts
//
// PR-5B: no spec file existed for AdmissionsService before this PR. This
// file is deliberately narrow -- it exists to guard the entitlement-check
// wiring in finalizeEnrollment(), not to provide full service coverage
// (that's a separate, larger effort out of PR-5B's scope). If a future
// refactor moves or removes the assertCanEnrollStudent() call, this test
// fails.

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { AdmissionsService } from './admissions.service';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '../../../core/compliance/audit.service';
import { EntitlementResolver } from '@core/license/entitlement-resolver.service';

describe('AdmissionsService', () => {
  let service: AdmissionsService;

  const mockPrismaService = {
    $transaction: jest.fn(),
  };

  const mockAuditService = {
    logCreate: jest.fn(),
    logUpdate: jest.fn(),
  };

  const mockEntitlementResolver = {
    assertCanEnrollStudent: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdmissionsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: EntitlementResolver, useValue: mockEntitlementResolver },
      ],
    }).compile();

    service = module.get<AdmissionsService>(AdmissionsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('finalizeEnrollment', () => {
    // PR-5B regression guard (2nd of 4 live student-creation paths).
    it('should reject enrollment finalization when EntitlementResolver denies quota (Student limit reached)', async () => {
      mockEntitlementResolver.assertCanEnrollStudent.mockRejectedValueOnce(
        new ForbiddenException('Student limit reached (2/2). Please upgrade your plan.'),
      );

      await expect(
        service.finalizeEnrollment('t-1', 'br-1', 'app-1', 'ROLL-001', 'actor-1'),
      ).rejects.toThrow(ForbiddenException);

      expect(mockEntitlementResolver.assertCanEnrollStudent).toHaveBeenCalledWith('t-1');
      // The entitlement check runs BEFORE the transaction opens (see
      // finalizeEnrollment's implementation) -- if this is ever called,
      // it means the check got moved after some DB work, which is itself
      // a regression worth catching even though the transaction internals
      // aren't otherwise exercised by this narrow test.
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });
  });
});
