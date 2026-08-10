// FEE-1: compare-and-swap state transitions (IMM-014..016).
//
// Every guarded transition in this module now expresses its precondition as
// the WHERE clause of the update itself, so the check and the write are a
// single atomic statement. These tests drive the CAS through a Prisma mock
// that behaves like a real conditional update -- it only "updates" when the
// row still satisfies the predicate -- so a losing racer genuinely observes
// count === 0 rather than being told so by a stubbed return value.

import { Test } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '../../core/compliance/audit.service';
import { DiscountService } from './discounts/services/discount.service';
import { InvoiceService } from './invoice/services/invoice.service';
import { FeePlanAssignmentService } from './plans/services/fee-plan-assignment.service';
import { LedgerService } from './ledger/services/ledger.service';

/**
 * Minimal conditional-update engine over a single in-memory row. `t.row` is
 * read through the returned object (not captured), so a test can delete the
 * row mid-scenario to simulate it disappearing.
 */
function casTable(initial: any) {
  const t: any = { row: initial };
  t.updateMany = jest.fn(({ where, data }: any) => {
    const row = t.row;
    const matches =
      !!row &&
      Object.entries(where).every(([k, v]: [string, any]) => {
        if (k === 'payments') return (row.payments ?? []).every((p: any) => p.status !== 'SUCCESS');
        if (v && typeof v === 'object' && 'notIn' in v) return !v.notIn.includes(row[k]);
        return row[k] === v;
      });
    if (!matches) return Promise.resolve({ count: 0 });
    Object.assign(row, data);
    return Promise.resolve({ count: 1 });
  });
  t.findFirst = jest.fn(({ select }: any = {}) => {
    const row = t.row;
    if (!row) return Promise.resolve(null);
    if (select?.payments) {
      return Promise.resolve({
        status: row.status,
        payments: (row.payments ?? []).filter((p: any) => p.status === 'SUCCESS'),
      });
    }
    return Promise.resolve({ ...row });
  });
  return t;
}

