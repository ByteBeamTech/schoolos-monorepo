// FEE-0 (Security Hardening): branch scoping of invoice reads.
// Invariants exercised: AUTH-041 (default deny at endpoint level — see the
// companion controller spec), AUTH-052/058 via the authorizedBranchIds
// contract (null = tenant-wide, [] = nothing, fail closed), and the
// out-of-scope-reads-as-404 anti-probing behavior.

import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InvoiceService } from './invoice.service';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '../../../../core/compliance/audit.service';
import { LedgerService } from '../../ledger/services/ledger.service';
import { FeePlanAssignmentService } from '../../plans/services/fee-plan-assignment.service';

describe('InvoiceService — FEE-0 branch scoping', () => {
  let service: InvoiceService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      invoice: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const module = await Test.createTestingModule({
      providers: [
        InvoiceService,
        { provide: FeePlanAssignmentService, useValue: { resolveForClassSection: jest.fn().mockResolvedValue(null) } },
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { logCreate: jest.fn(), logUpdate: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: LedgerService, useValue: { recordPaymentCompleted: jest.fn(), recordRefundCompleted: jest.fn(), recordLateFeeAssessed: jest.fn(), recordInvoiceIssued: jest.fn() } },
      ],
    }).compile();
    service = module.get(InvoiceService);
  });

  describe('findAll', () => {
    it('tenant-wide callers (null) get no branch filter — tenantId only', async () => {
      await service.findAll('t-1', {}, 1, 20, null);
      const where = prisma.invoice.findMany.mock.calls[0][0].where;
      expect(where.tenantId).toBe('t-1');
      expect(where.branchId).toBeUndefined();
    });

    it('restricted callers get branchId IN (their set) — in the query, not post-filtered', async () => {
      await service.findAll('t-1', {}, 1, 20, ['b-1', 'b-2']);
      const where = prisma.invoice.findMany.mock.calls[0][0].where;
      expect(where.branchId).toEqual({ in: ['b-1', 'b-2'] });
      // count() must use the identical where — otherwise pagination leaks size info.
      expect(prisma.invoice.count.mock.calls[0][0].where).toEqual(where);
    });

    it('an empty authorized set matches nothing (fail closed, AUTH-047)', async () => {
      await service.findAll('t-1', {}, 1, 20, []);
      const where = prisma.invoice.findMany.mock.calls[0][0].where;
      expect(where.branchId).toEqual({ in: [] });
    });

    it('omitted arg (internal callers) preserves prior tenant-wide behavior', async () => {
      await service.findAll('t-1', {});
      const where = prisma.invoice.findMany.mock.calls[0][0].where;
      expect(where.branchId).toBeUndefined();
    });
  });

  describe('findById', () => {
    it('scopes the lookup itself by branch set', async () => {
      prisma.invoice.findFirst.mockResolvedValue({ id: 'inv-1' });
      await service.findById('t-1', 'inv-1', ['b-1']);
      const where = prisma.invoice.findFirst.mock.calls[0][0].where;
      expect(where).toMatchObject({ id: 'inv-1', tenantId: 't-1', branchId: { in: ['b-1'] } });
    });

    it('an out-of-branch invoice reads as NotFound — indistinguishable from nonexistent', async () => {
      prisma.invoice.findFirst.mockResolvedValue(null);
      await expect(service.findById('t-1', 'inv-other-branch', ['b-1']))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    it('tenant-wide callers (null) keep tenant-only lookup', async () => {
      prisma.invoice.findFirst.mockResolvedValue({ id: 'inv-1' });
      await service.findById('t-1', 'inv-1', null);
      const where = prisma.invoice.findFirst.mock.calls[0][0].where;
      expect(where.branchId).toBeUndefined();
    });
  });
});

// ── FEE-0 item 2: getDefaulters() AUTH-054 (intersect, never widen) ─────────
describe('InvoiceService.getDefaulters — AUTH-054 branch intersection', () => {
  const { Test: T2 } = require('@nestjs/testing');
  const { ForbiddenException } = require('@nestjs/common');
  let service: any;
  let prisma: any;

  beforeEach(async () => {
    prisma = { invoice: { findMany: jest.fn().mockResolvedValue([]) } };
    const module = await T2.createTestingModule({
      providers: [
        InvoiceService,
        { provide: FeePlanAssignmentService, useValue: { resolveForClassSection: jest.fn().mockResolvedValue(null) } },
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { logCreate: jest.fn(), logUpdate: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: LedgerService, useValue: { recordPaymentCompleted: jest.fn(), recordRefundCompleted: jest.fn(), recordLateFeeAssessed: jest.fn(), recordInvoiceIssued: jest.fn() } },
      ],
    }).compile();
    service = module.get(InvoiceService);
  });

  it('a client branchId outside a restricted caller set DENIES (403) — no silent fallback, no query', async () => {
    await expect(
      service.getDefaulters('t-1', { branchId: 'b-other' }, ['b-1']),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.invoice.findMany).not.toHaveBeenCalled();
  });

  it('a client branchId inside the set selects within it — both constraints present in the query', async () => {
    await service.getDefaulters('t-1', { branchId: 'b-1' }, ['b-1', 'b-2']);
    const where = prisma.invoice.findMany.mock.calls[0][0].where;
    expect(where.branchId).toEqual({ in: ['b-1', 'b-2'] });
    expect(where.student).toEqual({ branchId: 'b-1' });
  });

  it('no client branchId: restricted caller is scoped to their whole set', async () => {
    await service.getDefaulters('t-1', {}, ['b-1', 'b-2']);
    const where = prisma.invoice.findMany.mock.calls[0][0].where;
    expect(where.branchId).toEqual({ in: ['b-1', 'b-2'] });
    expect(where.student).toBeUndefined();
  });

  it('tenant-wide caller (null) may select any branch as a narrowing filter', async () => {
    await service.getDefaulters('t-1', { branchId: 'b-77' }, null);
    const where = prisma.invoice.findMany.mock.calls[0][0].where;
    expect(where.branchId).toBeUndefined();
    expect(where.student).toEqual({ branchId: 'b-77' });
  });

  it('empty authorized set matches nothing (fail closed, AUTH-047)', async () => {
    await service.getDefaulters('t-1', {}, []);
    const where = prisma.invoice.findMany.mock.calls[0][0].where;
    expect(where.branchId).toEqual({ in: [] });
  });
});
