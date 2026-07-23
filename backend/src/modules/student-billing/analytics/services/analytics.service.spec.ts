// P0: getOverview() had no branch scoping at all -- a branch-restricted
// caller saw tenant-wide financial totals. These tests pin the fix across
// every sub-query the dashboard issues.

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@infra/database/prisma.service';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService.getOverview', () => {
  let service: AnalyticsService;
  let prisma: any;

  const zeroSum = { _sum: {} };

  beforeEach(async () => {
    prisma = {
      invoice: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { totalAmount: 0, paidAmount: 0, dueAmount: 0 } }),
        count: jest.fn().mockResolvedValue(0),
      },
      payment: { aggregate: jest.fn().mockResolvedValue(zeroSum) },
      refund: { aggregate: jest.fn().mockResolvedValue(zeroSum) },
      discount: { aggregate: jest.fn().mockResolvedValue(zeroSum) },
      lateFee: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0, paidAmount: 0, amountWaived: 0 } }) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AnalyticsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(AnalyticsService);
  });

  it('applies no branch filter when authorizedBranchIds is omitted (tenant-wide, backward compatible)', async () => {
    await service.getOverview('t-1');

    for (const mockFn of [
      prisma.invoice.aggregate, prisma.invoice.count,
      prisma.payment.aggregate, prisma.refund.aggregate,
      prisma.discount.aggregate, prisma.lateFee.aggregate,
    ]) {
      const where = mockFn.mock.calls[0][0].where;
      expect(where.branchId).toBeUndefined();
      expect(where.tenantId).toBe('t-1');
    }
  });

  it('applies no branch filter when authorizedBranchIds is explicitly null (tenant-wide role)', async () => {
    await service.getOverview('t-1', null);
    expect(prisma.invoice.aggregate.mock.calls[0][0].where.branchId).toBeUndefined();
  });

  it('scopes every sub-query to the given branches when restricted', async () => {
    await service.getOverview('t-1', ['b-1', 'b-2']);

    for (const mockFn of [
      prisma.invoice.aggregate, prisma.invoice.count,
      prisma.payment.aggregate, prisma.refund.aggregate,
      prisma.discount.aggregate, prisma.lateFee.aggregate,
    ]) {
      expect(mockFn.mock.calls[0][0].where.branchId).toEqual({ in: ['b-1', 'b-2'] });
    }
  });

  it('fails closed: an empty authorized set scopes every sub-query to nothing', async () => {
    await service.getOverview('t-1', []);
    for (const mockFn of [prisma.invoice.aggregate, prisma.payment.aggregate, prisma.lateFee.aggregate]) {
      expect(mockFn.mock.calls[0][0].where.branchId).toEqual({ in: [] });
    }
  });

  it('late-fee figures reflect paidAmount/amountWaived once those are populated (post allocatePayment/waiveLateFee fix)', async () => {
    prisma.lateFee.aggregate.mockResolvedValue({ _sum: { amount: 1000, paidAmount: 600, amountWaived: 100 } });
    const overview = await service.getOverview('t-1');

    expect(overview.lateFeeApplied).toBe(1000);
    expect(overview.lateFeeCollected).toBe(600);
    expect(overview.lateFeeWaived).toBe(100);
    expect(overview.lateFeeOutstanding).toBe(300); // 1000 - 600 - 100
  });
});
