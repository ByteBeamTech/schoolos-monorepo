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
      payment: { findFirst: jest.fn(), update: jest.fn().mockResolvedValue({}) },
      refund: {
        create: jest.fn().mockResolvedValue({ id: 'ref-new', amount: 0 }),
        update: jest.fn().mockResolvedValue({ id: 'ref-new' }),
        // Settlement recomputes committed totals from the DB.
        findMany: jest.fn().mockResolvedValue([]),
      },
      invoice: { update: jest.fn().mockResolvedValue({}) },
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
    it('counts COMPLETED refunds against the available amount', async () => {
      prisma.payment.findFirst.mockResolvedValue(
        payment([{ amount: 6_000, status: 'COMPLETED' }]),
      );

      // 6,000 already refunded => only 4,000 available.
      await expect(
        service.initiate('t-1', { paymentId: 'pay-1', amount: 5_000, reason: 'x' }, 'actor-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.refund.create).not.toHaveBeenCalled();
    });

    it('counts PENDING (in-flight) refunds too — a second request cannot double-spend', async () => {
      prisma.payment.findFirst.mockResolvedValue(
        payment([{ amount: 10_000, status: 'PENDING' }]),
      );

      await expect(
        service.initiate('t-1', { paymentId: 'pay-1', amount: 1, reason: 'x' }, 'actor-1'),
      ).rejects.toThrow(/exceeds available 0/);
    });

    it('excludes FAILED refunds — no money moved, so the amount is still available', async () => {
      prisma.payment.findFirst.mockResolvedValue(
        payment([{ amount: 10_000, status: 'FAILED' }]),
      );

      await service.initiate(
        't-1',
        { paymentId: 'pay-1', amount: PAYMENT_AMOUNT, reason: 'x' },
        'actor-1',
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
          'actor-1',
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
        service.initiate('t-1', { paymentId: 'pay-1', amount: 2_001, reason: 'x' }, 'actor-1'),
      ).rejects.toThrow(/exceeds available 2000/);

      await service.initiate('t-1', { paymentId: 'pay-1', amount: 2_000, reason: 'x' }, 'actor-1');
      expect(prisma.refund.create).toHaveBeenCalled();
    });

    it('allows a partial refund within the available amount', async () => {
      prisma.payment.findFirst.mockResolvedValue(payment());

      await service.initiate('t-1', { paymentId: 'pay-1', amount: 2_500, reason: 'x' }, 'actor-1');

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

      await service.initiate('t-1', { paymentId: 'pay-1', amount: 1_000, reason: 'x' }, 'actor-1');

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'REFUND_PROCESSED' }),
      );
      expect(audit.log).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: 'REFUND_INITIATED' }),
      );
    });
  });

  describe('preconditions', () => {
    it('rejects an unknown payment', async () => {
      prisma.payment.findFirst.mockResolvedValue(null);
      await expect(
        service.initiate('t-1', { paymentId: 'nope', amount: 1, reason: 'x' }, 'actor-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses to refund a payment that never succeeded', async () => {
      prisma.payment.findFirst.mockResolvedValue({ ...payment(), status: 'FAILED' });
      await expect(
        service.initiate('t-1', { paymentId: 'pay-1', amount: 1, reason: 'x' }, 'actor-1'),
      ).rejects.toThrow(/Only successful payments/);
    });

    it('scopes the payment lookup by tenant', async () => {
      prisma.payment.findFirst.mockResolvedValue(payment());
      await service.initiate('t-1', { paymentId: 'pay-1', amount: 1, reason: 'x' }, 'actor-1');
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
      payment: { findFirst: jest.fn().mockResolvedValue(payment()), update: jest.fn().mockResolvedValue({}) },
      refund: {
        create: jest.fn().mockResolvedValue({ id: 'ref-new' }),
        update: jest.fn().mockResolvedValue({ id: 'ref-new' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      invoice: { update: jest.fn().mockResolvedValue({}) },
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
    await service.initiate('t-1', { paymentId: 'pay-1', amount: 100, reason: 'x' }, 'a-1');

    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('pg_advisory_xact_lock'),
      expect.any(Number),
    );
    // Lock must precede the read that the guard decides on.
    expect(prisma.$executeRawUnsafe.mock.invocationCallOrder[0])
      .toBeLessThan(prisma.payment.findFirst.mock.invocationCallOrder[0]);
  });

  it('derives the lock key from the payment id — different payments do not serialize against each other', async () => {
    await service.initiate('t-1', { paymentId: 'pay-1', amount: 1, reason: 'x' }, 'a-1');
    const keyA = prisma.$executeRawUnsafe.mock.calls[0][1];

    prisma.$executeRawUnsafe.mockClear();
    await service.initiate('t-1', { paymentId: 'pay-2', amount: 1, reason: 'x' }, 'a-1');
    const keyB = prisma.$executeRawUnsafe.mock.calls[0][1];

    expect(keyA).not.toEqual(keyB);
    expect(keyA).toBeGreaterThanOrEqual(0); // 31-bit, safe for pg int4
    expect(keyA).toBeLessThanOrEqual(0x7fffffff);
  });

  it('validation and reservation happen inside a transaction', async () => {
    await service.initiate('t-1', { paymentId: 'pay-1', amount: 100, reason: 'x' }, 'a-1');

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

    await service.initiate('t-1', { paymentId: 'pay-1', amount: 100, reason: 'x' }, 'a-1');
    expect(gatewaySpy).toHaveBeenCalled();
  });

  it('marks the refund FAILED and releases the reservation when the gateway fails', async () => {
    gatewaySpy.mockRejectedValue(new Error('gateway down'));

    await expect(
      service.initiate('t-1', { paymentId: 'pay-1', amount: 100, reason: 'x' }, 'a-1'),
    ).rejects.toThrow(/Gateway refund failed/);

    expect(prisma.refund.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
    // No settlement occurred.
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it('settles refund, payment and invoice in ONE transaction, from recomputed totals', async () => {
    // Full refund: settlement re-reads COMPLETED refunds rather than trusting
    // the amount computed before the gateway call.
    prisma.refund.findMany.mockResolvedValue([{ amount: PAYMENT_AMOUNT }]);

    await service.initiate(
      't-1',
      { paymentId: 'pay-1', amount: PAYMENT_AMOUNT, reason: 'x' },
      'a-1',
    );

    expect(prisma.refund.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { paymentId: 'pay-1', status: 'COMPLETED' },
      }),
    );
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'REFUNDED' } }),
    );
    expect(prisma.invoice.update).toHaveBeenCalled(); // reopened
  });

  it('leaves the invoice alone when the payment is only partially refunded', async () => {
    prisma.refund.findMany.mockResolvedValue([{ amount: 1_000 }]);

    await service.initiate('t-1', { paymentId: 'pay-1', amount: 1_000, reason: 'x' }, 'a-1');

    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'PARTIALLY_REFUNDED' } }),
    );
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it('allows a further refund against an already PARTIALLY_REFUNDED payment', async () => {
    prisma.payment.findFirst.mockResolvedValue({
      ...payment([{ amount: 4_000, status: 'COMPLETED' }]),
      status: 'PARTIALLY_REFUNDED',
    });

    await service.initiate('t-1', { paymentId: 'pay-1', amount: 6_000, reason: 'x' }, 'a-1');
    expect(prisma.refund.create).toHaveBeenCalled();
  });
});
