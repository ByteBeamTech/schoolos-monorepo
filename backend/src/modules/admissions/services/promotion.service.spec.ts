// backend/src/modules/admissions/services/promotion.service.spec.ts
//
// PR-5B: no spec file existed for PromotionService before this PR. Narrow
// by design -- guards the entitlement-check wiring in approveAdmission()
// (a THIRD, independent admission -> student conversion path, separate
// from AdmissionsService.finalizeEnrollment -- see PR-5B commit notes),
// not full service coverage.

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { PromotionService } from './promotion.service';
import { PrismaService } from '@infra/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EntitlementResolver } from '@core/license/entitlement-resolver.service';

describe('PromotionService', () => {
  let service: PromotionService;

  const mockPrismaService = {
    admission: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockEmitter = {
    emit: jest.fn(),
  };

  const mockEntitlementResolver = {
    assertCanEnrollStudent: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromotionService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EventEmitter2, useValue: mockEmitter },
        { provide: EntitlementResolver, useValue: mockEntitlementResolver },
      ],
    }).compile();

    service = module.get<PromotionService>(PromotionService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('approveAdmission', () => {
    // PR-5B regression guard (3rd of 4 live student-creation paths).
    it('should reject admission approval when EntitlementResolver denies quota (Student limit reached)', async () => {
      mockPrismaService.admission.findFirst.mockResolvedValue({
        id: 'adm-1',
        tenantId: 't-1',
        status: 'PENDING',
      });
      mockEntitlementResolver.assertCanEnrollStudent.mockRejectedValueOnce(
        new ForbiddenException('Student limit reached (2/2). Please upgrade your plan.'),
      );

      await expect(
        service.approveAdmission('t-1', 'adm-1', {} as any, 'user-1'),
      ).rejects.toThrow(ForbiddenException);

      expect(mockEntitlementResolver.assertCanEnrollStudent).toHaveBeenCalledWith('t-1');
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should not call EntitlementResolver at all when the admission is already converted (existing pre-PR-5B behavior unchanged)', async () => {
      mockPrismaService.admission.findFirst.mockResolvedValue({
        id: 'adm-1',
        tenantId: 't-1',
        status: 'CONVERTED',
      });

      await expect(
        service.approveAdmission('t-1', 'adm-1', {} as any, 'user-1'),
      ).rejects.toThrow(BadRequestException);

      expect(mockEntitlementResolver.assertCanEnrollStudent).not.toHaveBeenCalled();
    });
  });
});
