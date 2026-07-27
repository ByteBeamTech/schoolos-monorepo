// P0: LateFee.paidAmount/status were never written when a payment settled,
// so a late fee stayed ACTIVE forever even after its invoice was fully paid.
// These tests pin allocatePayment(), the fix, called from inside
// PaymentService's settlement transaction (see payment.service.ts).

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '../../../core/compliance/audit.service';
import { LateFeeService } from './late-fee.service';
import { LedgerService } from '../ledger/services/ledger.service';
import { OVERDUE_STATUS_MATCH } from '../invoice/overdue.util';

describe('LateFeeService.calculateLateFee — Decimal rounding (D-9)', () => {
  let service: LateFeeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LateFeeService,
        { provide: PrismaService, useValue: {} },
        { provide: AuditService, useValue: { logUpdate: jest.fn() } },
        { provide: LedgerService, useValue: { recordPaymentCompleted: jest.fn(), recordRefundCompleted: jest.fn(), recordLateFeeAssessed: jest.fn() } },
      ],
    }).compile();
    service = module.get(LateFeeService);
  });

  it('rounds a percentage penalty correctly where binary float misrounds', () => {
    // due 100 @ 8.325%/month, 1 month overdue, no grace:
    //   100 * 0.08325 = 8.325 -> round-half-up = 8.33.
    // The old float path did Math.round(8.325*100)/100 = 8.32 (8.325 stored
    // as 8.32499...). Decimal.toDecimalPlaces(2) gives the correct 8.33.
    const due = 100;
    const dueDate = new Date('2026-01-01');
    const asOf    = new Date('2026-01-16'); // 15 days late, no grace -> ceil(15/30)=1 month
    const config = {
      gracePeriodDays: 0,
      penaltyType: 'PERCENTAGE' as const,
      penaltyValue: 8.325,
      compoundDaily: false,
    };

    const { lateFee } = service.calculateLateFee(due, dueDate, asOf, config);
    expect(lateFee).toBe(8.33); // NOT 8.32
  });

  it('caps the penalty at maxPenalty without float drift', () => {
    const config = {
      gracePeriodDays: 0,
      penaltyType: 'PERCENTAGE' as const,
      penaltyValue: 50,
      maxPenalty: 500,
      compoundDaily: false,
    };
    const { lateFee } = service.calculateLateFee(
      100000, new Date('2026-01-01'), new Date('2026-02-01'), config,
    );
    expect(lateFee).toBe(500); // capped
  });
});

