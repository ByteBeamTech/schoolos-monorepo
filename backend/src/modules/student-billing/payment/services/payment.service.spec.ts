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
