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
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import { PaymentService } from './payment.service';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '../../../../core/compliance/audit.service';
import { InvoiceService } from '../../invoice/services/invoice.service';
import { LateFeeService } from '../../late-fee/late-fee.service';
import { PaymentAllocationService } from '../../allocation/services/payment-allocation.service';
import { LedgerService } from '../../ledger/services/ledger.service';

const REAL_SECRET = 'real_secret_for_tests';
const PLACEHOLDER_SECRET = 'rzp_test_xxxxxxxxxx';

const mockPayment = {
  id: 'pay-1',
  tenantId: 't-1',
  invoiceId: 'inv-1',
  amount: 1000,
  status: 'PENDING',
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

  async function buildModule(initialStatus = 'PENDING') {
    // M1: the payment row is stateful in the mock so the compare-and-swap can
    // actually be exercised — updateMany only affects a PENDING row, and the
    // post-write findFirst must observe the swapped state.
    const row: any = { ...mockPayment, status: initialStatus };

    prisma = {
      payment: {
        findFirst: jest.fn().mockImplementation(() => Promise.resolve({ ...row })),
        updateMany: jest.fn().mockImplementation(({ where, data }: any) => {
          if (where.status && row.status !== where.status) return Promise.resolve({ count: 0 });
          if (where.tenantId && row.tenantId !== where.tenantId) return Promise.resolve({ count: 0 });
          Object.assign(row, data);
          return Promise.resolve({ count: 1 });
        }),
        update: jest.fn().mockImplementation(({ data }) => {
          Object.assign(row, data);
          return Promise.resolve({ ...row });
        }),
      },
      receipt: {
        findUnique: jest.fn().mockResolvedValue({ id: 'rcpt-1' }),
      },
      // M10: no default resolved value, deliberately -- matches this
      // describe block's established convention elsewhere (see the
      // branch-scoping tests further down) of each test configuring it
      // explicitly when it needs one. Leaving it unset here preserves the
      // exact prior behavior for every test that doesn't touch it:
      // updateInvoice()'s `if (!inv) return` silently no-ops, same as
      // before this key existed at all.
      invoice: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
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
        { provide: LateFeeService, useValue: { allocatePayment: jest.fn() } },
        { provide: LedgerService, useValue: { recordPaymentCompleted: jest.fn(), recordRefundCompleted: jest.fn() } },
        { provide: PaymentAllocationService, useValue: { record: jest.fn() } },
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
        expect(prisma.payment.updateMany).not.toHaveBeenCalled();
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
      expect(prisma.payment.updateMany).not.toHaveBeenCalled();
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
      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'pay-1',
            tenantId: 't-1',
            status: 'PENDING',
          }),
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

  // ── M1: replay safety ───────────────────────────────────────────────────
  //
  // Every input is deterministic and client-supplied, and the endpoint is
  // PARENT-reachable. Before the compare-and-swap, a replay credited the
  // invoice twice while producing no second receipt.
  describe('replay safety (M1)', () => {
    beforeEach(() => {
      configValues = {
        NODE_ENV: 'production',
        RAZORPAY_STUDENT_KEY_SECRET: REAL_SECRET,
      };
    });

    const signed = () => ({ ...dto, razorpaySignature: validSignature(REAL_SECRET) });

    it('applies the amount exactly once when the same verified payload is replayed', async () => {
      await buildModule();

      await service.verifyRazorpay('t-1', signed() as any, 'actor-1');
      await service.verifyRazorpay('t-1', signed() as any, 'actor-1');

      // The swap ran twice; only the first won, so the money moved once.
      expect(prisma.payment.updateMany).toHaveBeenCalledTimes(2);
      expect((service as any).updateInvoice).toHaveBeenCalledTimes(1);
      expect((service as any).generateReceipt).toHaveBeenCalledTimes(1);
    });

    it('returns the existing settlement on replay instead of erroring', async () => {
      await buildModule();

      const first  = await service.verifyRazorpay('t-1', signed() as any, 'actor-1');
      const second = await service.verifyRazorpay('t-1', signed() as any, 'actor-1');

      expect(second.payment.status).toBe('SUCCESS');
      expect(second.payment.id).toBe(first.payment.id);
      expect(second.receipt).toEqual({ id: 'rcpt-1' });
    });

    it('does not re-audit or re-emit PAYMENT_SUCCESS on replay', async () => {
      await buildModule();
      const audit   = (service as any).audit;
      const emitter = (service as any).emitter;

      await service.verifyRazorpay('t-1', signed() as any, 'actor-1');
      await service.verifyRazorpay('t-1', signed() as any, 'actor-1');

      expect(audit.logPayment).toHaveBeenCalledTimes(1);
      expect(emitter.emit).toHaveBeenCalledTimes(1);
    });

    it('does not allocate late fees a second time on replay', async () => {
      await buildModule();
      const lateFee = (service as any).lateFeeService;

      await service.verifyRazorpay('t-1', signed() as any, 'actor-1');
      await service.verifyRazorpay('t-1', signed() as any, 'actor-1');

      expect(lateFee.allocatePayment).toHaveBeenCalledTimes(1);
    });

    it('posts exactly one PAYMENT_COMPLETED ledger entry, never a second one on replay', async () => {
      await buildModule();
      const ledger = (service as any).ledger;

      await service.verifyRazorpay('t-1', signed() as any, 'actor-1');
      await service.verifyRazorpay('t-1', signed() as any, 'actor-1');

      expect(ledger.recordPaymentCompleted).toHaveBeenCalledTimes(1);
      expect(ledger.recordPaymentCompleted).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ referenceId: 'pay-1' }),
      );
    });

    it('M10: records exactly one INVOICE-targeted PaymentAllocation, never a second one on replay', async () => {
      await buildModule();
      (service as any).updateInvoice.mockRestore(); // buildModule() stubs this out by default; this test needs the real thing
      prisma.invoice.findFirst.mockResolvedValue({
        id: 'inv-1', branchId: 'b-1', paidAmount: 0, totalAmount: 1000, status: 'SENT',
      });
      const allocation = (service as any).allocation;

      await service.verifyRazorpay('t-1', signed() as any, 'actor-1');
      await service.verifyRazorpay('t-1', signed() as any, 'actor-1');

      expect(allocation.record).toHaveBeenCalledTimes(1);
      const call = allocation.record.mock.calls[0][1];
      expect(call.fundingSourceType).toBe('PAYMENT');
      expect(call.fundingSourceId).toBe('pay-1');
      expect(call.chargeType).toBe('INVOICE');
      expect(call.chargeId).toBe('inv-1');
      expect(call.rule).toBe('OLDEST_DUE_FIRST');
      expect(Number(call.amount)).toBe(1000); // Decimal, not a plain number -- compare numerically
    });

    it('never resurrects a FAILED payment — it is not a replay', async () => {
      await buildModule('FAILED');

      await expect(
        service.verifyRazorpay('t-1', signed() as any, 'actor-1'),
      ).rejects.toBeInstanceOf(ConflictException);

      expect((service as any).updateInvoice).not.toHaveBeenCalled();
      expect((service as any).generateReceipt).not.toHaveBeenCalled();
    });

    it('takes the per-invoice advisory lock before attempting the swap', async () => {
      await buildModule();

      await service.verifyRazorpay('t-1', signed() as any, 'actor-1');

      expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('pg_advisory_xact_lock'),
        expect.any(Number),
      );
      const lockOrder = prisma.$executeRawUnsafe.mock.invocationCallOrder[0];
      const swapOrder = prisma.payment.updateMany.mock.invocationCallOrder[0];
      expect(lockOrder).toBeLessThan(swapOrder);
    });

    // Security: the swap predicate carries tenantId, so a payment belonging to
    // another tenant can never be settled even if its gatewayOrderId is known.
    it('the swap predicate is tenant-scoped and cannot cross a tenant boundary', async () => {
      await buildModule();

      await service.verifyRazorpay('t-1', signed() as any, 'actor-1');

      const where = prisma.payment.updateMany.mock.calls[0][0].where;
      expect(where.tenantId).toBe('t-1');
      expect(where.status).toBe('PENDING');
    });
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
        { provide: LateFeeService, useValue: { allocatePayment: jest.fn() } },
        { provide: LedgerService, useValue: { recordPaymentCompleted: jest.fn(), recordRefundCompleted: jest.fn() } },
        { provide: PaymentAllocationService, useValue: { record: jest.fn() } },
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

  // M6 (redesigned roadmap, D-3/D-4): refundState replaces the removed
  // PaymentStatus.REFUNDED/PARTIALLY_REFUNDED values.
  it('attaches a derived refundState to each payment, computed from its own refunds', async () => {
    prisma.invoice.findFirst.mockResolvedValue({ id: 'inv-1' });
    prisma.payment.findMany.mockResolvedValue([
      { id: 'pay-1', amount: 1000, status: 'SUCCESS', refunds: [] },
      { id: 'pay-2', amount: 1000, status: 'SUCCESS', refunds: [{ status: 'COMPLETED', amount: 400 }] },
      { id: 'pay-3', amount: 1000, status: 'SUCCESS', refunds: [{ status: 'COMPLETED', amount: 1000 }] },
    ]);

    const result = await service.getPaymentHistory('t-1', 'inv-1', null);

    expect(result.find((p: any) => p.id === 'pay-1').refundState).toBe('NONE');
    expect(result.find((p: any) => p.id === 'pay-2').refundState).toBe('PARTIAL');
    expect(result.find((p: any) => p.id === 'pay-3').refundState).toBe('FULL');
    // Original payment fields survive the mapping, not just refundState.
    expect(result.find((p: any) => p.id === 'pay-1').status).toBe('SUCCESS');
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
        // M1: verifyRazorpay settles via compare-and-swap. Default to a won
        // swap; the replay path has dedicated coverage in the FEE-0 block.
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      invoice: {
        findFirst: jest.fn().mockResolvedValue({ ...invoice }),
        findUnique: jest.fn().mockResolvedValue({ ...invoice }),
        update: jest.fn().mockResolvedValue({}),
      },
      receipt: {
        // FEE-1: receipt idempotency is keyed on paymentId (Receipt.paymentId
        // @unique), not invoiceId. Default null = no receipt yet for this payment.
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'rcpt-1' }),
      },
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
        { provide: LateFeeService, useValue: { allocatePayment: jest.fn() } },
        { provide: LedgerService, useValue: { recordPaymentCompleted: jest.fn(), recordRefundCompleted: jest.fn() } },
        { provide: PaymentAllocationService, useValue: { record: jest.fn() } },
      ],
    }).compile();
    service = module.get(PaymentService);
  });

  describe('recordOffline', () => {
    const dto = { invoiceId: 'inv-1', amount: 1000, paymentMethod: 'CASH', referenceNumber: 'REF-1', payerName: 'Parent Name' };

    it('creates payment, updates the invoice and writes the receipt in ONE transaction', async () => {
      await service.recordOffline('t-1', dto as any, 'actor-1');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.payment.create).toHaveBeenCalled();
      expect(prisma.invoice.update).toHaveBeenCalled();
      expect(prisma.receipt.create).toHaveBeenCalled();
    });

    // Regression for the PaymentGatewayProvider enum mismatch: gateway
    // MUST be a real enum value (STRIPE | RAZORPAY | CASH). An earlier
    // version wrote 'OFFLINE' -- not a member of that enum -- cast through
    // `as any` to bypass the type check, which then failed at runtime
    // against Prisma's actual constraint. CASH is correct: the same value
    // SaasPaymentService.recordOfflinePayment() already uses for the
    // identical scenario. paymentMethod (a separate, free-text field) is
    // where the specific collection method belongs, not gateway.
    it('writes gateway: CASH, never a value outside PaymentGatewayProvider', async () => {
      await service.recordOffline('t-1', dto as any, 'actor-1');

      const created = (prisma.payment.create as jest.Mock).mock.calls[0][0];
      expect(created.data.gateway).toBe('CASH');
      expect(['STRIPE', 'RAZORPAY', 'CASH']).toContain(created.data.gateway);
    });

    it('computes invoice paid/due in Decimal — no binary-float paise drift (D-9)', async () => {
      // Two independent drift cases in one invoice's arithmetic:
      //  - paid side: 0.10 + 0.20 = 0.30 exactly (float gives 0.30000000000000004)
      //  - due  side: 1000.00 - 0.30 = 999.70 exactly (float subtraction also drifts)
      // Under the old Number() path at least one of these assertions fails.
      prisma.invoice.findFirst.mockResolvedValue({
        ...invoice, totalAmount: 1000, paidAmount: 0.1, dueAmount: 999.9,
      });

      await service.recordOffline('t-1', { ...dto, amount: 0.2 } as any, 'actor-1');

      const data = prisma.invoice.update.mock.calls.at(-1)[0].data;
      expect(data.paidAmount.toString()).toBe('0.3');     // not 0.30000000000000004
      expect(data.dueAmount.toString()).toBe('999.7');    // not 999.6999999999999
      expect(String(data.status)).toBe('PARTIALLY_PAID');
    });

    it('clamps due at zero and marks PAID when a payment covers the invoice exactly', async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        ...invoice, totalAmount: 3000.3, paidAmount: 1000.1, dueAmount: 2000.2,
      });

      await service.recordOffline('t-1', { ...dto, amount: 2000.2 } as any, 'actor-1');

      const data = prisma.invoice.update.mock.calls.at(-1)[0].data;
      expect(data.dueAmount.toString()).toBe('0');
      expect(String(data.status)).toBe('PAID');
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
      // M7: branchId is now the required second argument, sourced from the
      // invoice fetched inside this same transaction (branchId: 'b-1' in
      // the invoice mock above) -- tx (prisma here) remains the third,
      // unchanged from before this fix.
      expect(invoiceService.generateReceiptNumber).toHaveBeenCalledWith('t-1', 'b-1', prisma);
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

