// backend/src/modules/student-billing/plans/services/fee-plans.service.phase2.spec.ts
//
// Phase 2 additions only -- create()'s existing (pre-Phase-2) behaviour is
// covered by the controller authz spec's ownership tests and is unchanged
// in substance here beyond no longer inlining feeItems, which this file's
// own createFeeItem tests exist specifically to prove works as its own
// explicit step.

import { Test } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { FeePlansService } from './fee-plans.service';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '../../../../core/compliance/audit.service';

describe('FeePlansService — Phase 2: createFeeItem / supersedeFeeItem', () => {
  let service: FeePlansService;
  let prisma: any;
  let audit: any;

  beforeEach(async () => {
    prisma = {
      feePlan: { findFirst: jest.fn() },
      feeHead: { findFirst: jest.fn() },
      billingRule: { findFirst: jest.fn() },
      feeItem: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'fi-new', ...data })),
        update: jest.fn().mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, ...data })),
        findFirst: jest.fn(),
      },
      $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
    };
    audit = { logCreate: jest.fn(), logUpdate: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        FeePlansService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = module.get(FeePlansService);
  });

  describe('createFeeItem', () => {
    const dto = { name: 'Tuition', amount: 5000, feeHeadId: 'fh-1', billingRuleId: 'br-1' } as any;

    it('404s when the target plan does not exist in this tenant/branch', async () => {
      prisma.feePlan.findFirst.mockResolvedValue(null);
      await expect(service.createFeeItem('t-1', 'b-1', 'fp-1', dto, 'u-1')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.feeItem.create).not.toHaveBeenCalled();
    });

    it('404s when the fee head does not belong to the same branch as the plan', async () => {
      prisma.feePlan.findFirst.mockResolvedValue({ id: 'fp-1' });
      prisma.feeHead.findFirst.mockResolvedValue(null);
      await expect(service.createFeeItem('t-1', 'b-1', 'fp-1', dto, 'u-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404s when the billing rule does not exist in this tenant', async () => {
      prisma.feePlan.findFirst.mockResolvedValue({ id: 'fp-1' });
      prisma.feeHead.findFirst.mockResolvedValue({ id: 'fh-1' });
      prisma.billingRule.findFirst.mockResolvedValue(null);
      await expect(service.createFeeItem('t-1', 'b-1', 'fp-1', dto, 'u-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('creates the item with feeHeadId/billingRuleId set and an effectiveFrom timestamp -- closing the original gap this whole redesign traces back to', async () => {
      prisma.feePlan.findFirst.mockResolvedValue({ id: 'fp-1' });
      prisma.feeHead.findFirst.mockResolvedValue({ id: 'fh-1' });
      prisma.billingRule.findFirst.mockResolvedValue({ id: 'br-1' });

      const item = await service.createFeeItem('t-1', 'b-1', 'fp-1', dto, 'u-1');

      expect(item.feeHeadId).toBe('fh-1');
      expect(item.billingRuleId).toBe('br-1');
      expect(item.effectiveFrom).toBeInstanceOf(Date);
      expect(audit.logCreate).toHaveBeenCalled();
    });
  });

  describe('supersedeFeeItem', () => {
    const existing = { id: 'fi-1', feePlanId: 'fp-1', feeHeadId: 'fh-1', name: 'Tuition', amount: 5000, isOptional: false, sortOrder: 0 };
    const supersedeDto = { name: 'Tuition (revised)', amount: 5500, feeHeadId: 'fh-1', billingRuleId: 'br-2' } as any;

    it('404s when the fee item does not exist in this tenant/branch', async () => {
      prisma.feeItem.findFirst.mockResolvedValue(null);
      await expect(service.supersedeFeeItem('t-1', 'b-1', 'fi-1', supersedeDto, 'u-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a supersede that tries to change the feeHeadId -- that is a new item, not a revision of this one', async () => {
      prisma.feeItem.findFirst.mockResolvedValue(existing);
      const changedHeadDto = { ...supersedeDto, feeHeadId: 'fh-DIFFERENT' };
      await expect(service.supersedeFeeItem('t-1', 'b-1', 'fi-1', changedHeadDto, 'u-1')).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('404s when the new billing rule does not exist', async () => {
      prisma.feeItem.findFirst.mockResolvedValue(existing);
      prisma.billingRule.findFirst.mockResolvedValue(null);
      await expect(service.supersedeFeeItem('t-1', 'b-1', 'fi-1', supersedeDto, 'u-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('sets effectiveUntil on the old row and creates a new row in one transaction -- never mutates the existing row in place', async () => {
      prisma.feeItem.findFirst.mockResolvedValue(existing);
      prisma.billingRule.findFirst.mockResolvedValue({ id: 'br-2' });

      const result = await service.supersedeFeeItem('t-1', 'b-1', 'fi-1', supersedeDto, 'u-1');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const [updateCall, createCall] = prisma.$transaction.mock.calls[0][0];
      expect(prisma.feeItem.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'fi-1' },
        data: { effectiveUntil: expect.any(Date) },
      }));
      expect(prisma.feeItem.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ name: 'Tuition (revised)', amount: 5500, billingRuleId: 'br-2' }),
      }));
      expect(result.name).toBe('Tuition (revised)');
      expect(audit.logUpdate).toHaveBeenCalled();
    });
  });

  describe('createFeeItem — branch scoping (corrective fix)', () => {
    // Realistic in-memory BillingRule set, filtered by an actual
    // implementation of the OR-based where clause the service issues --
    // not a canned mock return value. This is what makes these tests a
    // real proof of the scoping rule, not just an assertion that some
    // value was returned.
    const rules = [
      { id: 'br-tenant-wide', tenantId: 't-1', branchId: null },
      { id: 'br-branchA',     tenantId: 't-1', branchId: 'bA' },
      { id: 'br-branchB',     tenantId: 't-1', branchId: 'bB' },
      { id: 'br-other-tenant', tenantId: 't-2', branchId: null },
    ];

    beforeEach(() => {
      prisma.feePlan.findFirst.mockResolvedValue({ id: 'fp-1' });
      prisma.feeHead.findFirst.mockResolvedValue({ id: 'fh-1' });
      prisma.billingRule.findFirst.mockImplementation(({ where }: any) => {
        const match = rules.find((r) =>
          r.id === where.id &&
          r.tenantId === where.tenantId &&
          where.OR.some((cond: any) => r.branchId === cond.branchId),
        );
        return Promise.resolve(match ?? null);
      });
    });

    it('a tenant-wide BillingRule (branchId null) can be used by any branch of the same tenant', async () => {
      const dtoA = { name: 'Tuition', amount: 5000, feeHeadId: 'fh-1', billingRuleId: 'br-tenant-wide' } as any;
      await expect(service.createFeeItem('t-1', 'bA', 'fp-1', dtoA, 'u-1')).resolves.toBeDefined();

      const dtoB = { name: 'Tuition', amount: 5000, feeHeadId: 'fh-1', billingRuleId: 'br-tenant-wide' } as any;
      await expect(service.createFeeItem('t-1', 'bB', 'fp-1', dtoB, 'u-1')).resolves.toBeDefined();
    });

    it('a Branch A rule cannot be used by Branch B', async () => {
      const dto = { name: 'Tuition', amount: 5000, feeHeadId: 'fh-1', billingRuleId: 'br-branchA' } as any;
      await expect(service.createFeeItem('t-1', 'bB', 'fp-1', dto, 'u-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('a Branch A rule CAN be used by Branch A itself', async () => {
      const dto = { name: 'Tuition', amount: 5000, feeHeadId: 'fh-1', billingRuleId: 'br-branchA' } as any;
      await expect(service.createFeeItem('t-1', 'bA', 'fp-1', dto, 'u-1')).resolves.toBeDefined();
    });

    it('another tenant\'s BillingRule can never be used, regardless of branch', async () => {
      const dto = { name: 'Tuition', amount: 5000, feeHeadId: 'fh-1', billingRuleId: 'br-other-tenant' } as any;
      await expect(service.createFeeItem('t-1', 'bA', 'fp-1', dto, 'u-1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
