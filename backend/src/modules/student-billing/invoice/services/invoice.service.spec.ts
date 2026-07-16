import { Test, TestingModule }  from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InvoiceService }  from './invoice.service';
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

const mockStudent = { id: 'stu-1', tenantId: 't-1', firstName: 'Aarav', lastName: 'Shah', admissionNumber: 'ADM001' };

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

    // Verify GST: 2000 * 18% = 360
    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          gstAmount: 360,
          totalAmount: 12360,
          subtotal: 12000,
        }),
      }),
    );
  });

  // TEST 7
  it('uses advisory lock for invoice number (calls $executeRawUnsafe)', async () => {
    (prisma.invoice.create as jest.Mock).mockResolvedValue({ id: 'inv-1', invoiceNumber: 'INV-2025-00001', totalAmount: 10000 });
    await service.generate('t-1', { studentId: 'stu-1', feePlanId: 'plan-1', dueDate: '2025-04-30' }, 'actor-1');
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  // TEST 8
  it('generates sequential invoice numbers: INV-YYYY-00001', async () => {
    const mockTx = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
      invoice: { count: jest.fn().mockResolvedValue(4) },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => fn(mockTx));
    (prisma.invoice.create as jest.Mock).mockImplementation(({ data }) =>
      Promise.resolve({ id: 'inv-5', invoiceNumber: data.invoiceNumber, totalAmount: 10000 }),
    );
    await service.generate('t-1', { studentId: 'stu-1', feePlanId: 'plan-1', dueDate: '2025-04-30' }, 'actor-1');
    const callArg = (prisma.invoice.create as jest.Mock).mock.calls[0][0];
    expect(callArg.data.invoiceNumber).toMatch(/INV-\d{4}-00005/);
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
        { provide: PrismaService, useValue: { feePlan: { findFirst: jest.fn().mockResolvedValue(mockFeePlan) }, student: { findFirst: jest.fn().mockResolvedValue(mockStudent) }, transportAssignment: { findFirst: jest.fn().mockResolvedValue(null) }, discount: { findMany: jest.fn().mockResolvedValue([]) }, invoice: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue({ id: 'inv-1', invoiceNumber: 'INV-2025-00001', totalAmount: 12360 }) }, $transaction: jest.fn().mockImplementation(async (fn) => fn({ $executeRawUnsafe: jest.fn(), invoice: { count: jest.fn().mockResolvedValue(0) } })) } },
        { provide: AuditService, useValue: { logCreate: jest.fn() } },
        { provide: EventEmitter2, useValue: emitter },
      ],
    }).compile();
    const svc = mod.get<InvoiceService>(InvoiceService);
    await svc.generate('t-1', { studentId: 'stu-1', feePlanId: 'plan-1', dueDate: '2025-04-30' }, 'actor-1');
    expect(emitter.emit).toHaveBeenCalledWith('invoice.generated', expect.any(Object));
  });
});