// ── FEE-1: receipt ownership is per PAYMENT, not per invoice ───────────────
// Receipt.invoiceId lost its @unique constraint (migration
// 20260722020000_receipt_unique_per_payment); Receipt.paymentId keeps it.
// These tests pin both halves of the resulting rule: a different payment on
// the same invoice gets its own receipt, and the same payment never gets two.
describe('PaymentService.generateReceipt — one receipt per payment (FEE-1)', () => {
  const { Test: T5 } = require('@nestjs/testing');
  let service: any;
  let prisma: any;
  let invoiceService: any;

  const INVOICE = { id: 'inv-1', tenantId: 't-1', branchId: 'b-1', currency: 'INR',
    status: 'SENT', totalAmount: 5000, paidAmount: 0, dueAmount: 5000 };

  // Minimal in-memory Receipt table so "second payment on the same invoice"
  // is exercised against real accumulated state rather than a fixed mock.
  let receipts: any[];

  beforeEach(async () => {
    receipts = [];
    let seq = 0;

    prisma = {
      payment: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockImplementation(({ where }: any) =>
          Promise.resolve({ id: where.id, amount: 2500, currency: 'INR' })),
        create: jest.fn().mockImplementation(() =>
          Promise.resolve({ id: `pay-${++seq}` })),
        update: jest.fn().mockResolvedValue({}),
      },
      invoice: {
        findFirst: jest.fn().mockResolvedValue({ ...INVOICE }),
        findUnique: jest.fn().mockResolvedValue({ ...INVOICE }),
        update: jest.fn().mockResolvedValue({}),
      },
      receipt: {
        // Honours the paymentId unique constraint.
        findUnique: jest.fn().mockImplementation(({ where }: any) =>
          Promise.resolve(receipts.find((r) => r.paymentId === where.paymentId) ?? null)),
        create: jest.fn().mockImplementation(({ data }: any) => {
          if (receipts.some((r) => r.paymentId === data.paymentId)) {
            throw new Error('Unique constraint failed on Receipt.paymentId');
          }
          const row = { id: `rcpt-${receipts.length + 1}`, ...data };
          receipts.push(row);
          return Promise.resolve(row);
        }),
      },
      $transaction: jest.fn((cb: any) => cb(prisma)),
      $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
    };

    // Numbering is unchanged by this commit: still delegated to
    // InvoiceService, still tenant-scoped count()+1, still passed the tx.
    let receiptNo = 0;
    invoiceService = {
      generateReceiptNumber: jest.fn().mockImplementation(() =>
        Promise.resolve(`RCP-2026-${String(++receiptNo).padStart(5, '0')}`)),
    };

    const module = await T5.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { logPayment: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn((k: string, d?: string) =>
            k === 'NODE_ENV' ? 'test' : d) } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: InvoiceService, useValue: invoiceService },
        { provide: LateFeeService, useValue: { allocatePayment: jest.fn() } },
        { provide: LedgerService, useValue: { recordPaymentCompleted: jest.fn(), recordRefundCompleted: jest.fn() } },
        { provide: PaymentAllocationService, useValue: { record: jest.fn() } },
      ],
    }).compile();
    service = module.get(PaymentService);
  });

  const offline = (amount: number, ref: string) =>
    service.recordOffline('t-1', {
      invoiceId: 'inv-1', amount, paymentMethod: 'CASH', referenceNumber: ref, payerName: 'Parent Name',
    } as any, 'actor-1');

  it('two partial payments on the SAME invoice each get their own receipt', async () => {
    await offline(2500, 'REF-1');
    await offline(2500, 'REF-2');

    expect(receipts).toHaveLength(2);
    expect(receipts[0].invoiceId).toBe('inv-1');
    expect(receipts[1].invoiceId).toBe('inv-1');
    // Distinct payments, distinct receipts — the bug was the second payer
    // receiving the first payer's receipt.
    expect(receipts[0].paymentId).not.toBe(receipts[1].paymentId);
    expect(receipts[0].id).not.toBe(receipts[1].id);
  });

  it('a third payment on the same invoice also gets its own receipt', async () => {
    await offline(1000, 'REF-1');
    await offline(1000, 'REF-2');
    await offline(1000, 'REF-3');

    expect(receipts).toHaveLength(3);
    expect(new Set(receipts.map((r) => r.paymentId)).size).toBe(3);
  });

  it('reprocessing the SAME payment reuses the existing receipt — no duplicate', async () => {
    await offline(2500, 'REF-1');
    const [first] = receipts;

    // Same payment id reprocessed (e.g. a retried settlement).
    const again = await (service as any).generateReceipt(
      prisma, 't-1', 'inv-1', first.paymentId,
    );

    expect(again.id).toBe(first.id);
    expect(receipts).toHaveLength(1);
    // The unique constraint was never even reached: the lookup short-circuited.
    expect(prisma.receipt.create).toHaveBeenCalledTimes(1);
  });

  it('idempotency lookup is keyed on paymentId, not invoiceId', async () => {
    await offline(2500, 'REF-1');

    expect(prisma.receipt.findUnique).toHaveBeenCalledWith({
      where: { paymentId: expect.any(String) },
    });
    for (const call of prisma.receipt.findUnique.mock.calls) {
      expect(call[0].where).not.toHaveProperty('invoiceId');
    }
  });

  it('receipt numbering behaviour is unchanged: still delegated to InvoiceService with the tx, one number per receipt', async () => {
    await offline(2500, 'REF-1');
    await offline(2500, 'REF-2');

    expect(invoiceService.generateReceiptNumber).toHaveBeenCalledTimes(2);
    for (const call of invoiceService.generateReceiptNumber.mock.calls) {
      expect(call[0]).toBe('t-1');   // tenant-scoped, as before
      expect(call[1]).toBe('b-1');   // M7: branch-scoped, sourced from the invoice
      expect(call[2]).toBe(prisma);  // still passed the transaction client
    }
    expect(receipts.map((r) => r.receiptNumber)).toEqual([
      'RCP-2026-00001',
      'RCP-2026-00002',
    ]);
  });

  it('a reused receipt consumes no receipt number', async () => {
    await offline(2500, 'REF-1');
    expect(invoiceService.generateReceiptNumber).toHaveBeenCalledTimes(1);

    await (service as any).generateReceipt(prisma, 't-1', 'inv-1', receipts[0].paymentId);

    // Short-circuit happens before numbering, so no number is burned.
    expect(invoiceService.generateReceiptNumber).toHaveBeenCalledTimes(1);
  });
});

