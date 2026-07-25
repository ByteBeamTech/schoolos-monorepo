// modules/student-billing/reconciliation/reconciliation.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { Prisma } from '@prisma/client';
import { overdueWhere } from '../invoice/overdue.util';

export interface StudentReconciliation {
  studentId:        string;
  studentName:      string;
  termId:           string;
  totalFees:        number;
  totalPaid:        number;
  totalDiscount:    number;
  outstandingDues:  number;
  currency:         string;
  invoices:         InvoiceSummary[];
}

interface InvoiceSummary {
  invoiceId:     string;
  invoiceNumber: string;
  totalAmount:   number;
  paidAmount:    number;
  dueAmount:     number;
  status:        string;
  dueDate:       Date | null;
}

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Outstanding dues = sum(fee plans) − sum(payments) per student per term ──

  async getStudentReconciliation(
    tenantId:  string,
    studentId: string,
    sessionId?: string,
  ): Promise<StudentReconciliation> {
    const student = await this.prisma.student.findFirstOrThrow({
      where:  { id: studentId, tenantId },
      select: { id: true, firstName: true, lastName: true },
    });

    const invoiceWhere: any = { tenantId, studentId };
    if (sessionId) invoiceWhere.sessionId = sessionId;

    const invoices = await this.prisma.invoice.findMany({
      where:   invoiceWhere,
      include: { payments: { where: { status: 'SUCCESS' } } },
      orderBy: { createdAt: 'desc' },
    });

    // Accumulated in Decimal (D-9); converted to numbers only at the response
    // boundary below. Summing many invoices' fee/paid/discount as float
    // drifts, and this report is exactly what an auditor cross-checks.
    let totalFees     = new Prisma.Decimal(0);
    let totalPaid     = new Prisma.Decimal(0);
    let totalDiscount = new Prisma.Decimal(0);
    const invoiceSummaries: InvoiceSummary[] = [];

    for (const inv of invoices) {
      const fee      = new Prisma.Decimal(inv.totalAmount);
      const paid     = new Prisma.Decimal(inv.paidAmount ?? 0);
      const due      = inv.dueAmount != null ? new Prisma.Decimal(inv.dueAmount) : fee.minus(paid);
      const discount = new Prisma.Decimal((inv as any).discountAmount ?? 0);

      totalFees     = totalFees.plus(fee);
      totalPaid     = totalPaid.plus(paid);
      totalDiscount = totalDiscount.plus(discount);

      invoiceSummaries.push({
        invoiceId:     inv.id,
        invoiceNumber: inv.invoiceNumber,
        totalAmount:   fee.toNumber(),
        paidAmount:    paid.toNumber(),
        dueAmount:     due.toNumber(),
        status:        inv.status,
        dueDate:       (inv as any).dueDate ?? null,
      });
    }

    const outstandingRaw = totalFees.minus(totalPaid).minus(totalDiscount);
    const outstandingDues = outstandingRaw.isNegative() ? 0 : outstandingRaw.toNumber();

    return {
      studentId,
      studentName:  `${student.firstName} ${student.lastName}`,
      termId:       sessionId ?? 'all',
      totalFees:     totalFees.toNumber(),
      totalPaid:     totalPaid.toNumber(),
      totalDiscount: totalDiscount.toNumber(),
      outstandingDues,
      currency:     invoices[0] ? String((invoices[0] as any).currency ?? 'INR') : 'INR',
      invoices:     invoiceSummaries,
    };
  }

  // ─── Bulk reconciliation for all students in a class/branch ────────────────

  async bulkReconciliation(
    tenantId:  string,
    sessionId: string,
    filters:   { classId?: string; branchId?: string; status?: string },
  ) {
    const studentWhere: any = { tenantId };
    if (filters.classId)  studentWhere.classId  = filters.classId;
    if (filters.branchId) studentWhere.branchId = filters.branchId;

    const students = await this.prisma.student.findMany({
      where:  studentWhere,
      select: { id: true },
      take:   500,
    });

    const results = await Promise.all(
      students.map(s => this.getStudentReconciliation(tenantId, s.id, sessionId)),
    );

    if (filters.status === 'outstanding') {
      return results.filter(r => r.outstandingDues > 0);
    }
    if (filters.status === 'paid') {
      return results.filter(r => r.outstandingDues === 0);
    }
    return results;
  }

  // ─── Summary stats ─────────────────────────────────────────────────────────

  async reconciliationSummary(tenantId: string, sessionId?: string) {
    const where: any = { tenantId };
    if (sessionId) where.sessionId = sessionId;

    const [totalInvoiced, totalCollected, overdueCount] = await Promise.all([
      this.prisma.invoice.aggregate({
        where:  { ...where, status: { not: 'CANCELLED' } },
        _sum:   { totalAmount: true },
      }),
      this.prisma.invoice.aggregate({
        where:  { ...where, status: { not: 'CANCELLED' } },
        _sum:   { paidAmount: true },
      }),
      this.prisma.invoice.count({
        // M5: derived (SENT/PARTIALLY_PAID/OVERDUE-legacy + dueDate < now),
        // not a bare status equality -- see invoice/overdue.util.ts. Was
        // previously purely cron-lag-dependent: an invoice past due but not
        // yet touched by LateFeeService.applyLateFees() was invisible here.
        where: { ...where, ...overdueWhere() },
      }),
    ]);

    // Aggregate-to-response boundary, not arithmetic (D-9): Prisma computes
    // these _sum values exactly in the database. Response contract is numbers.
    const invoiced   = Number(totalInvoiced._sum.totalAmount  ?? 0);
    const collected  = Number(totalCollected._sum.paidAmount  ?? 0);
    // outstanding = invoiced - collected IS service-side arithmetic across two
    // DB sums, computed in Decimal from the raw values to avoid float drift.
    const outstandingRaw = new Prisma.Decimal(totalInvoiced._sum.totalAmount ?? 0)
      .minus(totalCollected._sum.paidAmount ?? 0);
    const outstanding = outstandingRaw.isNegative() ? 0 : outstandingRaw.toNumber();

    return { invoiced, collected, outstanding, overdueCount, collectionRate: invoiced > 0 ? (collected / invoiced) * 100 : 0 };
  }
}
