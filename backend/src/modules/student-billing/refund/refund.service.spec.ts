// FEE-1: RefundService correctness. This service had no test coverage at all,
// which is how two silent-failure bugs survived: a status filter matching a
// value that is not in the RefundStatus enum, and an audit action that is not
// in the AuditAction enum. Both looked plausible and neither raised anything
// at runtime.

import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RefundService } from './refund.service';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '../../../core/compliance/audit.service';

const PAYMENT_AMOUNT = 10_000;

function payment(refunds: Array<{ amount: number; status: string }> = []) {
  return {
    id: 'pay-1',
    tenantId: 't-1',
    branchId: 'b-1',
    invoiceId: 'inv-1',
    amount: PAYMENT_AMOUNT,
    status: 'SUCCESS',
    gateway: 'RAZORPAY',
    invoice: { id: 'inv-1', totalAmount: PAYMENT_AMOUNT },
    refunds,
  };
}

describe('RefundService.initiate (FEE-1)', () => {
  let service: RefundService;
  let prisma: any;
  let audit: any;

  beforeEach(async () => {
    prisma = {
      payment: {
        findFirst: jest.fn(),
        findMany:  jest.fn().mockResolvedValue([]),
        update:    jest.fn().mockResolvedValue({}),
      },
      refund: {
        create: jest.fn().mockResolvedValue({ id: 'ref-new', amount: 0 }),
        update: jest.fn().mockResolvedValue({ id: 'ref-new' }),
        // Settlement recomputes committed totals from the DB.
        findMany: jest.fn().mockResolvedValue([]),
      },
      invoice: {
        findFirst: jest.fn().mockResolvedValue(null),
        update:    jest.fn().mockResolvedValue({}),
      },
      // initiate() runs validation+reservation and settlement in transactions;
      // the mock hands the callback this same object as its tx client.
      $transaction: jest.fn((cb: any) => cb(prisma)),
      // Advisory lock, taken inside the validation transaction.
      $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        RefundService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('') } },
      ],
    }).compile();

    service = module.get(RefundService);
    // The gateway call is not under test here.
    jest
      .spyOn(service as any, 'processGatewayRefund')
      .mockResolvedValue('gw-refund-1');
  });

  describe('over-refund guard (previously inert)', () => {
    it('sums prior refunds in Decimal — a valid exact-remaining refund is not wrongly rejected (D-9)', async () => {
      // Payment 1.00 with three prior COMPLETED refunds of 0.10.
      // Float: 0.1 + 0.1 + 0.1 = 0.30000000000000004, so alreadyRefunded
      // drifts high and a stricter comparison would reject the exact 0.70
      // that actually remains. Decimal sums to exactly 0.30, leaving 0.70.
      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1', tenantId: 't-1', branchId: 'b-1', invoiceId: 'inv-1',
        amount: 1, status: 'SUCCESS', gateway: 'RAZORPAY',
        invoice: { id: 'inv-1', totalAmount: 1 },
        refunds: [
          { amount: 0.1, status: 'COMPLETED' },
          { amount: 0.1, status: 'COMPLETED' },
          { amount: 0.1, status: 'COMPLETED' },
        ],
      });

      // The exact remaining 0.70 must be accepted, not rejected.
      await expect(
        service.initiate('t-1', { paymentId: 'pay-1', amount: 0.7, reason: 'x' }, 'actor-1', 'ACCOUNTANT'),
      ).resolves.toBeDefined();
      expect(prisma.refund.create).toHaveBeenCalled();
    });

    it('counts COMPLETED refunds against the available amount', async () => {
      prisma.payment.findFirst.mockResolvedValue(
        payment([{ amount: 6_000, status: 'COMPLETED' }]),
      );

      // 6,000 already refunded => only 4,000 available.
      await expect(
        service.initiate('t-1', { paymentId: 'pay-1', amount: 5_000, reason: 'x' }, 'actor-1', 'ACCOUNTANT'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.refund.create).not.toHaveBeenCalled();
    });

    it('counts PENDING (in-flight) refunds too — a second request cannot double-spend', async () => {
      prisma.payment.findFirst.mockResolvedValue(
        payment([{ amount: 10_000, status: 'PENDING' }]),
      );

      await expect(
        service.initiate('t-1', { paymentId: 'pay-1', amount: 1, reason: 'x' }, 'actor-1', 'ACCOUNTANT'),
      ).rejects.toThrow(/exceeds available 0/);
    });

    it('excludes FAILED refunds — no money moved, so the amount is still available', async () => {
      prisma.payment.findFirst.mockResolvedValue(
        payment([{ amount: 10_000, status: 'FAILED' }]),
      );

      await service.initiate(
        't-1',
        { paymentId: 'pay-1', amount: PAYMENT_AMOUNT, reason: 'x' },
        'actor-1', 'ACCOUNTANT',
      );
      expect(prisma.refund.create).toHaveBeenCalled();
    });

    // The regression that motivated this fix: 'SUCCESS' is not a RefundStatus
    // member, so the old filter matched nothing and full re-refunds passed.
    it('a fully-refunded payment cannot be refunded again', async () => {
      prisma.payment.findFirst.mockResolvedValue(
        payment([{ amount: 10_000, status: 'COMPLETED' }]),
      );

      await expect(
        service.initiate(
          't-1',
          { paymentId: 'pay-1', amount: PAYMENT_AMOUNT, reason: 'duplicate' },
          'actor-1', 'ACCOUNTANT',
        ),
      ).rejects.toThrow(/exceeds available 0/);
      expect(prisma.refund.create).not.toHaveBeenCalled();
    });

    it('sums multiple prior refunds rather than considering only the latest', async () => {
      prisma.payment.findFirst.mockResolvedValue(
        payment([
          { amount: 3_000, status: 'COMPLETED' },
          { amount: 3_000, status: 'COMPLETED' },
          { amount: 2_000, status: 'PENDING' },
        ]),
      );

      // 8,000 consumed => 2,000 available.
      await expect(
        service.initiate('t-1', { paymentId: 'pay-1', amount: 2_001, reason: 'x' }, 'actor-1', 'ACCOUNTANT'),
      ).rejects.toThrow(/exceeds available 2000/);

      await service.initiate('t-1', { paymentId: 'pay-1', amount: 2_000, reason: 'x' }, 'actor-1', 'ACCOUNTANT');
      expect(prisma.refund.create).toHaveBeenCalled();
    });

    it('allows a partial refund within the available amount', async () => {
      prisma.payment.findFirst.mockResolvedValue(payment());

      await service.initiate('t-1', { paymentId: 'pay-1', amount: 2_500, reason: 'x' }, 'actor-1', 'ACCOUNTANT');

      expect(prisma.refund.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amount: 2_500, status: 'PENDING', tenantId: 't-1' }),
        }),
      );
      // Partial refund => payment is PARTIALLY_REFUNDED, invoice not reopened.
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'PARTIALLY_REFUNDED' } }),
      );
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });
  });

  describe('audit action', () => {
    it('uses REFUND_PROCESSED — a real AuditAction member, not REFUND_INITIATED', async () => {
      prisma.payment.findFirst.mockResolvedValue(payment());

      await service.initiate('t-1', { paymentId: 'pay-1', amount: 1_000, reason: 'x' }, 'actor-1', 'ACCOUNTANT');

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'REFUND_PROCESSED' }),
        prisma, // written through the settlement tx
      );
      expect(audit.log).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: 'REFUND_INITIATED' }),
        expect.anything(),
      );
    });

    it('records the audit entry through the settlement transaction with the real actor role', async () => {
      prisma.payment.findFirst.mockResolvedValue(payment());
      prisma.refund.findMany.mockResolvedValue([{ amount: 1_000 }]);

      await service.initiate('t-1', { paymentId: 'pay-1', amount: 1_000, reason: 'x' }, 'actor-9', 'PRINCIPAL');

      // Second arg is the tx client (the mock passes `prisma` itself as tx),
      // and actorRole is the caller's real role, not a hardcoded 'ACCOUNTANT'.
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: 'actor-9', actorRole: 'PRINCIPAL', action: 'REFUND_PROCESSED' }),
        prisma,
      );
    });
  });

  describe('preconditions', () => {
    it('rejects an unknown payment', async () => {
      prisma.payment.findFirst.mockResolvedValue(null);
      await expect(
        service.initiate('t-1', { paymentId: 'nope', amount: 1, reason: 'x' }, 'actor-1', 'ACCOUNTANT'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses to refund a payment that never succeeded', async () => {
      prisma.payment.findFirst.mockResolvedValue({ ...payment(), status: 'FAILED' });
      await expect(
        service.initiate('t-1', { paymentId: 'pay-1', amount: 1, reason: 'x' }, 'actor-1', 'ACCOUNTANT'),
      ).rejects.toThrow(/Only successful payments/);
    });

    it('scopes the payment lookup by tenant', async () => {
      prisma.payment.findFirst.mockResolvedValue(payment());
      await service.initiate('t-1', { paymentId: 'pay-1', amount: 1, reason: 'x' }, 'actor-1', 'ACCOUNTANT');
      expect(prisma.payment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'pay-1', tenantId: 't-1' }),
        }),
      );
    });
  });
});

