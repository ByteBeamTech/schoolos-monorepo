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

// ── FEE-1: category resolution in create() ─────────────────────────────────
// dto.category is a CODE; Discount.categoryId is an FK to DiscountCategory.id.
// Resolution must look the row up per branch and REJECT when it is absent --
// never create it (financial master data is not created as a side effect of a
// transactional write).
describe('DiscountService.create — category resolution (FEE-1)', () => {
  const { Test: T3 } = require('@nestjs/testing');
  const { BadRequestException, NotFoundException } = require('@nestjs/common');
  let service: any;
  let prisma: any;

  const dto = {
    studentId: 's-1',
    category: 'SIBLING',
    type: 'FIXED',
    value: 500,
    validFrom: '2026-04-01',
  };

  beforeEach(async () => {
    prisma = {
      student: { findFirst: jest.fn().mockResolvedValue({ id: 's-1', branchId: 'b-1' }) },
      academicSession: { findFirst: jest.fn().mockResolvedValue({ id: 'sess-1' }) },
      discountCategory: {
        findUnique: jest.fn().mockResolvedValue({ id: 'dcat-1', isActive: true }),
        create: jest.fn(),
        createMany: jest.fn(),
        upsert: jest.fn(),
      },
      discount: { create: jest.fn().mockResolvedValue({ id: 'disc-1' }) },
      discountApproval: { create: jest.fn().mockResolvedValue({ id: 'appr-1' }) },
    };
    const module = await T3.createTestingModule({
      providers: [
        DiscountService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { logCreate: jest.fn(), logUpdate: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    service = module.get(DiscountService);
  });

  it('resolves the category by (branchId, code) and stores the FK id, not the code', async () => {
    await service.create('t-1', dto, 'actor-1');

    expect(prisma.discountCategory.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { branchId_code: { branchId: 'b-1', code: 'SIBLING' } },
      }),
    );
    const written = prisma.discount.create.mock.calls[0][0].data;
    expect(written.categoryId).toBe('dcat-1');
    expect(written.categoryId).not.toBe('SIBLING');
  });

  it('resolves against the STUDENT\'s branch, not a client-supplied one', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 's-1', branchId: 'b-99' });
    await service.create('t-1', { ...dto, branchId: 'b-1' } as any, 'actor-1');
    expect(prisma.discountCategory.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { branchId_code: { branchId: 'b-99', code: 'SIBLING' } },
      }),
    );
  });

  it('rejects with a validation error when the branch has no such category', async () => {
    prisma.discountCategory.findUnique.mockResolvedValue(null);

    await expect(service.create('t-1', dto, 'actor-1')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create('t-1', dto, 'actor-1')).rejects.toThrow(/not configured for this branch/);
  });

  it('NEVER creates a category as a side effect — not even when one is missing', async () => {
    prisma.discountCategory.findUnique.mockResolvedValue(null);

    await expect(service.create('t-1', dto, 'actor-1')).rejects.toThrow();

    expect(prisma.discountCategory.create).not.toHaveBeenCalled();
    expect(prisma.discountCategory.createMany).not.toHaveBeenCalled();
    expect(prisma.discountCategory.upsert).not.toHaveBeenCalled();
  });

  it('writes no discount or approval row when resolution fails', async () => {
    prisma.discountCategory.findUnique.mockResolvedValue(null);

    await expect(service.create('t-1', dto, 'actor-1')).rejects.toThrow();

    expect(prisma.discount.create).not.toHaveBeenCalled();
    expect(prisma.discountApproval.create).not.toHaveBeenCalled();
  });

  it('rejects a disabled category with a distinct message', async () => {
    prisma.discountCategory.findUnique.mockResolvedValue({ id: 'dcat-1', isActive: false });

    await expect(service.create('t-1', dto, 'actor-1')).rejects.toThrow(/disabled for this branch/);
    expect(prisma.discount.create).not.toHaveBeenCalled();
  });

  it('still validates the student before touching categories', async () => {
    prisma.student.findFirst.mockResolvedValue(null);

    await expect(service.create('t-1', dto, 'actor-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.discountCategory.findUnique).not.toHaveBeenCalled();
  });
});
