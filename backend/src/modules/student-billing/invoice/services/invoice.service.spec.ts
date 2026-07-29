import { Test, TestingModule }  from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InvoiceService }  from './invoice.service';
import { OVERDUE_STATUS_MATCH } from '../overdue.util';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService }    from '../../../../core/compliance/audit.service';
import { EventEmitter2 }   from '@nestjs/event-emitter';

const mockFeePlan = {
  id: 'plan-1', tenantId: 't-1', name: 'Annual Fee', academicYear: '2025-26',
  currency: 'INR', feeItems: [
    { id: 'item-1', name: 'Tuition', amount: 10000, gstRate: 0, gstCode: null, isOptional: false, sortOrder: 1 },
    { id: 'item-2', name: 'Activity', amount: 2000, gstRate: 18, gstCode: 'GST18', isOptional: false, sortOrder: 2 },
  ],
};

const mockStudent = { id: 'stu-1', tenantId: 't-1', branchId: 'b-1', firstName: 'Aarav', lastName: 'Shah', admissionNumber: 'ADM001' };

describe('InvoiceService', () => {
  let service: InvoiceService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        {
          provide: PrismaService,
          useValue: {
            feePlan: { findFirst: jest.fn().mockResolvedValue(mockFeePlan) },
            student: { findFirst: jest.fn().mockResolvedValue(mockStudent) },
            // PR-2.5 (test infra cleanup): both were entirely missing.
            // InvoiceService.generate() calls transportAssignment.findFirst()
            // and discount.findMany() unconditionally, before invoice.create()
            // -- see invoice.service.ts. Defaulted to "none" (no transport
            // assignment, no approved discounts) so the GST math the tests
            // assert on (12000 subtotal / 360 gst / 12360 total) stays exactly
            // as originally intended, unaffected by these additions.
            transportAssignment: { findFirst: jest.fn().mockResolvedValue(null) },
            discount: { findMany: jest.fn().mockResolvedValue([]) },
            invoice: {
              count:  jest.fn().mockResolvedValue(0),
              create: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
              aggregate: jest.fn(),
              update: jest.fn(),
            },
            $transaction: jest.fn().mockImplementation(async (fn) => fn({
              $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
              invoice: { count: jest.fn().mockResolvedValue(0) },
              invoiceSequence: { upsert: jest.fn().mockResolvedValue({ lastNumber: 1 }) },
            })),
          },
        },
        { provide: AuditService,  useValue: { logCreate: jest.fn(), logUpdate: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<InvoiceService>(InvoiceService);
    prisma  = module.get(PrismaService);
  });

  // TEST 6
  it('generates correct invoice with GST calculation', async () => {
    (prisma.invoice.create as jest.Mock).mockResolvedValue({
      id: 'inv-1', invoiceNumber: 'INV-2025-00001',
      totalAmount: 12360, subtotal: 12000, gstAmount: 360,
    });

    const result = await service.generate('t-1', {
      studentId: 'stu-1', feePlanId: 'plan-1',
      dueDate: '2025-04-30',
    }, 'actor-1');

    // Verify GST: 2000 * 18% = 360. Money fields are now Prisma.Decimal
    // (D-9), so assert on their exact decimal value rather than a JS number.
    const createArg = (prisma.invoice.create as jest.Mock).mock.calls.at(-1)[0];
    expect(createArg.data.gstAmount.toString()).toBe('360');
    expect(createArg.data.totalAmount.toString()).toBe('12360');
    expect(createArg.data.subtotal.toString()).toBe('12000');
    // Per-item GST is exact to the paise: activity 2000 * 18% = 360.00.
    const activityItem = createArg.data.items.create.find((i: any) => i.name === 'Activity');
    expect(activityItem.gstAmount.toString()).toBe('360');
    expect(activityItem.netAmount.toString()).toBe('2360');
  });

  // D-9: GST rounding must be exact-to-the-paise. amount 100 * 8.325% = 8.325,
  // which round-half-up must make 8.33. The old float path did
  // Math.round(8.325*100)/100 and got 8.32, because 8.325 is stored as
  // 8.32499...; Prisma.Decimal.toDecimalPlaces(2) rounds it correctly.
  it('rounds percentage GST correctly where binary float misrounds (D-9)', async () => {
    (prisma.feePlan.findFirst as jest.Mock).mockResolvedValue({
      ...mockFeePlan,
      feeItems: [{ id: 'x', name: 'X', amount: 100, gstRate: 8.325, gstCode: 'G', isOptional: false, sortOrder: 1 }],
    });
    (prisma.invoice.create as jest.Mock).mockResolvedValue({ id: 'inv-1', invoiceNumber: 'INV-2025-00001' });

    await service.generate('t-1', { studentId: 'stu-1', feePlanId: 'plan-1', dueDate: '2025-04-30' }, 'actor-1');

    const createArg = (prisma.invoice.create as jest.Mock).mock.calls.at(-1)[0];
    const item = createArg.data.items.create[0];
    expect(item.gstAmount.toString()).toBe('8.33');     // NOT 8.32
    expect(item.netAmount.toString()).toBe('108.33');
    expect(createArg.data.gstAmount.toString()).toBe('8.33');
    expect(createArg.data.totalAmount.toString()).toBe('108.33');
  });

  // TEST 7
  it('uses advisory lock for invoice number (calls $executeRawUnsafe)', async () => {
    (prisma.invoice.create as jest.Mock).mockResolvedValue({ id: 'inv-1', invoiceNumber: 'INV-2025-00001', totalAmount: 10000 });
    await service.generate('t-1', { studentId: 'stu-1', feePlanId: 'plan-1', dueDate: '2025-04-30' }, 'actor-1');
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  // TEST 8
  it('generates the invoice number from InvoiceSequence.upsert, scoped by tenant+branch+financial year', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-15T00:00:00Z')); // FY 2026
    const upsert = jest.fn().mockResolvedValue({ lastNumber: 5 });
    const mockTx = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
      invoiceSequence: { upsert },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => fn(mockTx));
    (prisma.invoice.create as jest.Mock).mockImplementation(({ data }) =>
      Promise.resolve({ id: 'inv-5', invoiceNumber: data.invoiceNumber, totalAmount: 10000 }),
    );

    await service.generate('t-1', { studentId: 'stu-1', feePlanId: 'plan-1', dueDate: '2025-04-30' }, 'actor-1');

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where:  { tenantId_branchId_year: { tenantId: 't-1', branchId: 'b-1', year: 2026 } },
      create: { tenantId: 't-1', branchId: 'b-1', year: 2026, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    }));
    const callArg = (prisma.invoice.create as jest.Mock).mock.calls[0][0];
    expect(callArg.data.invoiceNumber).toBe('INV-2026-00005');
    jest.useRealTimers();
  });

  it('derives the financial year from the FY boundary (1 April), not the calendar year', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2027-01-15T00:00:00Z')); // calendar 2027, FY 2026
    const upsert = jest.fn().mockResolvedValue({ lastNumber: 1 });
    const mockTx = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
      invoiceSequence: { upsert },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => fn(mockTx));
    (prisma.invoice.create as jest.Mock).mockImplementation(({ data }) =>
      Promise.resolve({ id: 'inv-1', invoiceNumber: data.invoiceNumber, totalAmount: 10000 }),
    );

    await service.generate('t-1', { studentId: 'stu-1', feePlanId: 'plan-1', dueDate: '2025-04-30' }, 'actor-1');

    const callArg = (prisma.invoice.create as jest.Mock).mock.calls[0][0];
    expect(callArg.data.invoiceNumber).toBe('INV-2026-00001'); // NOT INV-2027-...
    jest.useRealTimers();
  });

  describe('generateReceiptNumber', () => {
    it('is scoped by tenant+branch+financial year via ReceiptSequence.upsert, using an injected transaction client', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-06-15T00:00:00Z')); // FY 2026
      const upsert = jest.fn().mockResolvedValue({ lastNumber: 3 });
      const tx = { $executeRawUnsafe: jest.fn().mockResolvedValue(undefined), receiptSequence: { upsert } };

      const number = await service.generateReceiptNumber('t-1', 'b-1', tx);

      expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
        where:  { tenantId_branchId_year: { tenantId: 't-1', branchId: 'b-1', year: 2026 } },
        create: { tenantId: 't-1', branchId: 'b-1', year: 2026, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } },
      }));
      expect(number).toBe('RCP-2026-00003');
      jest.useRealTimers();
    });

    it('opens its own transaction when no client is injected', async () => {
      const upsert = jest.fn().mockResolvedValue({ lastNumber: 1 });
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) =>
        fn({ $executeRawUnsafe: jest.fn().mockResolvedValue(undefined), receiptSequence: { upsert } }),
      );

      await service.generateReceiptNumber('t-1', 'b-1');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(upsert).toHaveBeenCalledTimes(1);
    });

    it('uses a different advisory lock key range from invoice numbering (no unnecessary cross-serialization)', async () => {
      const executeRawUnsafe = jest.fn().mockResolvedValue(undefined);
      const tx = { $executeRawUnsafe: executeRawUnsafe, receiptSequence: { upsert: jest.fn().mockResolvedValue({ lastNumber: 1 }) } };

      await service.generateReceiptNumber('t-1', 'b-1', tx);
      const receiptLockKey = executeRawUnsafe.mock.calls[0][1];

      const invTx = { $executeRawUnsafe: jest.fn().mockResolvedValue(undefined), invoiceSequence: { upsert: jest.fn().mockResolvedValue({ lastNumber: 1 }) } };
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => fn(invTx));
      (prisma.invoice.create as jest.Mock).mockImplementation(({ data }) => Promise.resolve({ id: 'inv-1', invoiceNumber: data.invoiceNumber, totalAmount: 10000 }));
      await service.generate('t-1', { studentId: 'stu-1', feePlanId: 'plan-1', dueDate: '2025-04-30' }, 'actor-1');
      const invoiceLockKey = invTx.$executeRawUnsafe.mock.calls[0][1];

      expect(receiptLockKey).not.toBe(invoiceLockKey);
    });
  });

  // TEST 9
  it('throws NotFoundException for unknown fee plan', async () => {
    (prisma.feePlan.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(
      service.generate('t-1', { studentId: 'stu-1', feePlanId: 'unknown', dueDate: '2025-04-30' }, 'actor-1'),
    ).rejects.toThrow(NotFoundException);
  });

  // TEST 10
  it('throws BadRequestException for fee plan with no items', async () => {
    (prisma.feePlan.findFirst as jest.Mock).mockResolvedValue({ ...mockFeePlan, feeItems: [] });
    await expect(
      service.generate('t-1', { studentId: 'stu-1', feePlanId: 'plan-1', dueDate: '2025-04-30' }, 'actor-1'),
    ).rejects.toThrow(BadRequestException);
  });

  // TEST 11
  it('emits INVOICE_GENERATED event after successful creation', async () => {
    const emitter = { emit: jest.fn() };
    (prisma.invoice.create as jest.Mock).mockResolvedValue({ id: 'inv-1', invoiceNumber: 'INV-2025-00001', totalAmount: 12360 });
    // Re-create service with our emitter mock
    const mod = await Test.createTestingModule({
      providers: [
        InvoiceService,
        { provide: PrismaService, useValue: { feePlan: { findFirst: jest.fn().mockResolvedValue(mockFeePlan) }, student: { findFirst: jest.fn().mockResolvedValue(mockStudent) }, transportAssignment: { findFirst: jest.fn().mockResolvedValue(null) }, discount: { findMany: jest.fn().mockResolvedValue([]) }, invoice: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue({ id: 'inv-1', invoiceNumber: 'INV-2025-00001', totalAmount: 12360 }) }, $transaction: jest.fn().mockImplementation(async (fn) => fn({ $executeRawUnsafe: jest.fn(), invoiceSequence: { upsert: jest.fn().mockResolvedValue({ lastNumber: 1 }) } })) } },
        { provide: AuditService, useValue: { logCreate: jest.fn() } },
        { provide: EventEmitter2, useValue: emitter },
      ],
    }).compile();
    const svc = mod.get<InvoiceService>(InvoiceService);
    await svc.generate('t-1', { studentId: 'stu-1', feePlanId: 'plan-1', dueDate: '2025-04-30' }, 'actor-1');
    expect(emitter.emit).toHaveBeenCalledWith('invoice.generated', expect.any(Object));
  });

  // ── P0: getStats() branch scoping + collectedAmount fix ──────────────────
  describe('getStats', () => {
    it('passes tenantId-only filters through when authorizedBranchIds is omitted (backward compatible)', async () => {
      (prisma.invoice.aggregate as jest.Mock).mockResolvedValue({ _sum: { totalAmount: 0, paidAmount: 0 }, _count: 0 });
      (prisma.invoice.count as jest.Mock).mockResolvedValue(0);

      await service.getStats('t-1');

      const aggCall = (prisma.invoice.aggregate as jest.Mock).mock.calls[0][0];
      expect(aggCall.where).toEqual({ tenantId: 't-1' });
    });

    it('scopes every query to the caller\'s authorized branches when restricted', async () => {
      (prisma.invoice.aggregate as jest.Mock).mockResolvedValue({ _sum: { totalAmount: 0, paidAmount: 0 }, _count: 0 });
      (prisma.invoice.count as jest.Mock).mockResolvedValue(0);

      await service.getStats('t-1', undefined, ['b-1', 'b-2']);

      const calls = [
        ...(prisma.invoice.aggregate as jest.Mock).mock.calls.map((c) => c[0].where),
        ...(prisma.invoice.count as jest.Mock).mock.calls.map((c) => c[0].where),
      ];
      for (const where of calls) {
        expect(where.branchId).toEqual({ in: ['b-1', 'b-2'] });
      }
    });

    it('tenant-wide callers (null) see no branch filter at all', async () => {
      (prisma.invoice.aggregate as jest.Mock).mockResolvedValue({ _sum: { totalAmount: 0, paidAmount: 0 }, _count: 0 });
      (prisma.invoice.count as jest.Mock).mockResolvedValue(0);

      await service.getStats('t-1', undefined, null);

      const aggCall = (prisma.invoice.aggregate as jest.Mock).mock.calls[0][0];
      expect(aggCall.where.branchId).toBeUndefined();
    });

    it('collectedAmount sums paidAmount across ALL matching invoices, not just status=PAID', async () => {
      // Two calls to aggregate: [0] totals (totalAmount + count), [1] collected (paidAmount, unrestricted by status).
      (prisma.invoice.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { totalAmount: 50000 }, _count: 5 })
        .mockResolvedValueOnce({ _sum: { paidAmount: 32000 } }); // includes PARTIALLY_PAID invoices
      (prisma.invoice.count as jest.Mock).mockResolvedValue(0);

      const stats = await service.getStats('t-1');

      expect(stats.collectedAmount).toBe(32000);
      // The second aggregate call (the one collectedAmount comes from) must
      // carry NO status restriction -- that was the bug.
      const collectedCall = (prisma.invoice.aggregate as jest.Mock).mock.calls[1][0];
      expect(collectedCall.where.status).toBeUndefined();
    });

    it('paidCount is still the count of fully PAID invoices, queried separately', async () => {
      (prisma.invoice.aggregate as jest.Mock).mockResolvedValue({ _sum: { totalAmount: 0, paidAmount: 0 }, _count: 0 });
      (prisma.invoice.count as jest.Mock)
        .mockResolvedValueOnce(7)  // paidCount
        .mockResolvedValueOnce(2)  // overdueCount
        .mockResolvedValueOnce(1); // draftCount

      const stats = await service.getStats('t-1');

      expect(stats.paidCount).toBe(7);
      expect((prisma.invoice.count as jest.Mock).mock.calls[0][0].where.status).toBe('PAID');
    });
  });

  // ── P0: findOverdue() branch scoping ──────────────────────────────────────
  describe('findOverdue', () => {
    it('applies no branch filter when authorizedBranchIds is omitted (backward compatible)', async () => {
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
      await service.findOverdue('t-1');
      const call = (prisma.invoice.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.branchId).toBeUndefined();
    });

    it('restricts to the given branches when authorizedBranchIds is a set', async () => {
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
      await service.findOverdue('t-1', ['b-1']);
      const call = (prisma.invoice.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.branchId).toEqual({ in: ['b-1'] });
    });

    it('fails closed: an empty authorized set filters to nothing', async () => {
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
      await service.findOverdue('t-1', []);
      const call = (prisma.invoice.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.branchId).toEqual({ in: [] });
    });

    // M5: findOverdue() previously filtered status IN (SENT, PARTIALLY_PAID)
    // only -- a legacy invoice already marked OVERDUE by the (now-removed)
    // cron write was invisible on this endpoint. Now sourced from the shared
    // overdueWhere() predicate, which includes OVERDUE as a legacy match.
    it('includes legacy OVERDUE-status invoices (M5 fix -- previously invisible here)', async () => {
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
      await service.findOverdue('t-1');
      const call = (prisma.invoice.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.status.in).toEqual(OVERDUE_STATUS_MATCH);
      expect(call.where.dueDate).toHaveProperty('lt');
    });
  });

  // M5: getDefaulters() now sources its status/dueDate predicate from the
  // same shared util as findOverdue(), so the two can never drift apart.
  describe('getDefaulters', () => {
    it('uses the shared overdue predicate (SENT, PARTIALLY_PAID, legacy OVERDUE + dueDate < now)', async () => {
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
      await service.getDefaulters('t-1');
      const call = (prisma.invoice.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.status.in).toEqual(OVERDUE_STATUS_MATCH);
      expect(call.where.dueDate).toHaveProperty('lt');
    });
  });

  // M5 Commit 3: isOverdue on API responses. Neither method had any prior
  // test coverage at all -- adding it here for the first time, not just for
  // the new field.
  describe('findAll', () => {
    it('adds isOverdue: true to an invoice that is SENT and past due', async () => {
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([
        { id: 'inv-1', status: 'SENT', dueDate: new Date('2020-01-01') },
      ]);
      (prisma.invoice.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll('t-1');

      expect(result.data[0].isOverdue).toBe(true);
    });

    it('adds isOverdue: false to a PAID invoice, even if its due date has passed', async () => {
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([
        { id: 'inv-1', status: 'PAID', dueDate: new Date('2020-01-01') },
      ]);
      (prisma.invoice.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll('t-1');

      expect(result.data[0].isOverdue).toBe(false);
    });

    it('adds isOverdue: false to a SENT invoice that is not yet due', async () => {
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([
        { id: 'inv-1', status: 'SENT', dueDate: new Date('2099-01-01') },
      ]);
      (prisma.invoice.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll('t-1');

      expect(result.data[0].isOverdue).toBe(false);
    });

    it('preserves every other field on the invoice unchanged', async () => {
      const invoice = { id: 'inv-1', status: 'SENT', dueDate: new Date('2020-01-01'), totalAmount: 5000 };
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([invoice]);
      (prisma.invoice.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll('t-1');

      expect(result.data[0]).toEqual(expect.objectContaining({ id: 'inv-1', totalAmount: 5000 }));
    });

    // Defensive edge case: the Invoice schema declares dueDate as a required
    // (non-nullable) DateTime column, so a real row can never have
    // dueDate: null. isInvoiceOverdue()'s signature accepts null anyway
    // (overdue.util.spec.ts covers it directly); this proves findAll()
    // doesn't crash if one ever slipped through -- a direct SQL write, a
    // future migration widening the column, etc. -- rather than assuming
    // the schema constraint alone is enough.
    it('does not crash and reports isOverdue: false if dueDate were ever null', async () => {
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([
        { id: 'inv-1', status: 'SENT', dueDate: null },
      ]);
      (prisma.invoice.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll('t-1');

      expect(result.data[0].isOverdue).toBe(false);
    });

    // Realistic edge case: DRAFT is a valid, common status (every invoice
    // starts here), and findAll() does not filter it out. A DRAFT invoice
    // has not been sent to the parent yet, so it must never read as
    // overdue, even with a due date long past -- DRAFT is in neither
    // PERMANENT_OVERDUE_STATUSES nor LEGACY_OVERDUE_STATUSES.
    it('reports isOverdue: false for a DRAFT invoice, even with a due date far in the past', async () => {
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([
        { id: 'inv-1', status: 'DRAFT', dueDate: new Date('2000-01-01') },
      ]);
      (prisma.invoice.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll('t-1');

      expect(result.data[0].isOverdue).toBe(false);
    });
  });

  describe('findById', () => {
    it('adds isOverdue: true to a PARTIALLY_PAID invoice past its due date', async () => {
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
        id: 'inv-1', status: 'PARTIALLY_PAID', dueDate: new Date('2020-01-01'),
      });

      const result = await service.findById('t-1', 'inv-1');

      expect(result.isOverdue).toBe(true);
    });

    it('adds isOverdue: false to a CANCELLED invoice past what was its due date', async () => {
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
        id: 'inv-1', status: 'CANCELLED', dueDate: new Date('2020-01-01'),
      });

      const result = await service.findById('t-1', 'inv-1');

      expect(result.isOverdue).toBe(false);
    });

    it('preserves every other field on the invoice unchanged', async () => {
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
        id: 'inv-1', status: 'SENT', dueDate: new Date('2020-01-01'), invoiceNumber: 'INV-1',
      });

      const result = await service.findById('t-1', 'inv-1');

      expect(result).toEqual(expect.objectContaining({ id: 'inv-1', invoiceNumber: 'INV-1' }));
    });

    // Defensive edge case, same reasoning as findAll() above: the schema
    // forbids a null dueDate on a real row, but the service must not crash
    // if one ever slipped through.
    it('does not crash and reports isOverdue: false if dueDate were ever null', async () => {
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
        id: 'inv-1', status: 'SENT', dueDate: null,
      });

      const result = await service.findById('t-1', 'inv-1');

      expect(result.isOverdue).toBe(false);
    });

    // Realistic edge case, same reasoning as findAll() above: a DRAFT
    // invoice has not been sent yet and must never read as overdue.
    it('reports isOverdue: false for a DRAFT invoice, even with a due date far in the past', async () => {
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
        id: 'inv-1', status: 'DRAFT', dueDate: new Date('2000-01-01'),
      });

      const result = await service.findById('t-1', 'inv-1');

      expect(result.isOverdue).toBe(false);
    });
  });
});