describe('LateFeeService.applyLateFees — invoice lock (M4)', () => {
  let service: LateFeeService;
  let prisma: any;
  let tx: any;

  function scannedInvoice(over: any = {}) {
    return {
      id: 'inv-1', tenantId: 't-1', studentId: 'stu-1',
      dueDate: new Date('2026-01-01'),
      dueAmount: 1000, totalAmount: 1000, status: 'SENT',
      student: { branchId: 'b-1' },
      lateFees: [],
      ...over,
    };
  }

  beforeEach(async () => {
    tx = {
      invoice: {
        findFirst: jest.fn().mockResolvedValue({ id: 'inv-1', dueAmount: 1000, totalAmount: 1000 }),
        update:    jest.fn().mockResolvedValue({}),
      },
      lateFee: { create: jest.fn().mockResolvedValue({ id: 'lf-1' }) },
      $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
    };
    prisma = {
      invoice: {
        findMany:  jest.fn().mockResolvedValue([scannedInvoice()]),
        findFirst: tx.invoice.findFirst,
        update:    jest.fn(), // must NOT be called directly -- only via tx
      },
      lateFee: {
        create:   jest.fn(), // must NOT be called directly -- only via tx
        findMany: jest.fn().mockResolvedValue([]),
      },
      academicSession: { findFirst: jest.fn().mockResolvedValue({ id: 'sess-1' }) },
      $transaction: jest.fn((cb: any) => cb(tx)),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LateFeeService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { logUpdate: jest.fn() } },
        { provide: LedgerService, useValue: { recordPaymentCompleted: jest.fn(), recordRefundCompleted: jest.fn(), recordLateFeeAssessed: jest.fn() } },
      ],
    }).compile();
    service = module.get(LateFeeService);
  });

  it('acquires the SAME per-invoice advisory lock waiveLateFee uses (shared lockKeyFor, not a fifth copy)', async () => {
    await service.applyLateFees();

    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
      `SELECT pg_advisory_xact_lock($1)`,
      (service as any).lockKeyFor('inv-1'),
    );
  });

  it('performs the LateFee insert and the Invoice update through the SAME transaction (atomic)', async () => {
    await service.applyLateFees();

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.lateFee.create).toHaveBeenCalled();
    expect(tx.invoice.update).toHaveBeenCalled();
    // Never written outside the transaction/lock.
    expect(prisma.lateFee.create).not.toHaveBeenCalled();
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  // M4 (redesigned roadmap, §4.9): LATE_FEE_ASSESSED posted exactly once,
  // inside the same lock+transaction as the LateFee insert and Invoice
  // update -- not a separate write outside them.
  it('posts a LATE_FEE_ASSESSED ledger entry referencing the created LateFee, inside the same transaction', async () => {
    await service.applyLateFees();

    expect((service as any).ledger.recordLateFeeAssessed).toHaveBeenCalledTimes(1);
    expect((service as any).ledger.recordLateFeeAssessed).toHaveBeenCalledWith(
      tx, // the SAME transaction client the LateFee insert and Invoice update used
      expect.objectContaining({
        tenantId: 't-1', branchId: 'b-1', studentId: 'stu-1', referenceId: 'lf-1',
      }),
    );
  });

  it('does not post a ledger entry when the invoice is skipped (already fee-applied today)', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      scannedInvoice({ lateFees: [{ appliedAt: new Date() }] }),
    ]);

    await service.applyLateFees();

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect((service as any).ledger.recordLateFeeAssessed).not.toHaveBeenCalled();
  });

  // The core M4 regression. The initial scan captured dueAmount: 1000 (stale
  // by the time the lock is acquired). Simulate a concurrent settlement
  // having already paid the invoice off in full before this transaction's
  // lock-protected re-read runs.
  it('uses the FRESH invoice state re-read inside the lock, not the stale pre-lock scan (lost-update regression)', async () => {
    // Concurrent settlement already cleared the invoice to zero due.
    tx.invoice.findFirst.mockResolvedValue({ id: 'inv-1', dueAmount: 0, totalAmount: 1000 });

    await service.applyLateFees();

    // A cleared invoice must attract NO late fee -- if this used the stale
    // scan's dueAmount: 1000 instead of the fresh 0, it would wrongly apply
    // one and clobber the settlement's write. Neither write happens.
    expect(tx.lateFee.create).not.toHaveBeenCalled();
    expect(tx.invoice.update).not.toHaveBeenCalled();
  });

  it('computes the late fee and the new totals off the fresh due amount when a partial payment landed concurrently', async () => {
    // Scan saw dueAmount: 1000; a concurrent partial payment already brought
    // it down to 400 by the time the lock-protected re-read runs.
    tx.invoice.findFirst.mockResolvedValue({ id: 'inv-1', dueAmount: 400, totalAmount: 1000 });

    await service.applyLateFees();

    const feeData = tx.lateFee.create.mock.calls[0][0].data;
    expect(feeData.baseAmount).toBe(400); // NOT the stale 1000

    const invoiceData = tx.invoice.update.mock.calls[0][0].data;
    // dueAmount/totalAmount are built from the FRESH read (400 / 1000), not
    // the stale scanned invoice -- proves the write cannot clobber a
    // concurrent settlement's already-committed totals.
    expect(Number(invoiceData.dueAmount)).toBe(400 + feeData.amount);
  });

  // M5: the root fix. Before this milestone, applyLateFees() set
  // status: 'OVERDUE' on every invoice-update write; that write is now gone
  // entirely. Overdue-ness is derived by readers (invoice/overdue.util.ts),
  // never persisted here or anywhere else in Student Billing.
  it('does NOT write status: OVERDUE (M5 -- overdue is derived, never persisted)', async () => {
    await service.applyLateFees();

    const invoiceData = tx.invoice.update.mock.calls[0][0].data;
    expect(invoiceData.status).toBeUndefined();
    expect(invoiceData).not.toHaveProperty('status');
  });

  it('scans using the shared overdue predicate (SENT, PARTIALLY_PAID, legacy OVERDUE + dueDate < now)', async () => {
    await service.applyLateFees();

    const scanArg = prisma.invoice.findMany.mock.calls[0][0];
    expect(scanArg.where.status.in).toEqual(OVERDUE_STATUS_MATCH);
    expect(scanArg.where.dueDate).toHaveProperty('lt');
  });

  it('skips an invoice that vanished between the scan and the lock', async () => {
    tx.invoice.findFirst.mockResolvedValue(null);

    await expect(service.applyLateFees()).resolves.not.toThrow();
    expect(tx.lateFee.create).not.toHaveBeenCalled();
  });

  it('logs and continues past a failing invoice without aborting the batch', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      scannedInvoice({ id: 'inv-1' }),
      scannedInvoice({ id: 'inv-2' }),
    ]);
    prisma.$transaction
      .mockImplementationOnce(() => { throw new Error('db blip'); })
      .mockImplementationOnce((cb: any) => cb(tx));

    await expect(service.applyLateFees()).resolves.not.toThrow();
    // Second invoice still processed despite the first one's transaction failing.
    expect(tx.lateFee.create).toHaveBeenCalledTimes(1);
  });
});

