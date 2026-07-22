// FEE-0 (Security Hardening), backlog item 3:
// "Hard-fail PaymentService.verifyRazorpay() on missing/placeholder gateway
//  config in non-development environments, instead of silently skipping HMAC
//  verification."
//
// Acceptance criterion under test: "Razorpay verification cannot be bypassed
// by missing/placeholder config in a non-dev environment (verified by test)."

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import { PaymentService } from './payment.service';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '../../../../core/compliance/audit.service';
import { InvoiceService } from '../../invoice/services/invoice.service';

const REAL_SECRET = 'real_secret_for_tests';
const PLACEHOLDER_SECRET = 'rzp_test_xxxxxxxxxx';

const mockPayment = {
  id: 'pay-1',
  tenantId: 't-1',
  invoiceId: 'inv-1',
  amount: 1000,
  gatewayOrderId: 'order_1',
  invoice: { id: 'inv-1', studentId: 'stu-1', currency: 'INR' },
};

const dto = {
  razorpayOrderId: 'order_1',
  razorpayPaymentId: 'rzp_pay_1',
  razorpaySignature: 'sig',
};

function validSignature(secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${dto.razorpayOrderId}|${dto.razorpayPaymentId}`)
    .digest('hex');
}

describe('PaymentService.verifyRazorpay — fail-closed gateway config (FEE-0)', () => {
  let service: PaymentService;
  let prisma: any;
  let configValues: Record<string, string | undefined>;

  async function buildModule() {
    prisma = {
      payment: {
        findFirst: jest.fn().mockResolvedValue({ ...mockPayment }),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ ...mockPayment, ...data }),
        ),
      },
      // FEE-1: settlement (payment + invoice totals + receipt) now runs in one
      // transaction guarded by a per-invoice advisory lock. The mock hands the
      // callback this same object as its tx client.
      $transaction: jest.fn((cb: any) => cb(prisma)),
      $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { logPayment: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(
              (key: string, def?: string) => configValues[key] ?? def,
            ),
          },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: InvoiceService, useValue: {} },
      ],
    }).compile();

    service = module.get(PaymentService);
    // Neutralize the post-verification side effects — not under test here.
    jest
      .spyOn(service as any, 'updateInvoice')
      .mockResolvedValue(undefined);
    jest
      .spyOn(service as any, 'generateReceipt')
      .mockResolvedValue({ id: 'rcpt-1' });
  }

  describe('non-development environments fail CLOSED', () => {
    it.each([
      ['production', undefined],
      ['production', ''],
      ['production', PLACEHOLDER_SECRET],
      ['staging-or-anything-unknown', undefined],
    ])(
      'NODE_ENV=%s with secret=%p throws 503 and never marks payment SUCCESS',
      async (nodeEnv, secret) => {
        configValues = {
          NODE_ENV: nodeEnv,
          RAZORPAY_STUDENT_KEY_SECRET: secret,
        };
        await buildModule();

        await expect(
          service.verifyRazorpay('t-1', dto as any, 'actor-1'),
        ).rejects.toBeInstanceOf(ServiceUnavailableException);

        // The critical property: no write flipped the payment to SUCCESS.
        expect(prisma.payment.update).not.toHaveBeenCalled();
      },
    );
  });

  describe('configured secret — HMAC is enforced everywhere', () => {
    it('rejects an invalid signature in production and marks the payment FAILED', async () => {
      configValues = {
        NODE_ENV: 'production',
        RAZORPAY_STUDENT_KEY_SECRET: REAL_SECRET,
      };
      await buildModule();

      await expect(
        service.verifyRazorpay(
          't-1',
          { ...dto, razorpaySignature: 'tampered' } as any,
          'actor-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
      expect(prisma.payment.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SUCCESS' }),
        }),
      );
    });

    it('accepts a valid signature in production and confirms the payment', async () => {
      configValues = {
        NODE_ENV: 'production',
        RAZORPAY_STUDENT_KEY_SECRET: REAL_SECRET,
      };
      await buildModule();

      const result = await service.verifyRazorpay(
        't-1',
        { ...dto, razorpaySignature: validSignature(REAL_SECRET) } as any,
        'actor-1',
      );

      expect(result.payment.status).toBe('SUCCESS');
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SUCCESS' }),
        }),
      );
    });
  });

  describe('development/test environments keep the existing skip (explicitly permitted)', () => {
    it.each(['development', 'test'])(
      'NODE_ENV=%s with missing secret still confirms (documented dev convenience)',
      async (nodeEnv) => {
        configValues = {
          NODE_ENV: nodeEnv,
          RAZORPAY_STUDENT_KEY_SECRET: undefined,
        };
        await buildModule();

        const result = await service.verifyRazorpay(
          't-1',
          dto as any,
          'actor-1',
        );
        expect(result.payment.status).toBe('SUCCESS');
      },
    );
  });
});

// ── FEE-0 item 1: getPaymentHistory branch scoping ─────────────────────────
describe('PaymentService.getPaymentHistory — FEE-0 branch scoping', () => {
  const { Test: T2 } = require('@nestjs/testing');
  const { NotFoundException } = require('@nestjs/common');
  let service: any;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      invoice: { findFirst: jest.fn() },
      payment: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const module = await T2.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { logPayment: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: InvoiceService, useValue: {} },
      ],
    }).compile();
    service = module.get(PaymentService);
  });

  it('restricted callers: invoice lookup itself is constrained to their branch set', async () => {
    prisma.invoice.findFirst.mockResolvedValue({ id: 'inv-1' });
    await service.getPaymentHistory('t-1', 'inv-1', ['b-1', 'b-2']);
    expect(prisma.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'inv-1',
          tenantId: 't-1',
          branchId: { in: ['b-1', 'b-2'] },
        }),
      }),
    );
  });

  it('an out-of-branch invoice reads as NotFound and payment rows are never queried', async () => {
    prisma.invoice.findFirst.mockResolvedValue(null);
    await expect(service.getPaymentHistory('t-1', 'inv-x', ['b-1']))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.payment.findMany).not.toHaveBeenCalled();
  });

  it('tenant-wide callers (null) keep tenant-only lookup; empty set fails closed', async () => {
    prisma.invoice.findFirst.mockResolvedValue({ id: 'inv-1' });
    await service.getPaymentHistory('t-1', 'inv-1', null);
    expect(prisma.invoice.findFirst.mock.calls[0][0].where.branchId).toBeUndefined();

    prisma.invoice.findFirst.mockResolvedValue(null);
    await expect(service.getPaymentHistory('t-1', 'inv-1', []))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.invoice.findFirst.mock.calls[1][0].where.branchId).toEqual({ in: [] });
  });
});

// ── FEE-1: payment-confirmation atomicity + per-invoice serialization ──────
describe('PaymentService settlement — atomicity and concurrency (FEE-1)', () => {
  const { Test: T4 } = require('@nestjs/testing');
  let service: any;
  let prisma: any;
  let invoiceService: any;

  const invoice = { id: 'inv-1', tenantId: 't-1', branchId: 'b-1', studentId: 'stu-1',
    currency: 'INR', status: 'SENT', totalAmount: 5000, paidAmount: 0, dueAmount: 5000 };

  beforeEach(async () => {
    prisma = {
      payment: {
        // Default null: recordOffline's duplicate-reference probe must find
        // nothing. The verifyRazorpay block overrides this.
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue({ id: 'pay-1', amount: 1000, currency: 'INR' }),
        create: jest.fn().mockResolvedValue({ id: 'pay-new' }),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...mockPayment, ...data })),
      },
      invoice: {
        findFirst: jest.fn().mockResolvedValue({ ...invoice }),
        findUnique: jest.fn().mockResolvedValue({ ...invoice }),
        update: jest.fn().mockResolvedValue({}),
      },
      receipt: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'rcpt-1' }) },
      $transaction: jest.fn((cb: any) => cb(prisma)),
      $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
    };
    invoiceService = { generateReceiptNumber: jest.fn().mockResolvedValue('RCP-2026-00001') };

    const module = await T4.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { logPayment: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn((k: string, d?: string) =>
            k === 'NODE_ENV' ? 'test' : d) } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: InvoiceService, useValue: invoiceService },
      ],
    }).compile();
    service = module.get(PaymentService);
  });

  describe('recordOffline', () => {
    const dto = { invoiceId: 'inv-1', amount: 1000, paymentMethod: 'CASH', referenceNumber: 'REF-1' };

    it('creates payment, updates the invoice and writes the receipt in ONE transaction', async () => {
      await service.recordOffline('t-1', dto as any, 'actor-1');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.payment.create).toHaveBeenCalled();
      expect(prisma.invoice.update).toHaveBeenCalled();
      expect(prisma.receipt.create).toHaveBeenCalled();
    });

    it('serializes on the invoice with an advisory lock, taken before the totals are read', async () => {
      await service.recordOffline('t-1', dto as any, 'actor-1');

      expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('pg_advisory_xact_lock'),
        expect.any(Number),
      );
      // The lock must precede the invoice read that paidAmount is derived from.
      const lockOrder = prisma.$executeRawUnsafe.mock.invocationCallOrder[0];
      const readOrder = prisma.invoice.findFirst.mock.invocationCallOrder.at(-1);
      expect(lockOrder).toBeLessThan(readOrder);
    });

    it('derives the lock key from the invoice — payments on different invoices do not serialize', async () => {
      await service.recordOffline('t-1', dto as any, 'a-1');
      const keyA = prisma.$executeRawUnsafe.mock.calls[0][1];

      prisma.$executeRawUnsafe.mockClear();
      prisma.invoice.findFirst.mockResolvedValue({ ...invoice, id: 'inv-2' });
      await service.recordOffline('t-1', { ...dto, invoiceId: 'inv-2' } as any, 'a-1');
      const keyB = prisma.$executeRawUnsafe.mock.calls[0][1];

      expect(keyA).not.toEqual(keyB);
      expect(keyA).toBeGreaterThanOrEqual(0);
      expect(keyA).toBeLessThanOrEqual(0x7fffffff);
    });

    it('generates the receipt number with the SAME tx, so its lock spans count -> insert', async () => {
      await service.recordOffline('t-1', dto as any, 'actor-1');
      expect(invoiceService.generateReceiptNumber).toHaveBeenCalledWith('t-1', prisma);
    });

    it('writes nothing when the invoice update fails — the whole settlement rolls back', async () => {
      prisma.invoice.update.mockRejectedValue(new Error('db down'));

      await expect(service.recordOffline('t-1', dto as any, 'actor-1')).rejects.toThrow('db down');
      // Receipt creation is downstream of the failure and must not happen.
      expect(prisma.receipt.create).not.toHaveBeenCalled();
    });

    it('does not emit PAYMENT_SUCCESS when settlement fails', async () => {
      prisma.receipt.create.mockRejectedValue(new Error('receipt failed'));
      const emitter = (service as any).emitter;

      await expect(service.recordOffline('t-1', dto as any, 'actor-1')).rejects.toThrow();
      expect(emitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('verifyRazorpay', () => {
    beforeEach(() => {
      prisma.payment.findFirst.mockResolvedValue({ ...mockPayment });
    });

    it('settles payment, invoice and receipt in ONE locked transaction', async () => {
      await service.verifyRazorpay(
        't-1',
        { razorpayOrderId: 'order_1', razorpayPaymentId: 'rzp_1', razorpaySignature: 'sig' } as any,
        'actor-1',
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('pg_advisory_xact_lock'),
        expect.any(Number),
      );
      expect(prisma.invoice.update).toHaveBeenCalled();
      expect(prisma.receipt.create).toHaveBeenCalled();
    });
  });
});
