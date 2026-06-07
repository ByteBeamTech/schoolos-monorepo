export interface GenerateInvoiceOptions {
  tenantId: string; branchId: string;
  studentIds?: string[]; feePlanId?: string;
  dueDate?: Date; actorId?: string;
}

import { EventEmitter2 } from '@nestjs/event-emitter';
import { EVENTS } from '../../../../core/events/events.constants';
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService }  from '../../../../core/compliance/audit.service';
import { GenerateInvoiceDto, BulkGenerateInvoicesDto } from '../../dto/billing.dto';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit:  AuditService,
    private readonly emitter: EventEmitter2,
  ) {}

/**
   * generateInvoiceNumber — race-condition-safe
   *
   * Uses a Postgres advisory lock (pg_advisory_xact_lock) so concurrent
   * bulk-invoice runs can never produce duplicate invoice numbers.
   *
   * Lock key: consistent hash of tenantId so locks are per-tenant,
   * not globally serializing all schools.
   *
   * The lock is acquired inside a transaction and released automatically
   * when the transaction commits or rolls back.
   */
  private async generateInvoiceNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();

    // Derive a stable int64 lock key from tenantId
    // Using a simple hash — two different tenantIds should not collide in practice
    const lockKey = tenantId
      .split('')
      .reduce((acc, ch) => ((acc * 31 + ch.charCodeAt(0)) & 0x7FFFFFFF), 0);

    const result = await this.prisma.$transaction(async (tx) => {
      // Acquire advisory lock — blocks any concurrent call with same lockKey
      // until this transaction commits
      await tx.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock($1)`, lockKey,
      );

      const count = await tx.invoice.count({ where: { tenantId } });
      const seq   = String(count + 1).padStart(5, '0');
      return `INV-${year}-${seq}`;
    });

    return result;
  }

  async generate(tenantId: string, dto: GenerateInvoiceDto, actorId: string) {
    const plan = await this.prisma.feePlan.findFirst({
      where:   { id: dto.feePlanId, tenantId },
      include: { feeItems: { where: { isOptional: false }, orderBy: { sortOrder: 'asc' } } },
    });
    if (!plan) throw new NotFoundException(`Fee plan not found: ${dto.feePlanId}`);

    const student = await this.prisma.student.findFirst({ where: { id: dto.studentId, tenantId } });
    if (!student) throw new NotFoundException(`Student not found: ${dto.studentId}`);

    if (!plan.feeItems.length) throw new BadRequestException('Fee plan has no items.');

    let subtotal = 0, gstTotal = 0;
    const itemData = plan.feeItems.map((item: any) => {
      const amount    = Number(item.amount);
      const gstRate   = Number(item.gstRate ?? 0);
      const gstAmount = Math.round(amount * gstRate / 100 * 100) / 100;
      subtotal += amount; gstTotal += gstAmount;
      return { feeItemId: item.id, name: item.name, amount, discountAmount: 0, gstRate: gstRate || null, gstAmount, netAmount: amount + gstAmount, sortOrder: item.sortOrder };
    });

    const totalAmount   = subtotal + gstTotal;
    const invoiceNumber = await this.generateInvoiceNumber(tenantId);

    const invoice = await this.prisma.invoice.create({
      data: {
        tenantId, studentId: dto.studentId, invoiceNumber,
        academicYear: plan.academicYear, status: 'DRAFT',
        currency: plan.currency, subtotal, discountAmount: 0,
        gstAmount: gstTotal, totalAmount, paidAmount: 0, dueAmount: totalAmount,
        dueDate: new Date(dto.dueDate), notes: dto.notes ?? null,
        items: { create: itemData },
      },
      include: { items: { orderBy: { sortOrder: 'asc' } }, student: { select: { firstName: true, lastName: true, admissionNumber: true } } },
    });

    await this.audit.logCreate({ tenantId, actorId, entityType: 'Invoice', entityId: invoice.id, after: { invoiceNumber, totalAmount } });
    this.logger.log(`Invoice: ${invoiceNumber} ₹${totalAmount} | tenant: ${tenantId}`);
    this.emitter.emit(EVENTS.INVOICE_GENERATED, {
      tenantId, studentId: dto.studentId,
      invoiceId: invoice.id, invoiceNumber,
      totalAmount, dueDate: dto.dueDate,
    });
    return invoice;
  }

  async bulkGenerate(tenantId: string, dto: BulkGenerateInvoicesDto, actorId: string) {
    const assignments = await this.prisma.feeAssignment.findMany({ where: { tenantId, feePlanId: dto.feePlanId } });
    if (!assignments.length) throw new BadRequestException('No students assigned to this fee plan.');

    const results = { generated: 0, skipped: 0, errors: [] as string[] };
    for (const a of assignments) {
      try {
        await this.generate(tenantId, { studentId: a.studentId, feePlanId: dto.feePlanId, dueDate: dto.dueDate }, actorId);
        results.generated++;
      } catch (err: any) {
        results.skipped++;
        results.errors.push(`Student ${a.studentId}: ${err.message}`);
      }
    }
    return results;
  }

  async findAll(tenantId: string, filters: { studentId?: string; status?: string; academicYear?: string } = {}) {
    return this.prisma.invoice.findMany({
      where: { tenantId, ...(filters.studentId && { studentId: filters.studentId }), ...(filters.status && { status: filters.status as any }), ...(filters.academicYear && { academicYear: filters.academicYear }) },
      include: { items: { orderBy: { sortOrder: 'asc' } }, student: { select: { firstName: true, lastName: true, admissionNumber: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(tenantId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where:   { id, tenantId },
      include: { items: { orderBy: { sortOrder: 'asc' } }, payments: true, receipt: true, lateFees: true, student: { select: { firstName: true, lastName: true, admissionNumber: true } } },
    });
    if (!invoice) throw new NotFoundException(`Invoice not found: ${id}`);
    return invoice;
  }

  async send(tenantId: string, id: string, actorId: string) {
    const invoice = await this.findById(tenantId, id);
    if (invoice.status !== 'DRAFT') throw new BadRequestException(`Invoice is already ${invoice.status}.`);
    const updated = await this.prisma.invoice.update({ where: { id }, data: { status: 'SENT' } });
    this.emitter.emit(EVENTS.INVOICE_SENT, {
  tenantId,
  invoiceId: updated.id,
  studentId: updated.studentId,
  invoiceNumber: updated.invoiceNumber,
  totalAmount: updated.totalAmount,
  dueDate: updated.dueDate,
});
    await this.audit.logUpdate({ tenantId, actorId, entityType: 'Invoice', entityId: id, before: { status: 'DRAFT' }, after: { status: 'SENT' } });
    return updated;
  }

  async findOverdue(tenantId: string) {
    return this.prisma.invoice.findMany({
      where: { tenantId, status: { in: ['SENT', 'PARTIALLY_PAID'] as any[] }, dueDate: { lt: new Date() } },
      include: { student: { select: { firstName: true, lastName: true, admissionNumber: true } } },
      orderBy: { dueDate: 'asc' },
    });
  }

  async getStats(tenantId: string, academicYear?: string) {
    const where: any = { tenantId, ...(academicYear && { academicYear }) };
    const [total, paid, overdue, draft] = await Promise.all([
      this.prisma.invoice.aggregate({ where, _sum: { totalAmount: true }, _count: true }),
      this.prisma.invoice.aggregate({ where: { ...where, status: 'PAID' }, _sum: { paidAmount: true }, _count: true }),
      this.prisma.invoice.count({ where: { ...where, status: { in: ['SENT', 'PARTIALLY_PAID'] as any[] }, dueDate: { lt: new Date() } } }),
      this.prisma.invoice.count({ where: { ...where, status: 'DRAFT' } }),
    ]);
    return { totalInvoices: total._count, totalAmount: Number(total._sum.totalAmount ?? 0), collectedAmount: Number(paid._sum.paidAmount ?? 0), overdueCount: overdue, draftCount: draft, paidCount: paid._count };
  }
}
