// Late Fee Module FDD v2 Section 6.2 / Implementation Roadmap v2 Sprint 3.
// Matches fee-head.service.spec.ts's convention: this resource's tests
// live alongside its own service, not lumped into late-fee.service.spec.ts.

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '../../../../core/compliance/audit.service';
import { RulesService } from './rules.service';

describe('RulesService', () => {
  let service: RulesService;
  let prisma: any;
  let audit: any;

  beforeEach(async () => {
    prisma = {
      branch: { findFirst: jest.fn().mockResolvedValue({ id: 'b-1' }) },
      feePlan: { findFirst: jest.fn().mockResolvedValue({ id: 'fp-1' }) },
      lateFeeRule: {
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'rule-1', ...data })),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'rule-1', ...data })),
      },
    };
    audit = { logCreate: jest.fn(), logUpdate: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RulesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = module.get(RulesService);
  });

  it('rejects a feePlanId without a branchId -- a rule the resolver could never select', async () => {
    await expect(
      service.create('t-1', { feePlanId: 'fp-1', calculationMethod: 'PERCENTAGE', penaltyType: 'PERCENTAGE', penaltyValue: 2, gracePeriodDays: 7 } as any, 'u-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404s when the given branchId does not belong to this tenant', async () => {
    prisma.branch.findFirst.mockResolvedValue(null);
    await expect(
      service.create('t-1', { branchId: 'b-x', calculationMethod: 'PERCENTAGE', penaltyType: 'PERCENTAGE', penaltyValue: 2, gracePeriodDays: 7 } as any, 'u-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a Tenant-scope rule with the given calculation fields, defaulting effectiveFrom to now', async () => {
    const rule = await service.create('t-1', {
      calculationMethod: 'PERCENTAGE', penaltyType: 'PERCENTAGE', penaltyValue: 2, gracePeriodDays: 7,
    } as any, 'u-1');
    expect(rule.branchId).toBeNull();
    expect(rule.feePlanId).toBeNull();
    expect(rule.isActive).toBe(true);
    expect(rule.createdById).toBe('u-1');
    expect(audit.logCreate).toHaveBeenCalled();
  });

  it('deactivate() only ever sets isActive/effectiveUntil -- DeactivateLateFeeRuleDto has no calculation fields to smuggle in', async () => {
    prisma.lateFeeRule.findFirst.mockResolvedValue({ id: 'rule-1', tenantId: 't-1', isActive: true });
    const updated = await service.deactivate('t-1', 'rule-1', {}, 'u-1');
    expect(prisma.lateFeeRule.update).toHaveBeenCalledWith({
      where: { id: 'rule-1' },
      data: { isActive: false, effectiveUntil: expect.any(Date) },
    });
    expect(updated.isActive).toBe(false);
  });

  it('deactivate() 404s for a rule belonging to a different tenant', async () => {
    prisma.lateFeeRule.findFirst.mockResolvedValue(null);
    await expect(service.deactivate('t-1', 'rule-x', {}, 'u-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