describe('LateFeeService.allocatePayment', () => {
  let service: LateFeeService;
  let tx: any;
  let fees: any[];

  function makeFee(over: any = {}) {
    return {
      id: 'lf-1',
      tenantId: 't-1',
      invoiceId: 'inv-1',
      status: 'ACTIVE',
      amount: 100,
      paidAmount: 0,
      amountWaived: 0,
      appliedAt: new Date('2026-01-01'),
      ...over,
    };
  }

  beforeEach(async () => {
    fees = [];
    tx = {
      lateFee: {
        findMany: jest.fn().mockImplementation(({ where }: any) =>
          Promise.resolve(
            fees.filter(
              (f) =>
                f.tenantId === where.tenantId &&
                f.invoiceId === where.invoiceId &&
                f.status === where.status,
            ),
          ),
        ),
        update: jest.fn().mockImplementation(({ where, data }: any) => {
          const fee = fees.find((f) => f.id === where.id);
          Object.assign(fee, data);
          return Promise.resolve(fee);
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LateFeeService,
        { provide: PrismaService, useValue: {} },
        { provide: AuditService, useValue: { logUpdate: jest.fn() } },
        { provide: LedgerService, useValue: { recordPaymentCompleted: jest.fn(), recordRefundCompleted: jest.fn(), recordLateFeeAssessed: jest.fn() } },
      ],
    }).compile();
    service = module.get(LateFeeService);
  });

  it('does nothing for a zero or negative amount', async () => {
    fees.push(makeFee());
    await service.allocatePayment(tx, 't-1', 'inv-1', 'pay-1', 0);
    await service.allocatePayment(tx, 't-1', 'inv-1', 'pay-1', -5);
    expect(tx.lateFee.update).not.toHaveBeenCalled();
  });

  it('fully pays a single late fee when the payment covers it', async () => {
    fees.push(makeFee({ amount: 60 }));
    await service.allocatePayment(tx, 't-1', 'inv-1', 'pay-1', 100);

    expect(Number(fees[0].paidAmount)).toBe(60);
    expect(Number(fees[0].finalAmount)).toBe(0);
    expect(fees[0].status).toBe('PAID');
    expect(fees[0].paymentId).toBe('pay-1');
  });

  it('partially pays a fee when the payment is smaller than the outstanding amount', async () => {
    fees.push(makeFee({ amount: 100 }));
    await service.allocatePayment(tx, 't-1', 'inv-1', 'pay-1', 40);

    expect(Number(fees[0].paidAmount)).toBe(40);
    expect(Number(fees[0].finalAmount)).toBe(60);
    expect(fees[0].status).toBe('ACTIVE'); // still open
    // Not settled yet -- must not claim this payment as the one that closed it.
    expect(fees[0].paymentId).toBeUndefined();
  });

  it('allocates FIFO by appliedAt: oldest fee is paid down first', async () => {
    fees.push(
      makeFee({ id: 'lf-old', amount: 30, appliedAt: new Date('2026-01-01') }),
      makeFee({ id: 'lf-new', amount: 30, appliedAt: new Date('2026-01-05') }),
    );
    // Prisma would do this ordering; the mock's findMany doesn't sort, so
    // exercise it in already-correct order and assert the service doesn't
    // reorder or skip -- the orderBy clause itself is asserted below.
    await service.allocatePayment(tx, 't-1', 'inv-1', 'pay-1', 40);

    const old = fees.find((f) => f.id === 'lf-old');
    const nw = fees.find((f) => f.id === 'lf-new');
    expect(old.status).toBe('PAID');   // fully covered first
    expect(Number(nw.paidAmount)).toBe(10);    // remainder spills into the next fee
    expect(nw.status).toBe('ACTIVE');
  });

  it('requests oldest-first ordering from the database', async () => {
    fees.push(makeFee());
    await service.allocatePayment(tx, 't-1', 'inv-1', 'pay-1', 10);
    expect(tx.lateFee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { appliedAt: 'asc' } }),
    );
  });

  it('only allocates against ACTIVE fees, never PAID/WAIVED/REVERSED', async () => {
    await service.allocatePayment(tx, 't-1', 'inv-1', 'pay-1', 100);
    expect(tx.lateFee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't-1', invoiceId: 'inv-1', status: 'ACTIVE' } }),
    );
  });

  it('respects a prior partial waiver: outstanding excludes amountWaived', async () => {
    fees.push(makeFee({ amount: 100, amountWaived: 70 }));
    await service.allocatePayment(tx, 't-1', 'inv-1', 'pay-1', 100);

    // Only 30 was ever collectible; the payment must not over-allocate.
    expect(Number(fees[0].paidAmount)).toBe(30);
    expect(Number(fees[0].finalAmount)).toBe(0);
    expect(fees[0].status).toBe('PAID');
  });

  it('a payment larger than total outstanding late fees does not error or over-allocate', async () => {
    fees.push(makeFee({ amount: 25 }));
    await service.allocatePayment(tx, 't-1', 'inv-1', 'pay-1', 1000);

    expect(Number(fees[0].paidAmount)).toBe(25);
    expect(Number(fees[0].finalAmount)).toBe(0);
  });

  it('does nothing when there are no active late fees for the invoice', async () => {
    await expect(
      service.allocatePayment(tx, 't-1', 'inv-1', 'pay-1', 100),
    ).resolves.toBeUndefined();
    expect(tx.lateFee.update).not.toHaveBeenCalled();
  });
});

