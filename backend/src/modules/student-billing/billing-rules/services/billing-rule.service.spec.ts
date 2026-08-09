// backend/src/modules/student-billing/billing-rules/services/billing-rule.service.spec.ts

import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BillingRuleService } from './billing-rule.service';
import { PrismaService } from '@infra/database/prisma.service';

describe('BillingRuleService', () => {
  let service: BillingRuleService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      billingRule: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'br-new', ...data })),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
      },
      branch: {
        findFirst: jest.fn().mockResolvedValue({ id: 'bA' }),
      },
    };
    const module = await Test.createTestingModule({
      providers: [BillingRuleService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(BillingRuleService);
  });

  it('creates a tenant-wide rule (branchId null) when none is supplied', async () => {
    const rule = await service.create('t-1', {
      frequency: 'MONTHLY', billingMonths: [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3], dueDayOfMonth: 5,
    } as any);
    expect(rule.branchId).toBeNull();
    expect(prisma.branch.findFirst).not.toHaveBeenCalled();
  });

  it('creates a branch-scoped rule when branchId is supplied and belongs to the tenant', async () => {
    const rule = await service.create('t-1', {
      frequency: 'MONTHLY', billingMonths: [4], dueDayOfMonth: 5, branchId: 'bA',
    } as any);
    expect(rule.branchId).toBe('bA');
    expect(prisma.branch.findFirst).toHaveBeenCalledWith({ where: { id: 'bA', tenantId: 't-1' } });
  });

  it('rejects a branchId that does not belong to the same tenant', async () => {
    prisma.branch.findFirst.mockResolvedValue(null);
    await expect(service.create('t-1', {
      frequency: 'MONTHLY', billingMonths: [4], dueDayOfMonth: 5, branchId: 'bOtherTenant',
    } as any)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.billingRule.create).not.toHaveBeenCalled();
  });

  it('creates a rule with the given frequency/billingMonths/dueDayOfMonth, defaulting prorationRule to NO_PRORATION', async () => {
    const rule = await service.create('t-1', {
      frequency: 'MONTHLY', billingMonths: [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3], dueDayOfMonth: 5,
    } as any);

    expect(rule.tenantId).toBe('t-1');
    expect(rule.frequency).toBe('MONTHLY');
    expect(rule.prorationRule).toBe('NO_PRORATION');
  });

  it('respects an explicit prorationRule when given', async () => {
    const rule = await service.create('t-1', {
      frequency: 'ONE_TIME', billingMonths: [4], dueDayOfMonth: 1, prorationRule: 'DAILY',
    } as any);
    expect(rule.prorationRule).toBe('DAILY');
  });

  it('findById 404s for a rule in a different tenant', async () => {
    prisma.billingRule.findFirst.mockResolvedValue(null);
    await expect(service.findById('t-1', 'br-x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('has no update or supersede method -- create-only by design, not by omission', () => {
    expect((service as any).update).toBeUndefined();
    expect((service as any).supersede).toBeUndefined();
  });
});
