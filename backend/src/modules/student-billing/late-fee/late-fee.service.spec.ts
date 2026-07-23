// P0: LateFee.paidAmount/status were never written when a payment settled,
// so a late fee stayed ACTIVE forever even after its invoice was fully paid.
// These tests pin allocatePayment(), the fix, called from inside
// PaymentService's settlement transaction (see payment.service.ts).

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@infra/database/prisma.service';
import { LateFeeService } from './late-fee.service';

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
      providers: [LateFeeService, { provide: PrismaService, useValue: {} }],
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

    expect(fees[0].paidAmount).toBe(60);
    expect(fees[0].finalAmount).toBe(0);
    expect(fees[0].status).toBe('PAID');
    expect(fees[0].paymentId).toBe('pay-1');
  });

  it('partially pays a fee when the payment is smaller than the outstanding amount', async () => {
    fees.push(makeFee({ amount: 100 }));
    await service.allocatePayment(tx, 't-1', 'inv-1', 'pay-1', 40);

    expect(fees[0].paidAmount).toBe(40);
    expect(fees[0].finalAmount).toBe(60);
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
    expect(nw.paidAmount).toBe(10);    // remainder spills into the next fee
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
    expect(fees[0].paidAmount).toBe(30);
    expect(fees[0].finalAmount).toBe(0);
    expect(fees[0].status).toBe('PAID');
  });

  it('a payment larger than total outstanding late fees does not error or over-allocate', async () => {
    fees.push(makeFee({ amount: 25 }));
    await service.allocatePayment(tx, 't-1', 'inv-1', 'pay-1', 1000);

    expect(fees[0].paidAmount).toBe(25);
    expect(fees[0].finalAmount).toBe(0);
  });

  it('does nothing when there are no active late fees for the invoice', async () => {
    await expect(
      service.allocatePayment(tx, 't-1', 'inv-1', 'pay-1', 100),
    ).resolves.toBeUndefined();
    expect(tx.lateFee.update).not.toHaveBeenCalled();
  });
});
