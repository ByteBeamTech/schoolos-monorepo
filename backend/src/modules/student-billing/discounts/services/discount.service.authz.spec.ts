// FEE-0: branch scoping of discount reads (same contract as invoice/payment).

import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DiscountService } from './discount.service';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '../../../../core/compliance/audit.service';

describe('DiscountService — FEE-0 branch scoping', () => {
  let service: DiscountService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      discount: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    };
    const module = await Test.createTestingModule({
      providers: [
        DiscountService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { logCreate: jest.fn(), logUpdate: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    service = module.get(DiscountService);
  });

  it('findAll: restricted set becomes branchId IN (...) in the query; null adds nothing; [] fails closed', async () => {
    await service.findAll('t-1', {}, ['b-1']);
    expect(prisma.discount.findMany.mock.calls[0][0].where.branchId).toEqual({ in: ['b-1'] });

    await service.findAll('t-1', {}, null);
    expect(prisma.discount.findMany.mock.calls[1][0].where.branchId).toBeUndefined();

    await service.findAll('t-1', {}, []);
    expect(prisma.discount.findMany.mock.calls[2][0].where.branchId).toEqual({ in: [] });
  });

  it('findAll: omitted arg (internal callers) preserves prior tenant-wide behavior', async () => {
    await service.findAll('t-1', {});
    expect(prisma.discount.findMany.mock.calls[0][0].where.branchId).toBeUndefined();
  });

  it('findById: lookup itself is branch-constrained; out-of-branch reads as NotFound', async () => {
    prisma.discount.findFirst.mockResolvedValue({ id: 'd-1' });
    await service.findById('t-1', 'd-1', ['b-1']);
    expect(prisma.discount.findFirst.mock.calls[0][0].where).toMatchObject({
      id: 'd-1', tenantId: 't-1', branchId: { in: ['b-1'] },
    });

    prisma.discount.findFirst.mockResolvedValue(null);
    await expect(service.findById('t-1', 'd-x', ['b-1'])).rejects.toBeInstanceOf(NotFoundException);
  });
});