describe('RefundService.initiate — transactional boundaries (FEE-1)', () => {
  let service: RefundService;
  let prisma: any;
  let gatewaySpy: jest.SpyInstance;

  beforeEach(async () => {
    prisma = {
      payment: {
        findFirst: jest.fn().mockResolvedValue(payment()),
        findMany:  jest.fn().mockResolvedValue([]),
        update:    jest.fn().mockResolvedValue({}),
      },
      refund: {
        create: jest.fn().mockResolvedValue({ id: 'ref-new' }),
        update: jest.fn().mockResolvedValue({ id: 'ref-new' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      invoice: {
        findFirst: jest.fn().mockResolvedValue(null),
        update:    jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((cb: any) => cb(prisma)),
      $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        RefundService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('') } },
      ],
    }).compile();
    service = module.get(RefundService);
    gatewaySpy = jest
      .spyOn(service as any, 'processGatewayRefund')
      .mockResolvedValue('gw-1');
  });

  it('takes a payment-scoped advisory lock before reading refund history', async () => {
    await service.initiate('t-1', { paymentId: 'pay-1', amount: 100, reason: 'x' }, 'a-1', 'ACCOUNTANT');

    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('pg_advisory_xact_lock'),
      expect.any(Number),
    );
    // Lock must precede the read that the guard decides on.
    expect(prisma.$executeRawUnsafe.mock.invocationCallOrder[0])
      .toBeLessThan(prisma.payment.findFirst.mock.invocationCallOrder[0]);
  });

  it('derives the lock key from the payment id — different payments do not serialize against each other', async () => {
    await service.initiate('t-1', { paymentId: 'pay-1', amount: 1, reason: 'x' }, 'a-1', 'ACCOUNTANT');
    const keyA = prisma.$executeRawUnsafe.mock.calls[0][1];

    prisma.$executeRawUnsafe.mockClear();
    await service.initiate('t-1', { paymentId: 'pay-2', amount: 1, reason: 'x' }, 'a-1', 'ACCOUNTANT');
    const keyB = prisma.$executeRawUnsafe.mock.calls[0][1];

    expect(keyA).not.toEqual(keyB);
    expect(keyA).toBeGreaterThanOrEqual(0); // 31-bit, safe for pg int4
    expect(keyA).toBeLessThanOrEqual(0x7fffffff);
  });

  it('validation and reservation happen inside a transaction', async () => {
    await service.initiate('t-1', { paymentId: 'pay-1', amount: 100, reason: 'x' }, 'a-1', 'ACCOUNTANT');

    // Two transactions: reserve, then settle. The gateway call sits between.
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('does NOT hold a transaction open across the gateway call', async () => {
    let inTransactionDuringGateway = true;
    prisma.$transaction.mockImplementation(async (cb: any) => {
      const result = await cb(prisma);
      inTransactionDuringGateway = false; // transaction closed
      return result;
    });
    gatewaySpy.mockImplementation(async () => {
      // If a transaction were still open, this flag would be true.
      expect(inTransactionDuringGateway).toBe(false);
      return 'gw-1';
    });

    await service.initiate('t-1', { paymentId: 'pay-1', amount: 100, reason: 'x' }, 'a-1', 'ACCOUNTANT');
    expect(gatewaySpy).toHaveBeenCalled();
  });

  it('marks the refund FAILED and releases the reservation when the gateway fails', async () => {
    gatewaySpy.mockRejectedValue(new Error('gateway down'));

    await expect(
      service.initiate('t-1', { paymentId: 'pay-1', amount: 100, reason: 'x' }, 'a-1', 'ACCOUNTANT'),
    ).rejects.toThrow(/Gateway refund failed/);

    expect(prisma.refund.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
    // No settlement occurred.
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it('settles refund, payment and invoice in ONE transaction, from recomputed totals', async () => {
    // Full refund of the invoice's only payment: settlement re-reads COMPLETED
    // refunds rather than trusting the amount computed before the gateway call.
    prisma.refund.findMany.mockResolvedValue([{ amount: PAYMENT_AMOUNT }]);
    prisma.invoice.findFirst.mockResolvedValue({ id: 'inv-1', totalAmount: PAYMENT_AMOUNT });
    // The one payment, now fully refunded -> nothing retained.
    prisma.payment.findMany.mockResolvedValue([
      { amount: PAYMENT_AMOUNT, refunds: [{ amount: PAYMENT_AMOUNT }] },
    ]);

    await service.initiate(
      't-1',
      { paymentId: 'pay-1', amount: PAYMENT_AMOUNT, reason: 'x' },
      'a-1', 'ACCOUNTANT',
    );

    expect(prisma.refund.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { paymentId: 'pay-1', status: 'COMPLETED' },
      }),
    );
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'REFUNDED' } }),
    );
    // Invoice recomputed to fully-drained: nothing retained -> SENT, due back to full.
    const drainedData = prisma.invoice.update.mock.calls.at(-1)[0].data;
    expect(Number(drainedData.paidAmount)).toBe(0);
    expect(Number(drainedData.dueAmount)).toBe(PAYMENT_AMOUNT);
    expect(drainedData.status).toBe('SENT');
  });

  // The core M2 regression: an invoice paid by TWO payments, one fully
  // refunded, must NOT erase the other payment's contribution.
  it('preserves other payments\' contributions when one payment is fully refunded', async () => {
    // Invoice total 10,000, paid by two 5,000 payments; refunding pay-1 in full.
    prisma.payment.findFirst.mockResolvedValue({
      id: 'pay-1', tenantId: 't-1', branchId: 'b-1', invoiceId: 'inv-1',
      amount: 5_000, status: 'SUCCESS', gateway: 'RAZORPAY',
      invoice: { id: 'inv-1', totalAmount: 10_000 }, refunds: [],
    });
    prisma.refund.findMany.mockResolvedValue([{ amount: 5_000 }]); // pay-1 fully refunded
    prisma.invoice.findFirst.mockResolvedValue({ id: 'inv-1', totalAmount: 10_000 });
    // Remaining picture: pay-1 fully refunded (retains 0), pay-2 untouched (retains 5,000).
    prisma.payment.findMany.mockResolvedValue([
      { amount: 5_000, refunds: [{ amount: 5_000 }] },
      { amount: 5_000, refunds: [] },
    ]);

    await service.initiate('t-1', { paymentId: 'pay-1', amount: 5_000, reason: 'x' }, 'a-1', 'ACCOUNTANT');

    // pay-2's 5,000 survives: invoice shows 5,000 paid / 5,000 due, PARTIALLY_PAID.
    // NOT paidAmount:0 / dueAmount:10,000 (the bug).
    const preservedData = prisma.invoice.update.mock.calls.at(-1)[0].data;
    expect(Number(preservedData.paidAmount)).toBe(5_000);
    expect(Number(preservedData.dueAmount)).toBe(5_000);
    expect(preservedData.status).toBe('PARTIALLY_PAID');
  });

  it('recomputes the invoice from its own current state, not the Phase-1 snapshot', async () => {
    // Phase-1 payment.invoice.totalAmount is deliberately stale (9,000);
    // the invoice re-read inside settlement is the source of truth (10,000,
    // e.g. a late fee was assessed between reservation and settlement).
    prisma.payment.findFirst.mockResolvedValue({
      id: 'pay-1', tenantId: 't-1', branchId: 'b-1', invoiceId: 'inv-1',
      amount: 10_000, status: 'SUCCESS', gateway: 'RAZORPAY',
      invoice: { id: 'inv-1', totalAmount: 9_000 }, refunds: [],
    });
    prisma.refund.findMany.mockResolvedValue([{ amount: 10_000 }]);
    prisma.invoice.findFirst.mockResolvedValue({ id: 'inv-1', totalAmount: 10_000 });
    prisma.payment.findMany.mockResolvedValue([
      { amount: 10_000, refunds: [{ amount: 10_000 }] },
    ]);

    await service.initiate('t-1', { paymentId: 'pay-1', amount: 10_000, reason: 'x' }, 'a-1', 'ACCOUNTANT');

    // due recomputes to the CURRENT total (10,000), not the stale snapshot (9,000).
    const snapshotData = prisma.invoice.update.mock.calls.at(-1)[0].data;
    expect(Number(snapshotData.dueAmount)).toBe(10_000);
  });

  it('a partial refund still reduces the invoice retained/paid amount', async () => {
    // pay-1 (10,000) partially refunded 4,000 -> retains 6,000; invoice due 4,000.
    prisma.refund.findMany.mockResolvedValue([{ amount: 4_000 }]);
    prisma.invoice.findFirst.mockResolvedValue({ id: 'inv-1', totalAmount: 10_000 });
    prisma.payment.findMany.mockResolvedValue([
      { amount: 10_000, refunds: [{ amount: 4_000 }] },
    ]);

    await service.initiate('t-1', { paymentId: 'pay-1', amount: 4_000, reason: 'x' }, 'a-1', 'ACCOUNTANT');

    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'PARTIALLY_REFUNDED' } }),
    );
    const partialData = prisma.invoice.update.mock.calls.at(-1)[0].data;
    expect(Number(partialData.paidAmount)).toBe(6_000);
    expect(Number(partialData.dueAmount)).toBe(4_000);
    expect(partialData.status).toBe('PARTIALLY_PAID');
  });

  it('allows a further refund against an already PARTIALLY_REFUNDED payment', async () => {
    prisma.payment.findFirst.mockResolvedValue({
      ...payment([{ amount: 4_000, status: 'COMPLETED' }]),
      status: 'PARTIALLY_REFUNDED',
    });

    await service.initiate('t-1', { paymentId: 'pay-1', amount: 6_000, reason: 'x' }, 'a-1', 'ACCOUNTANT');
    expect(prisma.refund.create).toHaveBeenCalled();
  });
});
