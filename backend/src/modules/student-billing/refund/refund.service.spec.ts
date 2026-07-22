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
        create: jest.fn().mockResolvedValue({ id: 'ref-new' }),
        update: jest.fn().mockResolvedValue({}),
      },
      invoice: { update: jest.fn().mockResolvedValue({}) },
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
