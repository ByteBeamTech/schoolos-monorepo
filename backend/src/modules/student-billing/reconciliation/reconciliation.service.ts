// modules/student-billing/reconciliation/reconciliation.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService }      from '../../../infra/database/prisma.service';

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

    let totalFees     = 0;
    let totalPaid     = 0;
    let totalDiscount = 0;
    const invoiceSummaries: InvoiceSummary[] = [];

    for (const inv of invoices) {
      const fee      = Number(inv.totalAmount);
      const paid     = Number(inv.paidAmount ?? 0);
      const due      = Number(inv.dueAmount ?? fee - paid);
      const discount = Number((inv as any).discountAmount ?? 0);

      totalFees     += fee;
      totalPaid     += paid;
      totalDiscount += discount;

      invoiceSummaries.push({
        invoiceId:     inv.id,
        invoiceNumber: inv.invoiceNumber,
        totalAmount:   fee,
        paidAmount:    paid,
        dueAmount:     due,
        status:        inv.status,
        dueDate:       (inv as any).dueDate ?? null,
      });
    }

    const outstandingDues = Math.max(0, totalFees - totalPaid - totalDiscount);

    return {
      studentId,
      studentName:  `${student.firstName} ${student.lastName}`,
      termId:       sessionId ?? 'all',
      totalFees,
      totalPaid,
      totalDiscount,
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
        where: { ...where, status: 'OVERDUE' },
      }),
    ]);

    const invoiced   = Number(totalInvoiced._sum.totalAmount  ?? 0);
    const collected  = Number(totalCollected._sum.paidAmount  ?? 0);
    const outstanding = Math.max(0, invoiced - collected);

    return { invoiced, collected, outstanding, overdueCount, collectionRate: invoiced > 0 ? (collected / invoiced) * 100 : 0 };
  }
}
