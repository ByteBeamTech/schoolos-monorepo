// backend/src/modules/student-billing/fee-heads/services/fee-head.service.spec.ts
import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { FeeHeadService } from './fee-head.service';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '../../../../core/compliance/audit.service';

describe('FeeHeadService', () => {
  let service: FeeHeadService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      feeHead: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'fh-new', ...data })),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, ...data })),
      },
      invoiceItem: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const module = await Test.createTestingModule({
      providers: [
        FeeHeadService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { logCreate: jest.fn(), logUpdate: jest.fn() } },
      ],
    }).compile();
    service = module.get(FeeHeadService);
  });

  describe('create', () => {
    it('creates a root head (no parent) with the given accountingNature', async () => {
      const head = await service.create('t-1', 'b-1', {
        name: 'Academic Fees', code: 'ACADEMIC', accountingNature: 'REVENUE',
      } as any, 'actor-1');

      expect(head.accountingNature).toBe('REVENUE');
      expect(prisma.feeHead.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ tenantId: 't-1', branchId: 'b-1', parentId: null }),
      }));
    });

    it('rejects a duplicate code within the same branch', async () => {
      prisma.feeHead.findFirst.mockResolvedValueOnce({ id: 'fh-existing', code: 'ACADEMIC' });

      await expect(
        service.create('t-1', 'b-1', { name: 'x', code: 'ACADEMIC', accountingNature: 'REVENUE' } as any, 'actor-1'),
      ).rejects.toThrow(ConflictException);
      expect(prisma.feeHead.create).not.toHaveBeenCalled();
    });

    it('allows a child under a ROOT parent (depth 2)', async () => {
      prisma.feeHead.findFirst
        .mockResolvedValueOnce(null)                                   // duplicate-code check
        .mockResolvedValueOnce({ id: 'fh-root', parentId: null });     // parent lookup: root, no parent of its own

      await service.create('t-1', 'b-1', {
        name: 'Exam Fee', code: 'EXAM', accountingNature: 'REVENUE', parentId: 'fh-root',
      } as any, 'actor-1');

      expect(prisma.feeHead.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ parentId: 'fh-root' }),
      }));
    });

    it('rejects a depth-3 hierarchy: the intended parent already has a parent of its own', async () => {
      prisma.feeHead.findFirst
        .mockResolvedValueOnce(null)                                          // duplicate-code check
        .mockResolvedValueOnce({ id: 'fh-child', parentId: 'fh-root' });      // parent lookup: itself a child

      await expect(
        service.create('t-1', 'b-1', {
          name: 'Grandchild', code: 'GC', accountingNature: 'REVENUE', parentId: 'fh-child',
        } as any, 'actor-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.feeHead.create).not.toHaveBeenCalled();
    });

    it('rejects a parent id that does not exist (or belongs to a different tenant/branch)', async () => {
      prisma.feeHead.findFirst
        .mockResolvedValueOnce(null)   // duplicate-code check
        .mockResolvedValueOnce(null);  // parent lookup: not found

      await expect(
        service.create('t-1', 'b-1', {
          name: 'x', code: 'X', accountingNature: 'REVENUE', parentId: 'fh-nonexistent',
        } as any, 'actor-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update — accountingNature immutability (invariant 19)', () => {
    it('permits changing accountingNature when the head has never been referenced by an issued invoice', async () => {
      prisma.feeHead.findFirst.mockResolvedValueOnce({ id: 'fh-1', accountingNature: 'REVENUE' });
      prisma.invoiceItem.findFirst.mockResolvedValueOnce(null); // never referenced by an issued invoice

      const updated = await service.update('t-1', 'b-1', 'fh-1', { accountingNature: 'LIABILITY' } as any, 'actor-1');

      expect(updated.accountingNature).toBe('LIABILITY');
    });

    it('permits changing accountingNature when the only referencing invoices are still DRAFT', async () => {
      prisma.feeHead.findFirst.mockResolvedValueOnce({ id: 'fh-1', accountingNature: 'REVENUE' });
      prisma.invoiceItem.findFirst.mockResolvedValueOnce(null); // the { not: 'DRAFT' } filter finds nothing

      await service.update('t-1', 'b-1', 'fh-1', { accountingNature: 'LIABILITY' } as any, 'actor-1');

      expect(prisma.invoiceItem.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: { feeHeadId: 'fh-1', invoice: { status: { not: 'DRAFT' } } },
      }));
    });

    it('rejects changing accountingNature once referenced by an ISSUED (non-DRAFT) invoice', async () => {
      prisma.feeHead.findFirst.mockResolvedValueOnce({ id: 'fh-1', accountingNature: 'REVENUE' });
      prisma.invoiceItem.findFirst.mockResolvedValueOnce({ id: 'item-1' }); // found: referenced by an issued invoice

      await expect(
        service.update('t-1', 'b-1', 'fh-1', { accountingNature: 'LIABILITY' } as any, 'actor-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.feeHead.update).not.toHaveBeenCalled();
    });

    it('does not check immutability at all when accountingNature is not part of the update', async () => {
      prisma.feeHead.findFirst.mockResolvedValueOnce({ id: 'fh-1', accountingNature: 'REVENUE' });

      await service.update('t-1', 'b-1', 'fh-1', { isActive: false } as any, 'actor-1');

      expect(prisma.invoiceItem.findFirst).not.toHaveBeenCalled();
      expect(prisma.feeHead.update).toHaveBeenCalled();
    });

    it('does not check immutability when accountingNature is present but unchanged from the current value', async () => {
      prisma.feeHead.findFirst.mockResolvedValueOnce({ id: 'fh-1', accountingNature: 'REVENUE' });

      await service.update('t-1', 'b-1', 'fh-1', { accountingNature: 'REVENUE' } as any, 'actor-1');

      expect(prisma.invoiceItem.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('branch scoping', () => {
    it('findAll scopes by tenantId and branchId', async () => {
      await service.findAll('t-1', 'b-1');
      expect(prisma.feeHead.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { tenantId: 't-1', branchId: 'b-1' },
      }));
    });

    it('findById throws NotFoundException for a head outside the caller\'s branch', async () => {
      prisma.feeHead.findFirst.mockResolvedValueOnce(null); // scoped query finds nothing
      await expect(service.findById('t-1', 'b-1', 'fh-other-branch')).rejects.toThrow(NotFoundException);
    });
  });
});