// The other half of the P0 fix: a late fee's schema always modelled a waiver
// (amountWaived, waivedAt/By, status WAIVED) but nothing ever wrote to it, and
// waiving a fee must also give back what applyLateFees() added to the
// invoice's own dueAmount/totalAmount -- otherwise "waived" is cosmetic.
describe('LateFeeService.waiveLateFee', () => {
  const { NotFoundException, BadRequestException } = require('@nestjs/common');

  let service: LateFeeService;
  let prisma: any;
  let fee: any;
  let invoice: any;
  let audit: any;

  beforeEach(async () => {
    fee = {
      id: 'lf-1', tenantId: 't-1', invoiceId: 'inv-1',
      status: 'ACTIVE', amount: 100, paidAmount: 0, amountWaived: 0,
      reason: null,
    };
    invoice = {
      id: 'inv-1', tenantId: 't-1', status: 'OVERDUE',
      totalAmount: 1100, dueAmount: 1100, paidAt: null,
    };
    audit = { logUpdate: jest.fn() };

    prisma = {
      lateFee: {
        findFirst: jest.fn().mockImplementation(() => Promise.resolve({ ...fee })),
        update: jest.fn().mockImplementation(({ data }: any) => {
          Object.assign(fee, data);
          return Promise.resolve({ ...fee });
        }),
      },
      invoice: {
        findFirst: jest.fn().mockImplementation(() => Promise.resolve({ ...invoice })),
        update: jest.fn().mockImplementation(({ data }: any) => {
          Object.assign(invoice, data);
          return Promise.resolve({ ...invoice });
        }),
      },
      $transaction: jest.fn((cb: any) => cb(prisma)),
      $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LateFeeService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: LedgerService, useValue: { recordPaymentCompleted: jest.fn(), recordRefundCompleted: jest.fn(), recordLateFeeAssessed: jest.fn() } },
      ],
    }).compile();
    service = module.get(LateFeeService);
  });

  it('rejects a zero or negative amount before touching the database', async () => {
    await expect(service.waiveLateFee('t-1', 'lf-1', 0, 'actor-1', 'goodwill')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.waiveLateFee('t-1', 'lf-1', -5, 'actor-1', 'goodwill')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('404s when the fee does not exist in this tenant', async () => {
    prisma.lateFee.findFirst.mockResolvedValue(null);
    await expect(service.waiveLateFee('t-1', 'missing', 10, 'actor-1', 'x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects waiving a fee that is not ACTIVE', async () => {
    fee.status = 'PAID';
    await expect(service.waiveLateFee('t-1', 'lf-1', 10, 'actor-1', 'x')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a waiver larger than the outstanding balance', async () => {
    fee.amount = 100; fee.paidAmount = 60; fee.amountWaived = 0; // 40 outstanding
    await expect(service.waiveLateFee('t-1', 'lf-1', 41, 'actor-1', 'x')).rejects.toThrow(/exceeds outstanding/);
  });

  it('a full waiver marks the fee WAIVED and stamps waiver metadata', async () => {
    fee.amount = 100;
    const { lateFee: result } = await service.waiveLateFee('t-1', 'lf-1', 100, 'actor-1', 'goodwill gesture');

    expect(Number(result.amountWaived)).toBe(100);
    expect(Number(result.finalAmount)).toBe(0);
    expect(result.status).toBe('WAIVED');
    expect(result.waivedById).toBe('actor-1');
    expect(result.reason).toBe('goodwill gesture');
    expect(result.waivedAt).toBeInstanceOf(Date);
  });

  it('a partial waiver leaves the fee ACTIVE with the remainder still outstanding', async () => {
    fee.amount = 100;
    const { lateFee: result } = await service.waiveLateFee('t-1', 'lf-1', 30, 'actor-1', 'partial goodwill');

    expect(Number(result.amountWaived)).toBe(30);
    expect(Number(result.finalAmount)).toBe(70);
    expect(result.status).toBe('ACTIVE');
  });

  it('a second partial waiver stacks on top of the first, never exceeding the total', async () => {
    fee.amount = 100; fee.amountWaived = 30;
    const { lateFee: result } = await service.waiveLateFee('t-1', 'lf-1', 70, 'actor-1', 'clear the rest');

    expect(Number(result.amountWaived)).toBe(100);
    expect(result.status).toBe('WAIVED');
  });

  it('accounts for prior payments when computing outstanding for the guard', async () => {
    fee.amount = 100; fee.paidAmount = 50; // only 50 left to waive
    await expect(service.waiveLateFee('t-1', 'lf-1', 51, 'actor-1', 'x')).rejects.toThrow(/exceeds outstanding/);
    await expect(service.waiveLateFee('t-1', 'lf-1', 50, 'actor-1', 'x')).resolves.toBeDefined();
  });

  it('reduces the invoice dueAmount and totalAmount by the waived amount', async () => {
    await service.waiveLateFee('t-1', 'lf-1', 40, 'actor-1', 'x');
    expect(Number(invoice.dueAmount)).toBe(1060);
    expect(Number(invoice.totalAmount)).toBe(1060);
  });

  it('flips the invoice to PAID when the waiver clears the remaining due amount', async () => {
    invoice.totalAmount = 100; invoice.dueAmount = 100;
    fee.amount = 100;
    await service.waiveLateFee('t-1', 'lf-1', 100, 'actor-1', 'clear it out');

    expect(Number(invoice.dueAmount)).toBe(0);
    expect(invoice.status).toBe('PAID');
    expect(invoice.paidAt).toBeInstanceOf(Date);
  });

  it('never lets the invoice dueAmount go negative', async () => {
    invoice.dueAmount = 20; // less than the fee being waived, shouldn't happen but must not corrupt data
    fee.amount = 40;
    await service.waiveLateFee('t-1', 'lf-1', 40, 'actor-1', 'x');
    expect(Number(invoice.dueAmount)).toBe(0);
  });

  it('takes the per-invoice advisory lock inside the transaction', async () => {
    await service.waiveLateFee('t-1', 'lf-1', 10, 'actor-1', 'x');
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('pg_advisory_xact_lock'),
      expect.any(Number),
    );
  });

  it('writes an audit entry through the same transaction', async () => {
    await service.waiveLateFee('t-1', 'lf-1', 10, 'actor-1', 'goodwill');
    expect(audit.logUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 't-1', actorId: 'actor-1', entityType: 'LateFee', entityId: 'lf-1',
      }),
      prisma, // the tx client, not a fresh connection
    );
  });

  it('everything commits or rolls back together', async () => {
    prisma.invoice.update.mockRejectedValue(new Error('db down'));
    await expect(service.waiveLateFee('t-1', 'lf-1', 10, 'actor-1', 'x')).rejects.toThrow('db down');
    // The whole mock transaction ran inline (cb(prisma)), so a rejected
    // invoice.update propagates and the caller must treat it as a full
    // rollback -- nothing here silently swallows it.
  });
});
