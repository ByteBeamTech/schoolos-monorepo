// backend/src/modules/student-billing/ledger/services/ledger.service.spec.ts
//
// M2 (redesigned roadmap). LedgerService is the enforced single write path
// per §4.9 -- these tests cover what it actually writes, not just that it
// doesn't throw. The two posting-service specs (payment.service.spec.ts,
// refund.service.spec.ts) separately cover WHEN each method gets called
// (replay safety, exactly-once); this file covers WHAT gets written.

import { LedgerService } from './ledger.service';

describe('LedgerService', () => {
  let service: LedgerService;
  let tx: any;

  beforeEach(() => {
    service = new LedgerService();
    tx = { ledger: { create: jest.fn().mockResolvedValue({}) } };
  });

  describe('recordPaymentCompleted', () => {
    it('writes eventType PAYMENT_COMPLETED with referenceType Payment', async () => {
      await service.recordPaymentCompleted(tx, {
        tenantId: 't-1', branchId: 'b-1', studentId: 's-1',
        occurredAt: new Date('2026-06-15T00:00:00Z'),
        amount: 5000, referenceId: 'pay-1',
      });

      const written = tx.ledger.create.mock.calls[0][0].data;
      expect(written.eventType).toBe('PAYMENT_COMPLETED');
      expect(written.referenceType).toBe('Payment');
      expect(written.referenceId).toBe('pay-1');
      expect(written.amount).toBe(5000);
    });

    it('derives financialYear from occurredAt using the shared FY boundary, not the calendar year', async () => {
      await service.recordPaymentCompleted(tx, {
        tenantId: 't-1', branchId: 'b-1',
        occurredAt: new Date('2027-01-15T00:00:00Z'), // calendar 2027, FY 2026
        amount: 100, referenceId: 'pay-1',
      });

      expect(tx.ledger.create.mock.calls[0][0].data.financialYear).toBe(2026);
    });

    it('accepts a null studentId for a fact that is not student-scoped', async () => {
      await service.recordPaymentCompleted(tx, {
        tenantId: 't-1', branchId: 'b-1', studentId: null,
        occurredAt: new Date(), amount: 100, referenceId: 'pay-1',
      });

      expect(tx.ledger.create.mock.calls[0][0].data.studentId).toBeNull();
    });

    it('writes through the given transaction client, not a fresh connection', async () => {
      const otherTx = { ledger: { create: jest.fn().mockResolvedValue({}) } };

      await service.recordPaymentCompleted(tx, {
        tenantId: 't-1', branchId: 'b-1', occurredAt: new Date(),
        amount: 100, referenceId: 'pay-1',
      });

      expect(tx.ledger.create).toHaveBeenCalledTimes(1);
      expect(otherTx.ledger.create).not.toHaveBeenCalled();
    });

    it('passes metadata through untouched, as the append-only extension point (§4.8)', async () => {
      await service.recordPaymentCompleted(tx, {
        tenantId: 't-1', branchId: 'b-1', occurredAt: new Date(),
        amount: 100, referenceId: 'pay-1',
        metadata: { gateway: 'RAZORPAY', invoiceId: 'inv-1' },
      });

      expect(tx.ledger.create.mock.calls[0][0].data.metadata).toEqual({
        gateway: 'RAZORPAY', invoiceId: 'inv-1',
      });
    });
  });

  describe('recordRefundCompleted', () => {
    it('writes eventType REFUND_COMPLETED with referenceType Refund', async () => {
      await service.recordRefundCompleted(tx, {
        tenantId: 't-1', branchId: 'b-1',
        occurredAt: new Date('2026-06-15T00:00:00Z'),
        amount: 1200, referenceId: 'ref-1',
      });

      const written = tx.ledger.create.mock.calls[0][0].data;
      expect(written.eventType).toBe('REFUND_COMPLETED');
      expect(written.referenceType).toBe('Refund');
      expect(written.referenceId).toBe('ref-1');
    });
  });

  describe('recordLateFeeAssessed', () => {
    it('writes eventType LATE_FEE_ASSESSED with referenceType LateFee', async () => {
      await service.recordLateFeeAssessed(tx, {
        tenantId: 't-1', branchId: 'b-1', studentId: 's-1',
        occurredAt: new Date('2026-06-15T00:00:00Z'),
        amount: 250, referenceId: 'lf-1',
      });

      const written = tx.ledger.create.mock.calls[0][0].data;
      expect(written.eventType).toBe('LATE_FEE_ASSESSED');
      expect(written.referenceType).toBe('LateFee');
      expect(written.referenceId).toBe('lf-1');
      expect(written.amount).toBe(250);
    });

    it('derives financialYear from occurredAt using the same shared FY boundary as the other event types', async () => {
      await service.recordLateFeeAssessed(tx, {
        tenantId: 't-1', branchId: 'b-1',
        occurredAt: new Date('2026-03-31T23:59:59Z'), // FY 2025, not calendar 2026
        amount: 50, referenceId: 'lf-1',
      });

      expect(tx.ledger.create.mock.calls[0][0].data.financialYear).toBe(2025);
    });
  });

  describe('recordInvoiceIssued', () => {
    it('writes eventType INVOICE_ISSUED with referenceType Invoice', async () => {
      await service.recordInvoiceIssued(tx, {
        tenantId: 't-1', branchId: 'b-1', studentId: 's-1',
        occurredAt: new Date('2026-06-15T00:00:00Z'),
        amount: 12360, referenceId: 'inv-1',
      });

      const written = tx.ledger.create.mock.calls[0][0].data;
      expect(written.eventType).toBe('INVOICE_ISSUED');
      expect(written.referenceType).toBe('Invoice');
      expect(written.referenceId).toBe('inv-1');
      expect(written.amount).toBe(12360);
    });
  });

  // Invariant 12 / IMM-009 / IMM-010: enforced by absence, not convention.
  it('exposes no update or delete method', () => {
    expect((service as any).update).toBeUndefined();
    expect((service as any).delete).toBeUndefined();
    expect((service as any).remove).toBeUndefined();
  });
});