describe('Discount approval CAS (FEE-1)', () => {
  let service: DiscountService;
  let prisma: any;
  let table: any;
  let approvalUpdates: any[];

  async function build(initialStatus = 'PENDING') {
    table = casTable({ id: 'd-1', tenantId: 't-1', approvalStatus: initialStatus });
    approvalUpdates = [];
    prisma = {
      discount: table,
      discountApproval: {
        updateMany: jest.fn((args: any) => { approvalUpdates.push(args); return Promise.resolve({ count: 1 }); }),
      },
      $transaction: jest.fn((cb: any) => cb(prisma)),
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
    jest.spyOn(service, 'findById').mockResolvedValue({ id: 'd-1' } as any);
  }

  it('approve vs approve: exactly one wins, the loser gets a Conflict', async () => {
    await build();
    await service.approve('t-1', 'd-1', { approvalNote: 'first' } as any, 'actor-1');

    await expect(
      service.approve('t-1', 'd-1', { approvalNote: 'second' } as any, 'actor-2'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(table.row.approvalStatus).toBe('APPROVED');
    // The loser must not have written a decision row.
    expect(approvalUpdates).toHaveLength(1);
    expect(approvalUpdates[0].data.approverId).toBe('actor-1');
  });

  it('approve vs reject: the second decision is refused, first decision stands', async () => {
    await build();
    await service.approve('t-1', 'd-1', { approvalNote: 'ok' } as any, 'actor-1');

    await expect(
      service.reject('t-1', 'd-1', { rejectionNote: 'no' } as any, 'actor-2'),
    ).rejects.toThrow(/already APPROVED/);

    expect(table.row.approvalStatus).toBe('APPROVED');
    expect(approvalUpdates).toHaveLength(1);
  });

  it('reject vs approve: symmetric — first decision stands', async () => {
    await build();
    await service.reject('t-1', 'd-1', { rejectionNote: 'no' } as any, 'actor-1');

    await expect(
      service.approve('t-1', 'd-1', { approvalNote: 'ok' } as any, 'actor-2'),
    ).rejects.toThrow(/already REJECTED/);

    expect(table.row.approvalStatus).toBe('REJECTED');
  });

  it('no pre-read gates the decision: the swap runs before any status read', async () => {
    await build();
    await service.approve('t-1', 'd-1', {} as any, 'actor-1');

    expect(table.updateMany).toHaveBeenCalled();
    // On the success path nothing needed to read the status at all.
    expect(table.findFirst).not.toHaveBeenCalled();
  });

  it('a missing discount is still NotFound, not Conflict', async () => {
    await build();
    table.row = null;
    await expect(
      service.approve('t-1', 'd-1', {} as any, 'a-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rollback: a failure writing the approval row aborts the whole transaction', async () => {
    await build();
    prisma.discountApproval.updateMany.mockRejectedValue(new Error('db down'));

    await expect(service.approve('t-1', 'd-1', {} as any, 'a-1')).rejects.toThrow('db down');
    // The status change and the decision row are in one transaction: the error
    // propagates out of the $transaction callback, so Prisma rolls both back.
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});

describe('Invoice send / cancel CAS (FEE-1)', () => {
  let service: InvoiceService;
  let prisma: any;
  let table: any;
  let emitter: any;

  async function build(row: any) {
    table = casTable(row);
    emitter = { emit: jest.fn() };
    prisma = {
      invoice: table,
      $transaction: jest.fn((cb: any) => cb(prisma)),
    };
    const module = await Test.createTestingModule({
      providers: [
        InvoiceService,
        { provide: FeePlanAssignmentService, useValue: { resolveForClassSection: jest.fn().mockResolvedValue(null) } },
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { logCreate: jest.fn(), logUpdate: jest.fn() } },
        { provide: EventEmitter2, useValue: emitter },
        { provide: LedgerService, useValue: { recordPaymentCompleted: jest.fn(), recordRefundCompleted: jest.fn(), recordLateFeeAssessed: jest.fn(), recordInvoiceIssued: jest.fn() } },
      ],
    }).compile();
    service = module.get(InvoiceService);
  }

  it('send vs send: one wins; the loser gets a Conflict and no duplicate event', async () => {
    await build({ id: 'i-1', tenantId: 't-1', status: 'DRAFT', invoiceNumber: 'INV-1', studentId: 's-1' });

    await service.send('t-1', 'i-1', 'a-1');
    await expect(service.send('t-1', 'i-1', 'a-2')).rejects.toBeInstanceOf(ConflictException);

    expect(table.row.status).toBe('SENT');
    // Duplicate INVOICE_SENT would mean the parent is notified twice.
    expect(emitter.emit).toHaveBeenCalledTimes(1);
  });

  it('send on a non-DRAFT invoice reports the current status', async () => {
    await build({ id: 'i-1', tenantId: 't-1', status: 'PAID', invoiceNumber: 'INV-1' });
    await expect(service.send('t-1', 'i-1', 'a-1')).rejects.toThrow(/already PAID/);
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it('cancel vs cancel: one wins, the loser gets a Conflict', async () => {
    await build({ id: 'i-1', tenantId: 't-1', status: 'SENT', invoiceNumber: 'INV-1', payments: [] });

    await service.cancel('t-1', 'i-1', 'duplicate', 'a-1');
    await expect(service.cancel('t-1', 'i-1', 'duplicate', 'a-2'))
      .rejects.toBeInstanceOf(ConflictException);

    expect(table.row.status).toBe('CANCELLED');
    expect(table.row.dueAmount).toBe(0);
  });

  it('cancel vs a payment that succeeded: refused as a business rule, not a conflict', async () => {
    await build({ id: 'i-1', tenantId: 't-1', status: 'PARTIALLY_PAID', invoiceNumber: 'INV-1',
      payments: [{ id: 'p-1', status: 'SUCCESS' }] });

    await expect(service.cancel('t-1', 'i-1', 'oops', 'a-1'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(table.row.status).toBe('PARTIALLY_PAID');
  });

  it('cancel on a PAID invoice is refused', async () => {
    await build({ id: 'i-1', tenantId: 't-1', status: 'PAID', invoiceNumber: 'INV-1', payments: [] });
    await expect(service.cancel('t-1', 'i-1', 'x', 'a-1')).rejects.toThrow(/paid invoice/i);
  });

  it('a missing invoice is still NotFound on both transitions', async () => {
    await build(null);
    await expect(service.send('t-1', 'i-1', 'a-1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.cancel('t-1', 'i-1', 'x', 'a-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
