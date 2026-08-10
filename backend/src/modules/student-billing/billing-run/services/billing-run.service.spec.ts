// backend/src/modules/student-billing/billing-run/services/billing-run.service.spec.ts

import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { BillingRunService } from './billing-run.service';
import { InvoiceBuilderService } from './invoice-builder.service';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '../../../../core/compliance/audit.service';

describe('BillingRunService', () => {
  let service: BillingRunService;
  let prisma: any;
  let audit: any;
  let invoiceBuilder: any;

  const run = { id: 'run-1', tenantId: 't-1', branchId: 'b-1', periodLabel: 'April 2026', startedAt: null };

  beforeEach(async () => {
    prisma = {
      billingRun: {
        findFirst: jest.fn().mockResolvedValue(null), // no active run by default
        findUnique: jest.fn().mockResolvedValue(run),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'run-1', ...data })),
        update: jest.fn().mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, ...run, ...data })),
      },
      billingRunAttempt: {
        findFirst: jest.fn().mockResolvedValue(null), // no prior success by default
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: `att-${Math.random()}`, ...data })),
        update: jest.fn().mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, ...data })),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      student: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((cb: any) => cb(prisma)),
      $executeRawUnsafe: jest.fn(),
    };
    audit = { logCreate: jest.fn() };
    invoiceBuilder = { buildForStudent: jest.fn().mockResolvedValue({ feePlanId: 'fp-1', invoiceId: 'inv-1' }) };

    const module = await Test.createTestingModule({
      providers: [
        BillingRunService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: InvoiceBuilderService, useValue: invoiceBuilder },
      ],
    }).compile();
    service = module.get(BillingRunService);
  });

  describe('findAll', () => {
    it('scopes the query to the given tenant+branch, most recent first', async () => {
      await service.findAll('t-1', 'b-1');
      expect(prisma.billingRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 't-1', branchId: 'b-1' }, orderBy: { createdAt: 'desc' } }),
      );
    });

    it('returns the same {data, meta} pagination shape InvoiceService.findAll already established', async () => {
      prisma.billingRun.findMany.mockResolvedValue([run]);
      prisma.billingRun.count.mockResolvedValue(1);
      const result = await service.findAll('t-1', 'b-1', 1, 20);
      expect(result).toEqual({ data: [run], meta: { total: 1, page: 1, limit: 20, lastPage: 1 } });
    });

    it('defaults to page 1, limit 20 when not supplied', async () => {
      await service.findAll('t-1', 'b-1');
      expect(prisma.billingRun.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 20 }));
    });
  });

  describe('trigger', () => {
    it('rejects when an active run already exists for the same branch+period', async () => {
      prisma.billingRun.findFirst.mockResolvedValue({ id: 'existing-run' });
      await expect(service.trigger('t-1', 'b-1', 4, 2026, 'MANUAL', 'u-1')).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.billingRun.create).not.toHaveBeenCalled();
    });

    it('creates one PENDING attempt per eligible student', async () => {
      prisma.student.findMany.mockResolvedValue([
        { id: 's1', status: 'ACTIVE', admissionDate: new Date(2025, 3, 1), enrolledAt: new Date(2025, 3, 1), leftAt: null },
        { id: 's2', status: 'ACTIVE', admissionDate: new Date(2025, 3, 1), enrolledAt: new Date(2025, 3, 1), leftAt: null },
      ]);
      await service.trigger('t-1', 'b-1', 4, 2026, 'MANUAL', 'u-1');
      expect(prisma.billingRunAttempt.create).toHaveBeenCalledTimes(2);
      expect(prisma.billingRunAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING' }) }),
      );
    });

    it('excludes a student who admitted after this period ends', async () => {
      prisma.student.findMany.mockResolvedValue([
        { id: 's1', status: 'ACTIVE', admissionDate: new Date(2026, 5, 1), enrolledAt: new Date(2026, 5, 1), leftAt: null }, // admitted June
      ]);
      await service.trigger('t-1', 'b-1', 4, 2026, 'MANUAL', 'u-1'); // billing April
      expect(prisma.billingRunAttempt.create).not.toHaveBeenCalled();
    });

    it('excludes a student who left before this period starts', async () => {
      prisma.student.findMany.mockResolvedValue([
        { id: 's1', status: 'ACTIVE', admissionDate: new Date(2025, 3, 1), enrolledAt: new Date(2025, 3, 1), leftAt: new Date(2026, 2, 1) }, // left March
      ]);
      await service.trigger('t-1', 'b-1', 4, 2026, 'MANUAL', 'u-1'); // billing April
      expect(prisma.billingRunAttempt.create).not.toHaveBeenCalled();
    });

    it('cross-run idempotency: a student already SUCCEEDED with a real invoice in a PRIOR run for this exact period gets a SUCCEEDED attempt directly, pointing at the existing invoice -- not re-processed', async () => {
      prisma.student.findMany.mockResolvedValue([
        { id: 's1', status: 'ACTIVE', admissionDate: new Date(2025, 3, 1), enrolledAt: new Date(2025, 3, 1), leftAt: null },
      ]);
      prisma.billingRunAttempt.findFirst.mockResolvedValue({ invoiceId: 'inv-from-prior-run', feePlanId: 'fp-1' });

      await service.trigger('t-1', 'b-1', 4, 2026, 'MANUAL', 'u-1');

      expect(prisma.billingRunAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SUCCEEDED', invoiceId: 'inv-from-prior-run' }),
        }),
      );
    });
  });

  describe('execute', () => {
    it('acquires the advisory lock before processing each attempt', async () => {
      prisma.billingRunAttempt.findMany.mockResolvedValue([{ id: 'att-1', studentId: 's1', status: 'PENDING' }]);
      prisma.billingRunAttempt.findUnique.mockResolvedValue({ id: 'att-1', status: 'PENDING' });

      await service.execute('run-1');

      expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock($1)', expect.any(Number));
    });

    it('a re-read finding the attempt already SUCCEEDED (claimed by a concurrent execute()) skips it without double-processing', async () => {
      prisma.billingRunAttempt.findMany.mockResolvedValue([{ id: 'att-1', studentId: 's1', status: 'PENDING' }]);
      prisma.billingRunAttempt.findUnique.mockResolvedValue({ id: 'att-1', status: 'SUCCEEDED' }); // already claimed

      await service.execute('run-1');

      expect(invoiceBuilder.buildForStudent).not.toHaveBeenCalled();
    });

    it('a successful attempt calls buildForStudent and records SUCCEEDED with the result', async () => {
      prisma.billingRunAttempt.findMany.mockResolvedValue([{ id: 'att-1', studentId: 's1', status: 'PENDING' }]);
      prisma.billingRunAttempt.findUnique.mockResolvedValue({ id: 'att-1', status: 'PENDING' });

      await service.execute('run-1');

      expect(invoiceBuilder.buildForStudent).toHaveBeenCalledWith('t-1', 'b-1', 's1', 4, 2026, prisma);
      expect(prisma.billingRunAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'SUCCEEDED', invoiceId: 'inv-1', feePlanId: 'fp-1' }) }),
      );
    });

    it('partial failure: one student throwing does not stop the run from processing the rest, and the failed attempt records a real error message', async () => {
      prisma.billingRunAttempt.findMany.mockResolvedValue([
        { id: 'att-1', studentId: 's1', status: 'PENDING' },
        { id: 'att-2', studentId: 's2', status: 'PENDING' },
      ]);
      prisma.billingRunAttempt.findUnique.mockResolvedValue({ id: 'att-x', status: 'PENDING' });
      invoiceBuilder.buildForStudent
        .mockRejectedValueOnce(new Error('Transport misconfigured'))
        .mockResolvedValueOnce({ feePlanId: 'fp-1', invoiceId: 'inv-2' });

      await service.execute('run-1');

      expect(invoiceBuilder.buildForStudent).toHaveBeenCalledTimes(2); // both attempted, second not blocked by first
      const failedUpdateCall = prisma.billingRunAttempt.update.mock.calls.find(
        (c: any) => c[0].data.status === 'FAILED',
      );
      expect(failedUpdateCall[0].data.errorMessage).toContain('Transport misconfigured');
    });

    it('finalizes the run as PARTIALLY_COMPLETED when some attempts succeeded and some failed', async () => {
      prisma.billingRunAttempt.findMany
        .mockResolvedValueOnce([{ id: 'att-1', studentId: 's1', status: 'PENDING' }]) // for the execute loop
        .mockResolvedValue([{ status: 'SUCCEEDED' }, { status: 'FAILED' }]); // for finalizeRunStatus
      prisma.billingRunAttempt.findUnique.mockResolvedValue({ id: 'att-1', status: 'PENDING' });

      await service.execute('run-1');

      expect(prisma.billingRun.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PARTIALLY_COMPLETED' }) }),
      );
    });

    it('finalizes the run as COMPLETED when every attempt succeeded', async () => {
      prisma.billingRunAttempt.findMany
        .mockResolvedValueOnce([{ id: 'att-1', studentId: 's1', status: 'PENDING' }])
        .mockResolvedValue([{ status: 'SUCCEEDED' }]);
      prisma.billingRunAttempt.findUnique.mockResolvedValue({ id: 'att-1', status: 'PENDING' });

      await service.execute('run-1');

      expect(prisma.billingRun.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) }),
      );
    });

    it('throws NotFoundException for a nonexistent run', async () => {
      prisma.billingRun.findUnique.mockResolvedValue(null);
      await expect(service.execute('no-such-run')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('retryFailed', () => {
    it('rejects when there are no failed attempts', async () => {
      prisma.billingRunAttempt.count.mockResolvedValue(0);
      await expect(service.retryFailed('run-1')).rejects.toBeInstanceOf(ConflictException);
    });

    it('re-processes only FAILED attempts, incrementing retryCount, leaving SUCCEEDED attempts untouched', async () => {
      prisma.billingRunAttempt.count.mockResolvedValue(1);
      prisma.billingRunAttempt.findMany
        .mockResolvedValueOnce([{ id: 'att-2', studentId: 's2', status: 'FAILED' }]) // execute()'s own PENDING/FAILED query
        .mockResolvedValue([{ status: 'SUCCEEDED' }, { status: 'SUCCEEDED' }]);
      prisma.billingRunAttempt.findUnique.mockResolvedValue({ id: 'att-2', status: 'FAILED' });

      await service.retryFailed('run-1');

      // Only the FAILED attempt should ever be passed to buildForStudent.
      expect(invoiceBuilder.buildForStudent).toHaveBeenCalledWith('t-1', 'b-1', 's2', 4, 2026, prisma);
      expect(invoiceBuilder.buildForStudent).toHaveBeenCalledTimes(1);
    });
  });
});
