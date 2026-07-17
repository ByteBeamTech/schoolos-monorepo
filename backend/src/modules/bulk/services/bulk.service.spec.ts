// backend/src/modules/bulk/services/bulk.service.spec.ts
//
// PR-5B: no spec file existed for BulkService before this PR. Narrow by
// design -- this specifically guards the ATOMICITY property that matters
// most for bulk import: when the pre-flight capacity check
// (assertCanEnrollStudents) rejects, ZERO rows must be written
// (student.createMany must never be called), not a partial import. This
// is the property that would silently break if a future refactor moved
// the capacity check to inside the per-chunk loop instead of before it.

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { BulkService } from './bulk.service';
import { PrismaService } from '@infra/database/prisma.service';
import { InvoiceService } from '../../student-billing/invoice/services/invoice.service';
import { ClsService } from 'nestjs-cls';
import { EntitlementResolver } from '@core/license/entitlement-resolver.service';

describe('BulkService', () => {
  let service: BulkService;

  const mockPrismaService = {
    section: { findMany: jest.fn().mockResolvedValue([]) },
    student: {
      findMany: jest.fn().mockResolvedValue([]), // no pre-existing admission numbers
      createMany: jest.fn(),
    },
    $queryRawUnsafe: jest.fn().mockResolvedValue([{ acquired: true }]), // advisory lock acquired
    $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),          // advisory unlock
  };

  const mockInvoiceService = {};

  const mockClsService = {
    get: jest.fn().mockReturnValue('trace-test'),
    set: jest.fn(),
  };

  const mockEntitlementResolver = {
    assertCanEnrollStudents: jest.fn().mockResolvedValue(undefined),
  };

  const validRow = (admissionNumber: string) => ({
    firstName: 'Test',
    lastName: 'Student',
    admissionNumber,
    branchId: 'br-1',
    classId: 'cl-1',
    academicYear: '2025-26',
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BulkService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: InvoiceService, useValue: mockInvoiceService },
        { provide: ClsService, useValue: mockClsService },
        { provide: EntitlementResolver, useValue: mockEntitlementResolver },
      ],
    }).compile();

    service = module.get<BulkService>(BulkService);
    // onModuleInit() checks a real DB index via $queryRaw -- not relevant
    // to this test's scope, so the flag it sets is set directly instead
    // of invoking the lifecycle hook against a mocked query result shape.
    (service as any).hasUniqueIndex = true;

    jest.clearAllMocks();
    mockPrismaService.section.findMany.mockResolvedValue([]);
    mockPrismaService.student.findMany.mockResolvedValue([]);
    mockPrismaService.$queryRawUnsafe.mockResolvedValue([{ acquired: true }]);
    mockPrismaService.$executeRawUnsafe.mockResolvedValue(undefined);
    mockEntitlementResolver.assertCanEnrollStudents.mockResolvedValue(undefined);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('importStudents', () => {
    // PR-5B regression guard (4th of 4 live student-creation paths) --
    // the atomicity property specifically.
    it('should reject the ENTIRE batch and write ZERO rows when EntitlementResolver denies quota', async () => {
      mockEntitlementResolver.assertCanEnrollStudents.mockRejectedValueOnce(
        new ForbiddenException(
          'This would push student count to 5, exceeding the licensed limit of 2 (grace ceiling 2). ' +
          'Please upgrade your plan or reduce the import size.',
        ),
      );

      const rows = [validRow('ADM-1'), validRow('ADM-2'), validRow('ADM-3')];

      await expect(service.importStudents('t-1', rows as any)).rejects.toThrow(ForbiddenException);

      expect(mockEntitlementResolver.assertCanEnrollStudents).toHaveBeenCalledWith('t-1', 3);
      // The critical assertion: not "fewer rows than requested", not
      // "some succeeded" -- literally zero writes attempted.
      expect(mockPrismaService.student.createMany).not.toHaveBeenCalled();
    });

    it('should check capacity against the post-dedup row count, not the raw row count', async () => {
      // Two rows share an admission number already in the DB -- only 1 of
      // 3 rows should actually reach the capacity check.
      mockPrismaService.student.findMany.mockResolvedValue([{ admissionNumber: 'ADM-1' }]);

      const rows = [validRow('ADM-1'), validRow('ADM-1'), validRow('ADM-2')];
      mockPrismaService.student.createMany.mockResolvedValue({ count: 1 });

      await service.importStudents('t-1', rows as any);

      // ADM-1 duplicated in-file (deduped to 1) + already exists in DB
      // (dropped) -- only ADM-2 should remain, so the capacity check must
      // be called with 1, not 3 and not 2.
      expect(mockEntitlementResolver.assertCanEnrollStudents).toHaveBeenCalledWith('t-1', 1);
    });

    it('should proceed to createMany when EntitlementResolver allows the batch', async () => {
      mockPrismaService.student.createMany.mockResolvedValue({ count: 2 });

      const rows = [validRow('ADM-1'), validRow('ADM-2')];
      const result = await service.importStudents('t-1', rows as any);

      expect(mockEntitlementResolver.assertCanEnrollStudents).toHaveBeenCalledWith('t-1', 2);
      expect(mockPrismaService.student.createMany).toHaveBeenCalled();
      expect(result.created).toBe(2);
    });
  });
});