// ── FEE-1: offline payment idempotency (IMM-017/018) ──────────────────────
// gatewayPaymentId is the payment's idempotency key, backed by a UNIQUE index
// on (tenantId, invoiceId, gatewayPaymentId). The OFFLINE-${Date.now()}
// fallback is gone: without a supplied reference the key is derived from the
// payment's own business content, so a retry produces the SAME key.
describe('PaymentService.recordOffline — idempotency (FEE-1)', () => {
  const { Test: T6 } = require('@nestjs/testing');
  let service: any;
  let prisma: any;

  const INVOICE = { id: 'inv-1', tenantId: 't-1', branchId: 'b-1', currency: 'INR',
    status: 'SENT', totalAmount: 5000, paidAmount: 0, dueAmount: 5000 };

  function p2002() {
    const e: any = new Error('Unique constraint failed');
    e.code = 'P2002';
    e.meta = { target: ['tenantId', 'invoiceId', 'gatewayPaymentId'] };
    return e;
  }

  beforeEach(async () => {
    prisma = {
      payment: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue({ id: 'pay-1', amount: 1000, currency: 'INR' }),
        create: jest.fn().mockResolvedValue({ id: 'pay-new' }),
        update: jest.fn().mockResolvedValue({}),
      },
      invoice: {
        findFirst: jest.fn().mockResolvedValue({ ...INVOICE }),
        findUnique: jest.fn().mockResolvedValue({ ...INVOICE }),
        update: jest.fn().mockResolvedValue({}),
      },
      receipt: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'rcpt-1' }) },
      $transaction: jest.fn((cb: any) => cb(prisma)),
      $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
    };

    const module = await T6.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { logPayment: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn((k: string, d?: string) => (k === 'NODE_ENV' ? 'test' : d)) } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: InvoiceService, useValue: { generateReceiptNumber: jest.fn().mockResolvedValue('RCP-2026-00001') } },
        { provide: LateFeeService, useValue: { allocatePayment: jest.fn() } },
        { provide: LedgerService, useValue: { recordPaymentCompleted: jest.fn(), recordRefundCompleted: jest.fn() } },
        { provide: PaymentAllocationService, useValue: { record: jest.fn() } },
      ],
    }).compile();
    service = module.get(PaymentService);
  });

  const dto = (over: any = {}) => ({
    invoiceId: 'inv-1', amount: 1000, paymentMethod: 'CASH', payerName: 'Parent Name', ...over,
  });

  describe('key derivation', () => {
    it('uses the cashier-supplied reference verbatim when present', async () => {
      await service.recordOffline('t-1', dto({ referenceNumber: 'CHQ-4471' }), 'a-1');
      expect(prisma.payment.create.mock.calls[0][0].data.gatewayPaymentId).toBe('CHQ-4471');
    });

    it('trims a supplied reference so whitespace cannot defeat the constraint', async () => {
      await service.recordOffline('t-1', dto({ referenceNumber: '  CHQ-4471  ' }), 'a-1');
      expect(prisma.payment.create.mock.calls[0][0].data.gatewayPaymentId).toBe('CHQ-4471');
    });

    it('derives a DETERMINISTIC key when no reference is supplied — never a timestamp', async () => {
      const first = (service as any).offlinePaymentReference('t-1', dto());
      const second = (service as any).offlinePaymentReference('t-1', dto());

      expect(first).toBe(second);              // stable across calls
      expect(first).toMatch(/^OFF-[0-9a-f]{32}$/);
      expect(first).not.toMatch(/\d{13}/);     // no Date.now() epoch embedded
    });

    it('different amount, method, invoice or tenant produce different keys', async () => {
      const base = (service as any).offlinePaymentReference('t-1', dto());
      expect((service as any).offlinePaymentReference('t-1', dto({ amount: 1001 }))).not.toBe(base);
      expect((service as any).offlinePaymentReference('t-1', dto({ paymentMethod: 'CHEQUE' }))).not.toBe(base);
      expect((service as any).offlinePaymentReference('t-1', dto({ invoiceId: 'inv-2' }))).not.toBe(base);
      expect((service as any).offlinePaymentReference('t-2', dto())).not.toBe(base);
    });
  });

  describe('M12: payer identity (D-1)', () => {
    it('rejects when neither payerId nor payerName is provided', async () => {
      await expect(
        service.recordOffline('t-1', dto({ payerName: undefined }), 'a-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it('rejects when BOTH payerId and payerName are provided -- exactly one, not either-or', async () => {
      await expect(
        service.recordOffline('t-1', dto({ payerId: 'guardian-1', payerName: 'Someone' }), 'a-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it('accepts payerName alone and writes it to the created payment', async () => {
      await service.recordOffline('t-1', dto({ payerName: 'Driver Ramesh', payerId: undefined }), 'a-1');
      const created = prisma.payment.create.mock.calls[0][0].data;
      expect(created.payerName).toBe('Driver Ramesh');
      expect(created.payerId).toBeNull();
    });

    it('accepts payerId alone and writes it to the created payment', async () => {
      await service.recordOffline('t-1', dto({ payerId: 'guardian-1', payerName: undefined }), 'a-1');
      const created = prisma.payment.create.mock.calls[0][0].data;
      expect(created.payerId).toBe('guardian-1');
      expect(created.payerName).toBeNull();
    });

    it('validates payer identity BEFORE the invoice lookup -- fails fast, no wasted query', async () => {
      await expect(
        service.recordOffline('t-1', dto({ payerName: undefined }), 'a-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.invoice.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('retry paths', () => {
    it('a sequential retry returns the recorded payment instead of creating a second', async () => {
      const recorded = { id: 'pay-1', amount: 1000, receipt: { id: 'rcpt-1' } };
      prisma.payment.findFirst.mockResolvedValue(recorded);

      const result = await service.recordOffline('t-1', dto({ referenceNumber: 'CHQ-1' }), 'a-1');

      expect(result.payment).toBe(recorded);
      expect(result.receipt).toBe(recorded.receipt);
      expect(prisma.payment.create).not.toHaveBeenCalled();
      expect(prisma.invoice.update).not.toHaveBeenCalled();   // not credited twice
      expect((service as any).ledger.recordPaymentCompleted).not.toHaveBeenCalled();
      expect((service as any).allocation.record).not.toHaveBeenCalled();
    });

    it('a fresh (non-retry) offline payment posts exactly one PAYMENT_COMPLETED ledger entry', async () => {
      const result = await service.recordOffline('t-1', dto({ referenceNumber: 'CHQ-1' }), 'a-1');
      const ledger = (service as any).ledger;

      expect(ledger.recordPaymentCompleted).toHaveBeenCalledTimes(1);
      expect(ledger.recordPaymentCompleted).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ referenceId: result.payment.id }),
      );
    });

    it('M10: a fresh offline payment records exactly one INVOICE-targeted PaymentAllocation', async () => {
      const result = await service.recordOffline('t-1', dto({ referenceNumber: 'CHQ-1' }), 'a-1');
      const allocation = (service as any).allocation;

      expect(allocation.record).toHaveBeenCalledTimes(1);
      const call = allocation.record.mock.calls[0][1];
      expect(call.fundingSourceType).toBe('PAYMENT');
      expect(call.fundingSourceId).toBe(result.payment.id);
      expect(call.chargeType).toBe('INVOICE');
      expect(call.chargeId).toBe('inv-1');
      expect(call.rule).toBe('OLDEST_DUE_FIRST');
      expect(Number(call.amount)).toBe(1000); // Decimal, not a plain number -- compare numerically
    });

    it('the retry check runs BEFORE the due-amount validation', async () => {
      // The first payment already consumed the due amount, so validation would
      // reject the retry with "exceeds due" if it ran first.
      prisma.invoice.findFirst.mockResolvedValue({ ...INVOICE, dueAmount: 0, status: 'PAID' });
      prisma.payment.findFirst.mockResolvedValue({ id: 'pay-1', receipt: { id: 'rcpt-1' } });

      const result = await service.recordOffline('t-1', dto({ referenceNumber: 'CHQ-1' }), 'a-1');
      expect(result.payment.id).toBe('pay-1');
    });

    it('a CONCURRENT retry that reaches the insert is resolved by the unique index (P2002)', async () => {
      // Fast path sees nothing (the winner has not committed yet), the insert
      // then collides; the winner's record is returned.
      const winner = { id: 'pay-winner', receipt: { id: 'rcpt-9' } };
      prisma.payment.findFirst
        .mockResolvedValueOnce(null)      // fast path: not yet visible
        .mockResolvedValueOnce(winner);   // after the collision
      prisma.payment.create.mockRejectedValue(p2002());

      const result = await service.recordOffline('t-1', dto({ referenceNumber: 'CHQ-1' }), 'a-1');

      expect(result.payment).toBe(winner);
      expect(result.receipt).toBe(winner.receipt);
    });

    it('a P2002 with no recoverable winner is rethrown, never swallowed', async () => {
      prisma.payment.findFirst.mockResolvedValue(null);
      prisma.payment.create.mockRejectedValue(p2002());

      await expect(service.recordOffline('t-1', dto(), 'a-1')).rejects.toMatchObject({ code: 'P2002' });
    });

    it('a non-unique-violation error is rethrown untouched', async () => {
      prisma.payment.create.mockRejectedValue(new Error('db down'));
      await expect(service.recordOffline('t-1', dto(), 'a-1')).rejects.toThrow('db down');
    });
  });

  describe('normal recording is unaffected', () => {
    it('records a first-time payment and credits the invoice once', async () => {
      const result = await service.recordOffline('t-1', dto({ referenceNumber: 'CHQ-1' }), 'a-1');

      expect(prisma.payment.create).toHaveBeenCalledTimes(1);
      expect(prisma.invoice.update).toHaveBeenCalledTimes(1);
      expect(result.receipt).toEqual({ id: 'rcpt-1' });
    });

    it('still rejects an over-payment on a genuinely new reference', async () => {
      await expect(
        service.recordOffline('t-1', dto({ amount: 99999, referenceNumber: 'CHQ-2' }), 'a-1'),
      ).rejects.toThrow(/exceeds due/);
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });
  });
});

// M12 (redesigned roadmap, D-1): initiateRazorpay had zero test coverage
// of any kind before this milestone -- confirmed by search, not assumed.
// Scoped here specifically to what M12 actually requires ("payer recorded
// on offline and gateway paths"), not a full initiateRazorpay test suite;
// building exhaustive Razorpay-SDK/config-edge-case coverage would be
// real scope creep beyond this milestone.
describe('PaymentService.initiateRazorpay — payer identity (M12)', () => {
  let service: PaymentService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      invoice: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'inv-1', branchId: 'b-1', status: 'SENT', currency: 'INR', invoiceNumber: 'INV-2026-00001',
        }),
      },
      payment: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'pay-1', ...data })),
      },
    };
    const module = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { logPayment: jest.fn() } },
        // Deliberately empty string: not the ''.includes('xxxxxxxxxx')
        // real-key branch, so initiateRazorpay takes its own
        // "not configured -- mock order" path without needing to mock
        // the Razorpay SDK at all.
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('') } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: InvoiceService, useValue: {} },
        { provide: LateFeeService, useValue: {} },
        { provide: LedgerService, useValue: { recordPaymentCompleted: jest.fn(), recordRefundCompleted: jest.fn() } },
        { provide: PaymentAllocationService, useValue: { record: jest.fn() } },
      ],
    }).compile();
    service = module.get(PaymentService);
  });

  const dto = (over: any = {}) => ({
    invoiceId: 'inv-1', gateway: 'RAZORPAY', amount: 1000, payerName: 'Parent Name', ...over,
  });

  it('rejects when neither payerId nor payerName is provided', async () => {
    await expect(
      service.initiateRazorpay('t-1', dto({ payerName: undefined }) as any, 'actor-1'),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('rejects when BOTH payerId and payerName are provided', async () => {
    await expect(
      service.initiateRazorpay('t-1', dto({ payerId: 'guardian-1' }) as any, 'actor-1'),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('validates payer identity BEFORE the invoice lookup -- fails fast, no wasted query', async () => {
    await expect(
      service.initiateRazorpay('t-1', dto({ payerName: undefined }) as any, 'actor-1'),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.invoice.findFirst).not.toHaveBeenCalled();
  });

  it('accepts payerName alone and writes it to the created payment', async () => {
    await service.initiateRazorpay('t-1', dto({ payerName: 'Driver Ramesh' }) as any, 'actor-1');
    const created = prisma.payment.create.mock.calls[0][0].data;
    expect(created.payerName).toBe('Driver Ramesh');
    expect(created.payerId).toBeNull();
  });

  it('accepts payerId alone and writes it to the created payment', async () => {
    await service.initiateRazorpay('t-1', dto({ payerId: 'guardian-1', payerName: undefined }) as any, 'actor-1');
    const created = prisma.payment.create.mock.calls[0][0].data;
    expect(created.payerId).toBe('guardian-1');
    expect(created.payerName).toBeNull();
  });
});
