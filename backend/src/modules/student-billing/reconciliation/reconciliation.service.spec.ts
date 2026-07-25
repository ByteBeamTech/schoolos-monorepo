// modules/student-billing/reconciliation/reconciliation.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@infra/database/prisma.service';
import { ReconciliationService } from './reconciliation.service';

describe('ReconciliationService', () => {
  let service: ReconciliationService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      student: {
        findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'stu-1', firstName: 'A', lastName: 'B' }),
      },
      invoice: {
        findMany:  jest.fn().mockResolvedValue([]),
        aggregate: jest.fn(),
        count:     jest.fn().mockResolvedValue(0),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconciliationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(ReconciliationService);
  });

  describe('getStudentReconciliation', () => {
    it('scopes the invoice read and the student lookup to the tenant', async () => {
      await service.getStudentReconciliation('t-1', 'stu-1');

      expect(prisma.student.findFirstOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: 'stu-1', tenantId: 't-1' }) }),
      );
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: 't-1', studentId: 'stu-1' }) }),
      );
    });

    it('sums fee/paid/discount across invoices correctly', async () => {
      prisma.invoice.findMany.mockResolvedValue([
        { id: 'i1', invoiceNumber: 'INV-1', totalAmount: 5000, paidAmount: 3000, dueAmount: 2000, discountAmount: 500, status: 'PARTIALLY_PAID' },
        { id: 'i2', invoiceNumber: 'INV-2', totalAmount: 2000, paidAmount: 2000, dueAmount: 0,    discountAmount: 0,   status: 'PAID' },
      ]);

      const result = await service.getStudentReconciliation('t-1', 'stu-1');

      expect(result.totalFees).toBe(7000);
      expect(result.totalPaid).toBe(5000);
      expect(result.totalDiscount).toBe(500);
      expect(result.outstandingDues).toBe(1500); // 7000 - 5000 - 500
    });

    it('clamps outstandingDues at zero when discount exceeds the remaining balance', async () => {
      prisma.invoice.findMany.mockResolvedValue([
        { id: 'i1', invoiceNumber: 'INV-1', totalAmount: 1000, paidAmount: 800, dueAmount: 200, discountAmount: 500, status: 'PARTIALLY_PAID' },
      ]);

      const result = await service.getStudentReconciliation('t-1', 'stu-1');

      expect(result.outstandingDues).toBe(0); // not negative
    });

    it('falls back to fee - paid when dueAmount is null', async () => {
      prisma.invoice.findMany.mockResolvedValue([
        { id: 'i1', invoiceNumber: 'INV-1', totalAmount: 1000, paidAmount: 400, dueAmount: null, discountAmount: 0, status: 'PARTIALLY_PAID' },
      ]);

      const result = await service.getStudentReconciliation('t-1', 'stu-1');

      expect(result.invoices[0].dueAmount).toBe(600);
    });

    // D-9: this per-student reconciliation report is exactly what an auditor
    // cross-checks, so the accumulation must not drift.
    it('sums fee/paid/discount across many invoices without binary-float drift (D-9)', async () => {
      // Ten invoices of 0.1 discount each: float sums to 0.9999999999999999.
      prisma.invoice.findMany.mockResolvedValue(
        Array.from({ length: 10 }, (_, i) => ({
          id: `i${i}`, invoiceNumber: `INV-${i}`,
          totalAmount: 100, paidAmount: 100, dueAmount: 0, discountAmount: 0.1,
          status: 'PAID',
        })),
      );

      const result = await service.getStudentReconciliation('t-1', 'stu-1');

      expect(result.totalDiscount).toBe(1); // NOT 0.9999999999999999
      expect(result.totalFees).toBe(1000);
      expect(result.outstandingDues).toBe(0); // 1000 - 1000 - 1, clamped at 0
    });
  });

  describe('reconciliationSummary', () => {
    it('scopes both aggregates to the tenant', async () => {
      prisma.invoice.aggregate
        .mockResolvedValueOnce({ _sum: { totalAmount: 0 } })
        .mockResolvedValueOnce({ _sum: { paidAmount: 0 } });

      await service.reconciliationSummary('t-1');

      for (const call of prisma.invoice.aggregate.mock.calls) {
        expect(call[0].where).toEqual(expect.objectContaining({ tenantId: 't-1' }));
      }
    });

    // D-9: outstanding = invoiced - collected is real arithmetic across two
    // DB sums; 1000.10 - 600.05 drifts under float to 400.05000000000007.
    it('computes outstanding in Decimal — no float drift across the two sums (D-9)', async () => {
      prisma.invoice.aggregate
        .mockResolvedValueOnce({ _sum: { totalAmount: 1000.10 } })
        .mockResolvedValueOnce({ _sum: { paidAmount: 600.05 } });

      const result = await service.reconciliationSummary('t-1');

      expect(result.outstanding).toBe(400.05); // NOT 400.05000000000007
    });

    it('clamps outstanding at zero when collected exceeds invoiced', async () => {
      prisma.invoice.aggregate
        .mockResolvedValueOnce({ _sum: { totalAmount: 1000 } })
        .mockResolvedValueOnce({ _sum: { paidAmount: 1200 } });

      const result = await service.reconciliationSummary('t-1');

      expect(result.outstanding).toBe(0);
    });
  });
});
